import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/decorators.js';
import { DashboardService } from './dashboard.service.js';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @ApiOkResponse({
    description: '상태별 지원 수, 다가오는 면접(가까운 순 10건), 전체 지원 수',
  })
  get(@CurrentUser() user: AuthUser) {
    return this.dashboard.get(user.id);
  }
}
