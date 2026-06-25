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
import { IsString, MinLength } from 'class-validator';
import { Action, Feature } from '../common/constants';
import { BusinessException } from '../common/business-exception';
import { AuthUser, CurrentUser, RequirePermission } from '../common/decorators';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

class EmploymentTypeDto {
  @IsString() @MinLength(1) name!: string;
}

/**
 * 雇用区分（正社員 / 契約 / パート 等）の組織マスタ。メンバー作成時に割り当てる。
 * 参照は member 閲覧者まで広く、編集は組織管理者に限定する。
 */
@ApiTags('employment-types')
@Controller('employment-types')
class EmploymentTypesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermission(Feature.MEMBER, Action.VIEW)
  list(@CurrentUser() user: AuthUser) {
    return this.prisma.employmentType.findMany({
      where: { orgId: user.orgId },
      orderBy: { name: 'asc' },
    });
  }

  @Post()
  @RequirePermission(Feature.ORGANIZATION, Action.MANAGE)
  async create(@CurrentUser() user: AuthUser, @Body() dto: EmploymentTypeDto) {
    const t = await this.prisma.employmentType.create({
      data: { orgId: user.orgId, name: dto.name },
    });
    await this.audit.record({
      orgId: user.orgId,
      actorId: user.id,
      action: 'employmentType.create',
      target: t.id,
    });
    return t;
  }

  @Patch(':id')
  @RequirePermission(Feature.ORGANIZATION, Action.MANAGE)
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EmploymentTypeDto,
  ) {
    await this.find(user.orgId, id);
    const t = await this.prisma.employmentType.update({ where: { id }, data: { name: dto.name } });
    await this.audit.record({
      orgId: user.orgId,
      actorId: user.id,
      action: 'employmentType.update',
      target: id,
    });
    return t;
  }

  @Delete(':id')
  @RequirePermission(Feature.ORGANIZATION, Action.MANAGE)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.find(user.orgId, id);
    const used = await this.prisma.appUser.count({ where: { employmentTypeId: id } });
    if (used > 0)
      throw BusinessException.validation('この雇用区分に所属するメンバーがいるため削除できません');
    await this.prisma.employmentType.delete({ where: { id } });
    await this.audit.record({
      orgId: user.orgId,
      actorId: user.id,
      action: 'employmentType.delete',
      target: id,
    });
    return { ok: true };
  }

  private async find(orgId: string, id: string) {
    const t = await this.prisma.employmentType.findUnique({ where: { id } });
    if (!t || t.orgId !== orgId) throw BusinessException.notFound('雇用区分が見つかりません');
    return t;
  }
}

@Module({
  controllers: [EmploymentTypesController],
})
export class EmploymentTypesModule {}
