import { Body, Controller, Get, Module, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { Action, Feature } from '../common/constants';
import { AuthUser, CurrentUser, RequirePermission, ResolvedScope } from '../common/decorators';
import { ApprovalRoutesModule } from '../approval-routes/approval-routes.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SummariesModule } from '../summaries/summaries.module';
import { ApprovalsService } from './approvals.service';

class ActDto {
  @IsIn(['approved', 'rejected']) result!: 'approved' | 'rejected';
  @IsOptional() @IsString() comment?: string;
}

@ApiTags('approvals')
@Controller('approvals')
class ApprovalsController {
  constructor(private readonly service: ApprovalsService) {}

  @Get()
  @ApiOperation({ summary: '承認待ち一覧（自分が承認者のステップ）' })
  @RequirePermission(Feature.APPROVAL, Action.APPROVE)
  pending(
    @CurrentUser() user: AuthUser,
    @ResolvedScope() rs: { scope: any; accessibleDeptIds?: string[] },
  ) {
    return this.service.pendingFor(
      user.orgId,
      { id: user.id, deptId: user.deptId },
      rs.scope,
      rs.accessibleDeptIds,
    );
  }

  @Post(':id')
  @ApiOperation({ summary: '承認 / 差戻し（差戻しはコメント必須）' })
  @RequirePermission(Feature.APPROVAL, Action.APPROVE)
  act(
    @CurrentUser() user: AuthUser,
    @ResolvedScope() rs: { scope: any; accessibleDeptIds?: string[] },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActDto,
  ) {
    return this.service.act(
      user.orgId,
      { id: user.id, deptId: user.deptId },
      rs.scope,
      rs.accessibleDeptIds,
      id,
      dto,
    );
  }
}

@Module({
  imports: [ApprovalRoutesModule, SummariesModule, NotificationsModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
