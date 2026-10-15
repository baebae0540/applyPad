import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { durationToMs, type Env } from '../config/env.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { DemoService } from './demo.service.js';
import { GoogleOAuthService } from './google-oauth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { TokensService } from './tokens.service.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: {
          // 초 단위로 넘겨 ms 문자열 타입 의존을 피한다
          expiresIn: Math.floor(durationToMs(config.get('JWT_ACCESS_TTL', { infer: true })) / 1000),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokensService,
    GoogleOAuthService,
    DemoService,
    // 모든 라우트에 인증을 기본 적용하고, @Public()으로만 예외를 둔다
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AuthModule {}
