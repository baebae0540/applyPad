import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiNotFoundResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/decorators.js';
import { CreateInterviewDto, UpdateInterviewDto } from './dto/interview.dto.js';
import { InterviewsService } from './interviews.service.js';

@ApiTags('interviews')
@ApiBearerAuth()
@ApiNotFoundResponse({ description: '없거나 다른 사용자의 지원 내역·면접' })
@Controller('applications/:applicationId/interviews')
export class InterviewsController {
  constructor(private readonly interviews: InterviewsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Param('applicationId') applicationId: string) {
    return this.interviews.list(user.id, applicationId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Param('applicationId') applicationId: string,
    @Body() dto: CreateInterviewDto,
  ) {
    return this.interviews.create(user.id, applicationId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('applicationId') applicationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateInterviewDto,
  ) {
    return this.interviews.update(user.id, applicationId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(
    @CurrentUser() user: AuthUser,
    @Param('applicationId') applicationId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.interviews.remove(user.id, applicationId, id);
  }
}
