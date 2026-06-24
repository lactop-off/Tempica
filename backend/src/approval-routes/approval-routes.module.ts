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
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Action, Feature, RequestType } from '../common/constants';
import { BusinessException } from '../common/business-exception';
import { AuthUser, CurrentUser, RequirePermission } from '../common/decorators';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

const APPLIES = ['all', ...Object.values(RequestType)];

class StepDto {
  @IsInt() step!: number;
  @IsIn(['user', 'manager', 'any']) approver_type!: string;
  @IsOptional() @IsString() approver_ref?: string; // approver_type='user' のとき user_id
}
class CreateRouteDto {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsIn(APPLIES) appliesTo?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => StepDto) steps!: StepDto[];
}
class UpdateRouteDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsIn(APPLIES) appliesTo?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => StepDto) steps?: StepDto[];
}

@ApiTags('approval-routes')
@Controller('approval-routes')
class ApprovalRoutesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermission(Feature.ORGANIZATION, Action.VIEW)
  list(@CurrentUser() user: AuthUser) {
    return this.prisma.approvalRoute.findMany({
      where: { orgId: user.orgId },
      orderBy: { name: 'asc' },
    });
  }

  @Post()
  @RequirePermission(Feature.ORGANIZATION, Action.MANAGE)
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateRouteDto) {
    const route = await this.prisma.approvalRoute.create({
      data: {
        orgId: user.orgId,
        name: dto.name,
        appliesTo: dto.appliesTo ?? 'all',
        steps: dto.steps as unknown as object,
      },
    });
    await this.audit.record({
      orgId: user.orgId,
      actorId: user.id,
      action: 'approvalRoute.create',
      target: route.id,
    });
    return route;
  }

  @Patch(':id')
  @RequirePermission(Feature.ORGANIZATION, Action.MANAGE)
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRouteDto,
  ) {
    await this.find(user.orgId, id);
    const route = await this.prisma.approvalRoute.update({
      where: { id },
      data: {
        name: dto.name,
        appliesTo: dto.appliesTo,
        steps: dto.steps as unknown as object | undefined,
      },
    });
    await this.audit.record({
      orgId: user.orgId,
      actorId: user.id,
      action: 'approvalRoute.update',
      target: id,
    });
    return route;
  }

  @Delete(':id')
  @RequirePermission(Feature.ORGANIZATION, Action.MANAGE)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.find(user.orgId, id);
    await this.prisma.approvalRoute.delete({ where: { id } });
    await this.audit.record({
      orgId: user.orgId,
      actorId: user.id,
      action: 'approvalRoute.delete',
      target: id,
    });
    return { ok: true };
  }

  private async find(orgId: string, id: string) {
    const r = await this.prisma.approvalRoute.findUnique({ where: { id } });
    if (!r || r.orgId !== orgId) throw BusinessException.notFound('承認経路が見つかりません');
    return r;
  }
}

@Module({
  controllers: [ApprovalRoutesController],
})
export class ApprovalRoutesModule {}
