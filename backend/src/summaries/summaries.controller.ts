import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID, Matches } from 'class-validator';
import { Action, Feature } from '../common/constants';
import { BusinessException } from '../common/business-exception';
import { AuthUser, CurrentUser, RequirePermission, ResolvedScope } from '../common/decorators';
import { isVisible } from '../common/rbac';
import { PrismaService } from '../prisma/prisma.service';
import { SummariesService } from './summaries.service';

class DailyQuery {
  @IsDateString() from!: string;
  @IsDateString() to!: string;
  @IsOptional() @IsUUID() userId?: string;
}
class MonthlyQuery {
  @Matches(/^\d{4}-\d{2}$/) period!: string;
  @IsOptional() @IsUUID() userId?: string;
}

@ApiTags('summaries')
@Controller('summaries')
export class SummariesController {
  constructor(
    private readonly service: SummariesService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('daily')
  @ApiOperation({ summary: '日次集計の取得（userId 省略時は自分）' })
  @RequirePermission(Feature.ATTENDANCE, Action.VIEW)
  async daily(
    @CurrentUser() user: AuthUser,
    @Query() q: DailyQuery,
    @ResolvedScope() rs: { scope: any; accessibleDeptIds?: string[] },
  ) {
    const target = await this.resolveTarget(user, q.userId, rs);
    return this.service.daily(target, new Date(q.from), new Date(q.to));
  }

  @Get('monthly')
  @ApiOperation({ summary: '月次サマリの取得' })
  @RequirePermission(Feature.ATTENDANCE, Action.VIEW)
  async monthly(
    @CurrentUser() user: AuthUser,
    @Query() q: MonthlyQuery,
    @ResolvedScope() rs: { scope: any; accessibleDeptIds?: string[] },
  ) {
    const target = await this.resolveTarget(user, q.userId, rs);
    return this.service.monthly(target, q.period);
  }

  /** 対象ユーザーを scope に照らして検証し、許可されれば userId を返す。 */
  private async resolveTarget(
    user: AuthUser,
    requestedUserId: string | undefined,
    rs: { scope: any; accessibleDeptIds?: string[] },
  ): Promise<string> {
    if (!requestedUserId || requestedUserId === user.id) return user.id;
    const target = await this.prisma.appUser.findUnique({ where: { id: requestedUserId } });
    if (!target || target.orgId !== user.orgId)
      throw BusinessException.notFound('ユーザーが見つかりません');
    const ok = isVisible(
      rs.scope,
      { userId: user.id, deptId: user.deptId, accessibleDeptIds: rs.accessibleDeptIds },
      { ownerUserId: target.id, ownerDeptId: target.deptId },
    );
    if (!ok)
      throw BusinessException.forbidden(
        'forbidden',
        'このユーザーの勤怠を閲覧する権限がありません',
      );
    return target.id;
  }
}
