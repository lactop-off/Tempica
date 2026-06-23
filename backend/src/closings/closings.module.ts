import { Body, Controller, Get, Module, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import { Action, Feature } from '../common/constants';
import { AuthUser, CurrentUser, RequirePermission } from '../common/decorators';
import { SummariesModule } from '../summaries/summaries.module';
import { ClosingsService } from './closings.service';

class CloseDto {
  @Matches(/^\d{4}-\d{2}$/) period!: string;
}

@ApiTags('closings')
@Controller('closings')
class ClosingsController {
  constructor(private readonly service: ClosingsService) {}

  @Get('precheck')
  @ApiOperation({ summary: '締め前チェック（未承認・未確定件数）' })
  @RequirePermission(Feature.CLOSING, Action.MANAGE)
  precheck(@CurrentUser() user: AuthUser, @Query('period') period: string) {
    return this.service.precheck(user.orgId, period);
  }

  @Post()
  @ApiOperation({ summary: '月次締め（対象期間をロック）' })
  @RequirePermission(Feature.CLOSING, Action.MANAGE)
  close(@CurrentUser() user: AuthUser, @Body() dto: CloseDto) {
    return this.service.close(user.orgId, user.id, dto.period);
  }

  @Post(':id/reopen')
  @ApiOperation({ summary: '締めの再オープン（権限者）' })
  @RequirePermission(Feature.CLOSING, Action.MANAGE)
  reopen(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.reopen(user.orgId, user.id, id);
  }
}

@Module({
  imports: [SummariesModule],
  controllers: [ClosingsController],
  providers: [ClosingsService],
})
export class ClosingsModule {}
