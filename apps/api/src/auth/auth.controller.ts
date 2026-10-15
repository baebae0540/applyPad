import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExcludeEndpoint,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import type { Env } from '../config/env.js';
import {
  OAUTH_COOKIE,
  OAUTH_COOKIE_MAX_AGE_MS,
  OAUTH_COOKIE_PATH,
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
} from './auth.constants.js';
import { AuthService } from './auth.service.js';
import { DemoService } from './demo.service.js';
import { CurrentUser, Public, type AuthUser } from './decorators.js';
import { AuthResponseDto, LoginDto, SignupDto, UserDto } from './dto/auth.dto.js';
import { GoogleOAuthService, sanitizeRedirect, type OAuthPending } from './google-oauth.service.js';
import { TokensService, type IssuedRefresh } from './tokens.service.js';

@ApiTags('auth')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private readonly webOrigin: string;
  private readonly secureCookies: boolean;

  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokensService,
    private readonly google: GoogleOAuthService,
    private readonly demo: DemoService,
    config: ConfigService<Env, true>,
  ) {
    this.webOrigin = config.get('WEB_ORIGIN', { infer: true }).replace(/\/$/, '');
    this.secureCookies = config.get('COOKIE_SECURE', { infer: true });
  }

  // ---------- 이메일 ----------

  @Public()
  @Post('signup')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiConflictResponse({ description: '이미 가입된 이메일' })
  async signup(@Body() dto: SignupDto, @Res({ passthrough: true }) res: Response): Promise<AuthResponseDto> {
    const user = await this.auth.signup(dto);
    return this.startSession(user, res);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: '이메일 또는 비밀번호 불일치' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<AuthResponseDto> {
    const user = await this.auth.login(dto);
    return this.startSession(user, res);
  }

  /**
   * 둘러보기: 샘플 데이터가 담긴 임시 계정을 만들고 바로 로그인시킨다.
   * 방문자마다 새 계정이라 서로의 데이터를 건드리지 않는다.
   */
  @Public()
  @Post('demo')
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  @ApiCreatedResponse({ type: AuthResponseDto })
  async demoLogin(@Res({ passthrough: true }) res: Response): Promise<AuthResponseDto> {
    const userId = await this.demo.createUser();
    const user = await this.auth.getUser(userId);
    return this.startSession(user, res);
  }

  // ---------- 세션 ----------

  /** refresh 쿠키로 새 access 토큰을 받는다 (refresh 토큰도 함께 회전). 웹은 첫 로딩 때 이걸로 로그인 상태를 복원한다 */
  @Public()
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'refresh 쿠키가 없거나 만료/폐기됨' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthResponseDto> {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!token) throw new UnauthorizedException('로그인이 필요합니다');
    try {
      const { userId, refresh } = await this.tokens.rotate(token);
      this.setRefreshCookie(res, refresh);
      const [accessToken, user] = await Promise.all([
        this.tokens.signAccessToken(userId),
        this.auth.getUser(userId),
      ]);
      return { accessToken, user };
    } catch (e) {
      this.clearRefreshCookie(res);
      throw e;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (token) await this.tokens.revoke(token);
    this.clearRefreshCookie(res);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOkResponse({ type: UserDto })
  me(@CurrentUser() user: AuthUser): Promise<UserDto> {
    return this.auth.getUser(user.id);
  }

  // ---------- Google ----------

  /** Google 로그인 시작. 웹에서 location.href = '/api/auth/google?redirect=/board' 로 이동 */
  @Public()
  @Get('google')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOkResponse({ description: 'Google 동의 화면으로 302 리다이렉트' })
  startGoogle(@Query('redirect') redirect: string | undefined, @Res() res: Response): void {
    if (!this.google.enabled) {
      res.redirect(302, `${this.webOrigin}/login?error=google_disabled`);
      return;
    }
    const { url, pending } = this.google.createAuthorization(sanitizeRedirect(redirect));
    res.cookie(OAUTH_COOKIE, JSON.stringify(pending), {
      ...this.baseCookie(OAUTH_COOKIE_PATH),
      maxAge: OAUTH_COOKIE_MAX_AGE_MS,
    });
    res.redirect(302, url);
  }

  @Public()
  @Get('google/callback')
  @ApiExcludeEndpoint()
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const pending = parsePending(req.cookies?.[OAUTH_COOKIE]);
    res.clearCookie(OAUTH_COOKIE, this.baseCookie(OAUTH_COOKIE_PATH));

    const fail = (reason: string) => {
      this.logger.warn(`Google login failed: ${reason}`);
      res.redirect(302, `${this.webOrigin}/login?error=google`);
    };

    if (error) return fail(`provider error ${error}`);
    if (!pending || !state || pending.state !== state) return fail('state mismatch');
    if (!code) return fail('missing code');

    try {
      const profile = await this.google.fetchProfile(code, pending.verifier);
      const user = await this.auth.loginWithGoogle(profile);
      const refresh = await this.tokens.issueRefreshToken(user.id);
      this.setRefreshCookie(res, refresh);
      res.redirect(302, `${this.webOrigin}${pending.redirect}`);
    } catch (e) {
      fail((e as Error).message);
    }
  }

  // ---------- helpers ----------

  private async startSession(user: UserDto, res: Response): Promise<AuthResponseDto> {
    const [accessToken, refresh] = await Promise.all([
      this.tokens.signAccessToken(user.id),
      this.tokens.issueRefreshToken(user.id),
    ]);
    this.setRefreshCookie(res, refresh);
    return { accessToken, user };
  }

  private baseCookie(path: string): CookieOptions {
    return { httpOnly: true, secure: this.secureCookies, sameSite: 'lax', path };
  }

  private setRefreshCookie(res: Response, refresh: IssuedRefresh): void {
    res.cookie(REFRESH_COOKIE, refresh.token, {
      ...this.baseCookie(REFRESH_COOKIE_PATH),
      expires: refresh.expiresAt,
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, this.baseCookie(REFRESH_COOKIE_PATH));
  }
}

function parsePending(raw: unknown): OAuthPending | null {
  if (typeof raw !== 'string') return null;
  try {
    const value = JSON.parse(raw) as Partial<OAuthPending>;
    if (typeof value.state !== 'string' || typeof value.verifier !== 'string') return null;
    return { state: value.state, verifier: value.verifier, redirect: sanitizeRedirect(value.redirect) };
  } catch {
    return null;
  }
}
