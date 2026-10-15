import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiNotFoundResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/decorators.js';
import { CreateNoteDto, UpdateNoteDto } from './dto/note.dto.js';
import { NotesService } from './notes.service.js';

@ApiTags('notes')
@ApiBearerAuth()
@ApiNotFoundResponse({ description: '없거나 다른 사용자의 지원 내역·메모' })
@Controller('applications/:applicationId/notes')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Param('applicationId') applicationId: string) {
    return this.notes.list(user.id, applicationId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Param('applicationId') applicationId: string,
    @Body() dto: CreateNoteDto,
  ) {
    return this.notes.create(user.id, applicationId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('applicationId') applicationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateNoteDto,
  ) {
    return this.notes.update(user.id, applicationId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(
    @CurrentUser() user: AuthUser,
    @Param('applicationId') applicationId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.notes.remove(user.id, applicationId, id);
  }
}
