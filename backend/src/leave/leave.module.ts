import {
  Body,
  Controller,
  Delete,
  Get,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { Action, Feature } from '../common/constants';
import { BusinessException } from '../common/business-exception';
import { AuthUser, CurrentUser, RequirePermission } from '../common/decorators';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

class CreateLeaveTypeDto {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsBoolean() paid?: boolean;
  @IsOptional() @IsIn(['day', 'half', 'hour']) unit?: string;
  @IsOptional() @IsObject() grantRule?: Record<string, unknown>;
}
class UpdateLeaveTypeDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsBoolean() paid?: boolean;
  @IsOptional() @IsIn(['day', 'half', 'hour']) unit?: string;
  @IsOptional() @IsObject() grantRule?: Record<string, unknown>;
}
class GrantBalanceDto {
  @IsUUID() userId!: string;
  @IsUUID() leaveTypeId!: string;
  @IsInt() @Min(0) grantedMinutes!: number;
  @IsOptional() @IsDateString() expiresOn?: string;
}

@ApiTags('leave')
@Controller()
class LeaveController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── 休暇種別 ──
  @Get('leave-types')
  @RequirePermission(Feature.LEAVE, Action.VIEW)
  listTypes(@CurrentUser() user: AuthUser) {
    return this.prisma.leaveType.findMany({
      where: { orgId: user.orgId },
      orderBy: { name: 'asc' },
    });
  }

  @Post('leave-types')
  @RequirePermission(Feature.LEAVE, Action.MANAGE)
  async createType(@CurrentUser() user: AuthUser, @Body() dto: CreateLeaveTypeDto) {
    const t = await this.prisma.leaveType.create({
      data: {
        orgId: user.orgId,
        name: dto.name,
        paid: dto.paid ?? true,
        unit: dto.unit ?? 'day',
        grantRule: (dto.grantRule ?? {}) as object,
      },
    });
    await this.audit.record({
      orgId: user.orgId,
      actorId: user.id,
      action: 'leaveType.create',
      target: t.id,
    });
    return t;
  }

  @Patch('leave-types/:id')
  @RequirePermission(Feature.LEAVE, Action.MANAGE)
  async updateType(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeaveTypeDto,
  ) {
    await this.findType(user.orgId, id);
    return this.prisma.leaveType.update({
      where: { id },
      data: { ...dto, grantRule: dto.grantRule as object | undefined },
    });
  }

  @Delete('leave-types/:id')
  @RequirePermission(Feature.LEAVE, Action.MANAGE)
  async removeType(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.findType(user.orgId, id);
    const used = await this.prisma.leaveBalance.count({ where: { leaveTypeId: id } });
    if (used > 0) throw BusinessException.validation('残数が存在する休暇種別は削除できません');
    await this.prisma.leaveType.delete({ where: { id } });
    return { ok: true };
  }

  // ── 休暇残数 ──
  @Get('leave-balances')
  @ApiOperation({ summary: '休暇残数（userId 省略時は自分）' })
  @RequirePermission(Feature.LEAVE, Action.VIEW)
  async balances(@CurrentUser() user: AuthUser, @Query('userId') userId?: string) {
    const targetId = userId ?? user.id;
    if (targetId !== user.id) {
      const t = await this.prisma.appUser.findUnique({ where: { id: targetId } });
      if (!t || t.orgId !== user.orgId)
        throw BusinessException.notFound('ユーザーが見つかりません');
    }
    return this.prisma.leaveBalance.findMany({
      where: { userId: targetId },
      include: { leaveType: true },
    });
  }

  @Post('leave-balances')
  @ApiOperation({ summary: '休暇残数の付与（人事）' })
  @RequirePermission(Feature.LEAVE, Action.MANAGE)
  async grant(@CurrentUser() user: AuthUser, @Body() dto: GrantBalanceDto) {
    await this.findType(user.orgId, dto.leaveTypeId);
    const target = await this.prisma.appUser.findUnique({ where: { id: dto.userId } });
    if (!target || target.orgId !== user.orgId)
      throw BusinessException.notFound('ユーザーが見つかりません');
    const expiresOn = dto.expiresOn ? new Date(dto.expiresOn) : null;
    const balance = await this.prisma.leaveBalance.upsert({
      where: {
        userId_leaveTypeId_expiresOn: {
          userId: dto.userId,
          leaveTypeId: dto.leaveTypeId,
          expiresOn: expiresOn as any,
        },
      },
      create: {
        userId: dto.userId,
        leaveTypeId: dto.leaveTypeId,
        grantedMinutes: dto.grantedMinutes,
        expiresOn,
      },
      update: { grantedMinutes: { increment: dto.grantedMinutes } },
    });
    await this.audit.record({
      orgId: user.orgId,
      actorId: user.id,
      action: 'leaveBalance.grant',
      target: dto.userId,
      detail: { leaveTypeId: dto.leaveTypeId, grantedMinutes: dto.grantedMinutes },
    });
    return balance;
  }

  private async findType(orgId: string, id: string) {
    const t = await this.prisma.leaveType.findUnique({ where: { id } });
    if (!t || t.orgId !== orgId) throw BusinessException.notFound('休暇種別が見つかりません');
    return t;
  }
}

@Module({
  controllers: [LeaveController],
})
export class LeaveModule {}
