import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/decorators.js';
import { CreateTagDto, SetApplicationTagsDto, UpdateTagDto } from './dto/tag.dto.js';
import { TagsService } from './tags.service.js';

@ApiTags('tags')
@ApiBearerAuth()
@Controller('tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.tags.list(user.id);
  }

  @Post()
  @ApiConflictResponse({ description: '같은 이름의 태그가 이미 있음' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTagDto) {
    return this.tags.create(user.id, dto);
  }

  @Patch(':id')
  @ApiNotFoundResponse({ description: '없거나 다른 사용자의 태그' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateTagDto) {
    return this.tags.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.tags.remove(user.id, id);
  }
}

@ApiTags('tags')
@ApiBearerAuth()
@Controller('applications/:applicationId/tags')
export class ApplicationTagsController {
  constructor(private readonly tags: TagsService) {}

  /** 지원에 붙은 태그 전체 교체 */
  @Put()
  @ApiNotFoundResponse({ description: '없거나 다른 사용자의 지원 내역·태그' })
  set(
    @CurrentUser() user: AuthUser,
    @Param('applicationId') applicationId: string,
    @Body() dto: SetApplicationTagsDto,
  ) {
    return this.tags.setForApplication(user.id, applicationId, dto);
  }
}
