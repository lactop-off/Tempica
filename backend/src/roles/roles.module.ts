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
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Action, Feature, Scope } from '../common/constants';
import { BusinessException } from '../common/business-exception';
import { AuthUser, CurrentUser, RequirePermission } from '../common/decorators';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';

class PermissionDto {
  @IsString() feature!: string;
  @IsString() action!: string;
  @IsIn(['self', 'department', 'location', 'org']) scope!: Scope;
}
class CreateRoleDto {
  @IsString() @MinLength(1) name!: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionDto)
  permissions?: PermissionDto[];
}
class UpdateRoleDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionDto)
  permissions?: PermissionDto[];
}
class DuplicateRoleDto {
  @IsString() @MinLength(1) name!: string;
}

@ApiTags('roles')
@Controller('roles')
class RolesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermission(Feature.ROLE, Action.VIEW)
  list(@CurrentUser() user: AuthUser) {
    return this.prisma.role.findMany({ where: { orgId: user.orgId }, orderBy: { name: 'asc' } });
  }

  @Post()
  @RequirePermission(Feature.ROLE, Action.MANAGE)
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateRoleDto) {
    await this.assertUniqueName(user.orgId, dto.name);
    const role = await this.prisma.role.create({
      data: { orgId: user.orgId, name: dto.name, permissions: (dto.permissions ?? []) as object },
    });
    await this.audit.record({
      orgId: user.orgId,
      actorId: user.id,
      action: 'role.create',
      target: role.id,
    });
    return role;
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'テンプレート/既存ロールを複製' })
  @RequirePermission(Feature.ROLE, Action.MANAGE)
  async duplicate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DuplicateRoleDto,
  ) {
    const src = await this.get(user, id);
    await this.assertUniqueName(user.orgId, dto.name);
    const role = await this.prisma.role.create({
      data: {
        orgId: user.orgId,
        name: dto.name,
        isTemplate: false,
        permissions: src.permissions as object,
      },
    });
    await this.audit.record({
      orgId: user.orgId,
      actorId: user.id,
      action: 'role.duplicate',
      target: role.id,
    });
    return role;
  }

  @Patch(':id')
  @RequirePermission(Feature.ROLE, Action.MANAGE)
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    await this.get(user, id);
    if (dto.name) await this.assertUniqueName(user.orgId, dto.name, id);
    // 管理権限ゼロ防止ガード：変更後に role:manage@org を持つアクティブユーザーが居なくなるなら拒否
    await this.prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id },
        data: { name: dto.name, permissions: dto.permissions as object | undefined },
      });
      const admins = await this.rbac.countAdmins(user.orgId);
      if (admins < 1) {
        throw BusinessException.validation('組織の管理権限を持つロールが必要です', [
          { reason: 'last_admin' },
        ]);
      }
    });
    await this.audit.record({
      orgId: user.orgId,
      actorId: user.id,
      action: 'role.update',
      target: id,
    });
    return this.prisma.role.findUnique({ where: { id } });
  }

  @Delete(':id')
  @RequirePermission(Feature.ROLE, Action.MANAGE)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.get(user, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { roleId: id } });
      await tx.role.delete({ where: { id } });
      const admins = await this.rbac.countAdmins(user.orgId);
      if (admins < 1) {
        throw BusinessException.validation('組織の管理権限を持つロールが必要です', [
          { reason: 'last_admin' },
        ]);
      }
    });
    await this.audit.record({
      orgId: user.orgId,
      actorId: user.id,
      action: 'role.delete',
      target: id,
    });
    return { ok: true };
  }

  private async get(user: AuthUser, id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role || role.orgId !== user.orgId)
      throw BusinessException.notFound('ロールが見つかりません');
    return role;
  }

  private async assertUniqueName(orgId: string, name: string, exceptId?: string) {
    const found = await this.prisma.role.findFirst({ where: { orgId, name } });
    if (found && found.id !== exceptId) {
      throw BusinessException.conflict('conflict', 'ロール名は組織内で一意である必要があります');
    }
  }
}

@Module({
  controllers: [RolesController],
})
export class RolesModule {}
