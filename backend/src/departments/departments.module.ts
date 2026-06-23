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
import { ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { Action, Feature } from '../common/constants';
import { BusinessException } from '../common/business-exception';
import { AuthUser, CurrentUser, RequirePermission } from '../common/decorators';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

class CreateDeptDto {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @IsIn(['location', 'department', 'group']) kind?: string;
  @IsOptional() @IsInt() sortOrder?: number;
}
class UpdateDeptDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @IsIn(['location', 'department', 'group']) kind?: string;
  @IsOptional() @IsInt() sortOrder?: number;
}

@ApiTags('departments')
@Controller('departments')
class DepartmentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermission(Feature.DEPARTMENT, Action.VIEW)
  list(@CurrentUser() user: AuthUser) {
    return this.prisma.department.findMany({
      where: { orgId: user.orgId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  @Post()
  @RequirePermission(Feature.DEPARTMENT, Action.MANAGE)
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateDeptDto) {
    if (dto.parentId) await this.assertSameOrg(user.orgId, dto.parentId);
    const dept = await this.prisma.department.create({
      data: {
        orgId: user.orgId,
        name: dto.name,
        parentId: dto.parentId,
        kind: dto.kind ?? 'department',
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    await this.audit.record({
      orgId: user.orgId,
      actorId: user.id,
      action: 'department.create',
      target: dept.id,
    });
    return dept;
  }

  @Patch(':id')
  @RequirePermission(Feature.DEPARTMENT, Action.MANAGE)
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeptDto,
  ) {
    await this.assertSameOrg(user.orgId, id);
    if (dto.parentId) {
      if (dto.parentId === id) throw BusinessException.validation('自分自身を親に指定できません');
      await this.assertSameOrg(user.orgId, dto.parentId);
    }
    const dept = await this.prisma.department.update({ where: { id }, data: dto });
    await this.audit.record({
      orgId: user.orgId,
      actorId: user.id,
      action: 'department.update',
      target: id,
    });
    return dept;
  }

  @Delete(':id')
  @RequirePermission(Feature.DEPARTMENT, Action.MANAGE)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.assertSameOrg(user.orgId, id);
    const childCount = await this.prisma.department.count({ where: { parentId: id } });
    if (childCount > 0) throw BusinessException.validation('子部署が存在するため削除できません');
    const userCount = await this.prisma.appUser.count({ where: { deptId: id } });
    if (userCount > 0)
      throw BusinessException.validation('所属メンバーが存在するため削除できません');
    await this.prisma.department.delete({ where: { id } });
    await this.audit.record({
      orgId: user.orgId,
      actorId: user.id,
      action: 'department.delete',
      target: id,
    });
    return { ok: true };
  }

  private async assertSameOrg(orgId: string, deptId: string) {
    const d = await this.prisma.department.findUnique({ where: { id: deptId } });
    if (!d || d.orgId !== orgId) throw BusinessException.notFound('部署が見つかりません');
  }
}

@Module({
  controllers: [DepartmentsController],
})
export class DepartmentsModule {}
