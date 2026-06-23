import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { Action, Feature } from '../common/constants';
import { BusinessException } from '../common/business-exception';
import { AuthUser, CurrentUser, RequirePermission, ResolvedScope } from '../common/decorators';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

class CreateUserDto {
  @IsString() @MinLength(1) name!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsOptional() @IsUUID() deptId?: string;
  @IsOptional() @IsUUID() employmentTypeId?: string;
  @IsOptional() @IsString() employeeCode?: string;
  @IsOptional() @IsArray() roleIds?: string[];
}
class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsUUID() deptId?: string;
  @IsOptional() @IsUUID() employmentTypeId?: string;
  @IsOptional() @IsString() employeeCode?: string;
  @IsOptional() @IsIn(['active', 'suspended', 'retired']) status?: string;
  @IsOptional() @IsArray() roleIds?: string[];
}
class AssignWorkPatternDto {
  @IsUUID() workPatternId!: string;
  @IsDateString() startDate!: string;
  @IsOptional() @IsDateString() endDate?: string;
}

const publicUser = {
  id: true,
  orgId: true,
  deptId: true,
  employmentTypeId: true,
  email: true,
  name: true,
  employeeCode: true,
  status: true,
  hiredOn: true,
  retiredOn: true,
} as const;

@ApiTags('members')
@Controller('users')
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermission(Feature.MEMBER, Action.VIEW)
  list(
    @CurrentUser() user: AuthUser,
    @ResolvedScope() rs: { scope: any; accessibleDeptIds?: string[] },
  ) {
    return this.prisma.appUser.findMany({
      where: this.users.buildScopeWhere(user.orgId, user.id, rs),
      select: { ...publicUser, roles: { select: { roleId: true } } },
      orderBy: { name: 'asc' },
    });
  }

  @Get(':id')
  @RequirePermission(Feature.MEMBER, Action.VIEW)
  async get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.users.assertSameOrg(user.orgId, id);
    return this.prisma.appUser.findUnique({
      where: { id },
      select: { ...publicUser, roles: { select: { roleId: true } } },
    });
  }

  @Post()
  @RequirePermission(Feature.MEMBER, Action.CREATE)
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    const dup = await this.prisma.appUser.findFirst({
      where: { orgId: user.orgId, email: dto.email },
    });
    if (dup) throw BusinessException.conflict('conflict', 'このメールアドレスは既に使われています');
    const passwordHash = await AuthService.hashPassword(dto.password);
    const created = await this.prisma.appUser.create({
      data: {
        orgId: user.orgId,
        email: dto.email,
        passwordHash,
        name: dto.name,
        deptId: dto.deptId,
        employmentTypeId: dto.employmentTypeId,
        employeeCode: dto.employeeCode,
        roles: dto.roleIds?.length
          ? { create: dto.roleIds.map((roleId) => ({ roleId })) }
          : undefined,
      },
      select: publicUser,
    });
    await this.audit.record({
      orgId: user.orgId,
      actorId: user.id,
      action: 'member.create',
      target: created.id,
    });
    return created;
  }

  @Patch(':id')
  @RequirePermission(Feature.MEMBER, Action.EDIT)
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    await this.users.assertSameOrg(user.orgId, id);
    const { roleIds, ...rest } = dto;
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.appUser.update({
        where: { id },
        data: {
          ...rest,
          retiredOn: dto.status === 'retired' ? new Date() : undefined,
        },
        select: publicUser,
      });
      if (roleIds) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        if (roleIds.length) {
          await tx.userRole.createMany({ data: roleIds.map((roleId) => ({ userId: id, roleId })) });
        }
      }
      return u;
    });
    await this.audit.record({
      orgId: user.orgId,
      actorId: user.id,
      action: 'member.update',
      target: id,
    });
    return updated;
  }

  @Get(':id/work-patterns')
  @ApiOperation({ summary: '個人の勤務形態割当履歴' })
  @RequirePermission(Feature.MEMBER, Action.VIEW)
  async listWorkPatterns(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.users.assertSameOrg(user.orgId, id);
    return this.prisma.userWorkPattern.findMany({
      where: { userId: id },
      include: { workPattern: true },
      orderBy: { startDate: 'desc' },
    });
  }

  @Post(':id/work-patterns')
  @ApiOperation({ summary: '勤務形態を個人へ割当（有効期間つき・重複不可）' })
  @RequirePermission(Feature.WORK_PATTERN, Action.MANAGE)
  assignWorkPattern(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignWorkPatternDto,
  ) {
    return this.users.assignWorkPattern(user.orgId, user.id, id, dto);
  }
}
