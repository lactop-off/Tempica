import { Body, Controller, Get, Module, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsUUID } from 'class-validator';
import { Action, Feature, RequestType } from '../common/constants';
import { AuthUser, CurrentUser, RequirePermission } from '../common/decorators';
import { ApprovalRoutesModule } from '../approval-routes/approval-routes.module';
import { ApprovalsModule } from '../approvals/approvals.module';
import { RequestsService } from './requests.service';

const TYPES = Object.values(RequestType);

class CreateRequestDto {
  @IsIn(TYPES) type!: string;
  @IsOptional() @IsUUID() leave_type_id?: string;
  @IsObject() payload!: Record<string, any>;
}

@ApiTags('requests')
@Controller('requests')
class RequestsController {
  constructor(private readonly service: RequestsService) {}

  @Post()
  @ApiOperation({ summary: '各種申請を作成（承認経路に従い approval を自動生成）' })
  @RequirePermission(Feature.REQUEST, Action.CREATE)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRequestDto) {
    return this.service.create(user.orgId, user.id, {
      type: dto.type,
      leaveTypeId: dto.leave_type_id,
      payload: dto.payload,
    });
  }

  @Get()
  @ApiOperation({ summary: '自分の申請一覧（status でフィルタ可）' })
  @RequirePermission(Feature.REQUEST, Action.VIEW)
  list(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return this.service.listForUser(user.orgId, user.id, status);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: '申請の取消（pending のみ）' })
  @RequirePermission(Feature.REQUEST, Action.CREATE)
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.cancel(user.orgId, user.id, id);
  }
}

@Module({
  imports: [ApprovalRoutesModule, ApprovalsModule],
  controllers: [RequestsController],
  providers: [RequestsService],
})
export class RequestsModule {}
