import { Body, Controller, Get, Module, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsUUID, Matches } from 'class-validator';
import { Action, Feature } from '../common/constants';
import { BusinessException } from '../common/business-exception';
import { AuthUser, CurrentUser, RequirePermission, ResolvedScope } from '../common/decorators';
import { isVisible } from '../common/rbac';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';

class CreateShiftDto {
  @IsOptional() @IsUUID() userId?: string; // 省略時は自分（希望提出）
  @IsDateString() shiftDate!: string;
  @IsOptional() @Matches(/^\d{2}:\d{2}$/) startTime?: string;
  @IsOptional() @Matches(/^\d{2}:\d{2}$/) endTime?: string;
  @IsOptional() @IsIn(['planned', 'requested']) kind?: string;
}

@ApiTags('shifts')
@Controller('shifts')
class ShiftsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'シフト/勤務予定の取得（個人・部署）' })
  @RequirePermission(Feature.SHIFT, Action.VIEW)
  async list(
    @CurrentUser() user: AuthUser,
    @ResolvedScope() rs: { scope: any; accessibleDeptIds?: string[] },
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('userId') userId?: string,
  ) {
    const targetIds = await this.resolveUserIds(user, rs, userId);
    return this.prisma.shift.findMany({
      where: { userId: { in: targetIds }, shiftDate: { gte: new Date(from), lte: new Date(to) } },
      orderBy: [{ shiftDate: 'asc' }, { userId: 'asc' }],
    });
  }

  @Post()
  @ApiOperation({ summary: 'シフト確定（管理者）/ 希望提出（本人）' })
  @RequirePermission(Feature.SHIFT, Action.VIEW)
  async upsert(
    @CurrentUser() user: AuthUser,
    @ResolvedScope() rs: { scope: any; accessibleDeptIds?: string[] },
    @Body() dto: CreateShiftDto,
  ) {
    const targetId = dto.userId ?? user.id;
    const kind = dto.kind ?? (targetId === user.id ? 'requested' : 'planned');

    // 他人の予定・確定シフトの編集には shift:edit 権限が必要。希望提出(自分)は view で可。
    if (targetId !== user.id || kind === 'planned') {
      const editScope = await this.rbac.resolveScope(user.id, Feature.SHIFT, Action.EDIT);
      if (!editScope)
        throw BusinessException.forbidden('forbidden', 'シフト編成の権限がありません');
      const target = await this.prisma.appUser.findUnique({ where: { id: targetId } });
      if (!target || target.orgId !== user.orgId)
        throw BusinessException.notFound('ユーザーが見つかりません');
      const accessible = await this.rbac.accessibleDeptIds(user.orgId, user.deptId, editScope);
      const ok = isVisible(
        editScope,
        { userId: user.id, deptId: user.deptId, accessibleDeptIds: accessible },
        { ownerUserId: target.id, ownerDeptId: target.deptId },
      );
      if (!ok)
        throw BusinessException.forbidden(
          'forbidden',
          'このユーザーのシフトを編成する権限がありません',
        );
    }

    const data = {
      userId: targetId,
      shiftDate: new Date(dto.shiftDate),
      startTime: dto.startTime ? new Date(`1970-01-01T${dto.startTime}:00Z`) : null,
      endTime: dto.endTime ? new Date(`1970-01-01T${dto.endTime}:00Z`) : null,
      kind,
    };
    return this.prisma.shift.upsert({
      where: { userId_shiftDate_kind: { userId: targetId, shiftDate: data.shiftDate, kind } },
      create: data,
      update: { startTime: data.startTime, endTime: data.endTime },
    });
  }

  private async resolveUserIds(
    user: AuthUser,
    rs: { scope: any; accessibleDeptIds?: string[] },
    requestedUserId?: string,
  ): Promise<string[]> {
    if (requestedUserId) {
      const t = await this.prisma.appUser.findUnique({ where: { id: requestedUserId } });
      if (!t || t.orgId !== user.orgId)
        throw BusinessException.notFound('ユーザーが見つかりません');
      const ok = isVisible(
        rs.scope,
        { userId: user.id, deptId: user.deptId, accessibleDeptIds: rs.accessibleDeptIds },
        { ownerUserId: t.id, ownerDeptId: t.deptId },
      );
      if (!ok) throw BusinessException.forbidden('forbidden', '閲覧権限がありません');
      return [requestedUserId];
    }
    if (rs.scope === 'self') return [user.id];
    const users = await this.prisma.appUser.findMany({
      where:
        rs.scope === 'org'
          ? { orgId: user.orgId }
          : {
              orgId: user.orgId,
              OR: [{ id: user.id }, { deptId: { in: rs.accessibleDeptIds ?? [] } }],
            },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }
}

@Module({
  controllers: [ShiftsController],
})
export class ShiftsModule {}
