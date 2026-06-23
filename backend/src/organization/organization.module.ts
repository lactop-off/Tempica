import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { Action, Feature } from '../common/constants';
import { BusinessException } from '../common/business-exception';
import { AuthUser, CurrentUser, RequirePermission } from '../common/decorators';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

class UpdateOrgDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsObject() settings?: Record<string, unknown>;
}

@ApiTags('organization')
@Controller('organization')
class OrganizationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermission(Feature.ORGANIZATION, Action.VIEW)
  async get(@CurrentUser() user: AuthUser) {
    const org = await this.prisma.organization.findUnique({ where: { id: user.orgId } });
    if (!org) throw BusinessException.notFound('組織が見つかりません');
    return org;
  }

  @Patch()
  @RequirePermission(Feature.ORGANIZATION, Action.MANAGE)
  async update(@CurrentUser() user: AuthUser, @Body() dto: UpdateOrgDto) {
    const org = await this.prisma.organization.update({
      where: { id: user.orgId },
      data: { name: dto.name, settings: dto.settings as object | undefined },
    });
    await this.audit.record({
      orgId: user.orgId,
      actorId: user.id,
      action: 'organization.update',
      target: org.id,
      detail: dto as object,
    });
    return org;
  }
}

@Module({
  controllers: [OrganizationController],
})
export class OrganizationModule {}
