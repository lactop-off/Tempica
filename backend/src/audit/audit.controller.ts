import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Action, Feature } from '../common/constants';
import { AuthUser, CurrentUser, RequirePermission } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

/** 監査ログ閲覧（F-1102）。組織スコープで証跡を返す。 */
@ApiTags('audit')
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: '監査ログ一覧（action でフィルタ可）' })
  @RequirePermission(Feature.AUDIT, Action.VIEW)
  async list(
    @CurrentUser() user: AuthUser,
    @Query('action') action?: string,
    @Query('limit') limit?: string,
  ) {
    const take = Math.min(Number(limit) || 100, 500);
    return this.prisma.auditLog.findMany({
      where: { orgId: user.orgId, ...(action ? { action } : {}) },
      orderBy: { at: 'desc' },
      take,
    });
  }
}
