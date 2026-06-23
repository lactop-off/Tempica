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
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Action, Feature, RoundingMethod, WorkPatternType } from '../common/constants';
import { BusinessException } from '../common/business-exception';
import { AuthUser, CurrentUser, RequirePermission } from '../common/decorators';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

const TYPES = Object.values(WorkPatternType);
const ROUNDING = Object.values(RoundingMethod);

class WorkRuleDto {
  @IsOptional() @IsInt() @Min(1) scheduledMinutes?: number;
  @IsOptional() @IsInt() @Min(0) breakMinutes?: number;
  @IsOptional() @IsInt() @Min(1) @Max(60) roundingUnit?: number;
  @IsOptional() @IsIn(ROUNDING) roundingMethod?: string;
  @IsOptional() @IsObject() overtimeRule?: Record<string, unknown>;
}
class CreatePatternDto {
  @IsString() @MinLength(1) name!: string;
  @IsIn(TYPES) type!: string;
  @IsOptional() @IsObject() rule?: Record<string, unknown>;
  @IsOptional() @ValidateNested() @Type(() => WorkRuleDto) workRule?: WorkRuleDto;
}
class UpdatePatternDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsIn(TYPES) type?: string;
  @IsOptional() @IsObject() rule?: Record<string, unknown>;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

@ApiTags('work-patterns')
@Controller('work-patterns')
class WorkPatternsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermission(Feature.WORK_PATTERN, Action.VIEW)
  list(@CurrentUser() user: AuthUser) {
    return this.prisma.workPattern.findMany({
      where: { orgId: user.orgId },
      include: { workRules: true },
      orderBy: { name: 'asc' },
    });
  }

  @Get(':id')
  @RequirePermission(Feature.WORK_PATTERN, Action.VIEW)
  async get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const pattern = await this.find(user.orgId, id);
    return this.prisma.workPattern.findUnique({
      where: { id: pattern.id },
      include: { workRules: true },
    });
  }

  @Post()
  @RequirePermission(Feature.WORK_PATTERN, Action.MANAGE)
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreatePatternDto) {
    const pattern = await this.prisma.workPattern.create({
      data: {
        orgId: user.orgId,
        name: dto.name,
        type: dto.type,
        rule: (dto.rule ?? {}) as object,
        workRules: {
          create: [
            {
              orgId: user.orgId,
              scheduledMinutes: dto.workRule?.scheduledMinutes ?? 480,
              breakMinutes: dto.workRule?.breakMinutes ?? 60,
              roundingUnit: dto.workRule?.roundingUnit ?? 1,
              roundingMethod: dto.workRule?.roundingMethod ?? 'none',
              overtimeRule: (dto.workRule?.overtimeRule ?? {}) as object,
            },
          ],
        },
      },
      include: { workRules: true },
    });
    await this.audit.record({
      orgId: user.orgId,
      actorId: user.id,
      action: 'workPattern.create',
      target: pattern.id,
    });
    return pattern;
  }

  @Patch(':id')
  @RequirePermission(Feature.WORK_PATTERN, Action.MANAGE)
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePatternDto,
  ) {
    await this.find(user.orgId, id);
    const pattern = await this.prisma.workPattern.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type,
        rule: dto.rule as object | undefined,
        isActive: dto.isActive,
      },
      include: { workRules: true },
    });
    await this.audit.record({
      orgId: user.orgId,
      actorId: user.id,
      action: 'workPattern.update',
      target: id,
    });
    return pattern;
  }

  @Put(':id/rule')
  @ApiOperation({ summary: '就業ルール（所定時間・休憩・丸め・残業区分）を設定' })
  @RequirePermission(Feature.WORK_PATTERN, Action.MANAGE)
  async setRule(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WorkRuleDto,
  ) {
    await this.find(user.orgId, id);
    const existing = await this.prisma.workRule.findFirst({ where: { workPatternId: id } });
    const data = {
      orgId: user.orgId,
      workPatternId: id,
      scheduledMinutes: dto.scheduledMinutes ?? 480,
      breakMinutes: dto.breakMinutes ?? 60,
      roundingUnit: dto.roundingUnit ?? 1,
      roundingMethod: dto.roundingMethod ?? 'none',
      overtimeRule: (dto.overtimeRule ?? {}) as object,
    };
    const rule = existing
      ? await this.prisma.workRule.update({ where: { id: existing.id }, data })
      : await this.prisma.workRule.create({ data });
    await this.audit.record({
      orgId: user.orgId,
      actorId: user.id,
      action: 'workRule.set',
      target: id,
    });
    return rule;
  }

  @Delete(':id')
  @RequirePermission(Feature.WORK_PATTERN, Action.MANAGE)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.find(user.orgId, id);
    const assigned = await this.prisma.userWorkPattern.count({ where: { workPatternId: id } });
    if (assigned > 0) throw BusinessException.validation('割当中の勤務形態は削除できません');
    await this.prisma.workPattern.delete({ where: { id } });
    await this.audit.record({
      orgId: user.orgId,
      actorId: user.id,
      action: 'workPattern.delete',
      target: id,
    });
    return { ok: true };
  }

  private async find(orgId: string, id: string) {
    const p = await this.prisma.workPattern.findUnique({ where: { id } });
    if (!p || p.orgId !== orgId) throw BusinessException.notFound('勤務形態が見つかりません');
    return p;
  }
}

@Module({
  controllers: [WorkPatternsController],
})
export class WorkPatternsModule {}
