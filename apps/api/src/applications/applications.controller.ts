import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiNotFoundResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/decorators.js';
import { ApplicationsService } from './applications.service.js';
import {
  CreateApplicationDto,
  ListApplicationsQuery,
  MoveApplicationDto,
  UpdateApplicationDto,
} from './dto/application.dto.js';

@ApiTags('applications')
@ApiBearerAuth()
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListApplicationsQuery) {
    return this.applications.list(user.id, query);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateApplicationDto) {
    return this.applications.create(user.id, dto);
  }

  @Get(':id')
  @ApiNotFoundResponse({ description: '없거나 다른 사용자의 지원 내역' })
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.applications.get(user.id, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateApplicationDto) {
    return this.applications.update(user.id, id, dto);
  }

  /** 칸반 드래그: 상태와 컬럼 내 위치를 함께 바꾼다 (상태가 바뀌면 이력 자동 기록) */
  @Patch(':id/move')
  move(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: MoveApplicationDto) {
    return this.applications.move(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.applications.remove(user.id, id);
  }

  @Get(':id/timeline')
  timeline(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.applications.timeline(user.id, id);
  }
}
