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
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { Response } from 'express';
import { Action, Feature } from '../common/constants';
import { BusinessException } from '../common/business-exception';
import { AuthUser, CurrentUser, RequirePermission } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { SummariesModule } from '../summaries/summaries.module';
import { CsvService } from './csv.service';

class MappingDto {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsArray() mapping?: any[];
  @IsOptional() @IsIn(['utf-8', 'shift_jis']) encoding?: string;
}

@ApiTags('csv')
@Controller()
class CsvController {
  constructor(
    private readonly service: CsvService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('csv-mappings')
  @RequirePermission(Feature.CSV, Action.MANAGE)
  listMappings(@CurrentUser() user: AuthUser) {
    return this.prisma.csvMapping.findMany({
      where: { orgId: user.orgId },
      orderBy: { name: 'asc' },
    });
  }

  @Post('csv-mappings')
  @RequirePermission(Feature.CSV, Action.MANAGE)
  createMapping(@CurrentUser() user: AuthUser, @Body() dto: MappingDto) {
    return this.prisma.csvMapping.create({
      data: {
        orgId: user.orgId,
        name: dto.name,
        mapping: (dto.mapping ?? []) as object,
        encoding: dto.encoding ?? 'utf-8',
      },
    });
  }

  @Patch('csv-mappings/:id')
  @RequirePermission(Feature.CSV, Action.MANAGE)
  async updateMapping(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MappingDto,
  ) {
    await this.findMapping(user.orgId, id);
    return this.prisma.csvMapping.update({
      where: { id },
      data: { name: dto.name, mapping: dto.mapping as object | undefined, encoding: dto.encoding },
    });
  }

  @Delete('csv-mappings/:id')
  @RequirePermission(Feature.CSV, Action.MANAGE)
  async removeMapping(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.findMapping(user.orgId, id);
    await this.prisma.csvMapping.delete({ where: { id } });
    return { ok: true };
  }

  @Get('exports/csv')
  @ApiOperation({ summary: '勤怠 CSV 出力（マッピング・エンコーディング適用）' })
  @RequirePermission(Feature.CSV, Action.MANAGE)
  async export(
    @CurrentUser() user: AuthUser,
    @Query('period') period: string,
    @Res() res: Response,
    @Query('mapping_id') mappingId?: string,
  ) {
    if (!/^\d{4}-\d{2}$/.test(period ?? '')) {
      throw BusinessException.validation('period は YYYY-MM 形式で指定してください');
    }
    const { buffer, contentType, filename } = await this.service.export(
      user.orgId,
      user.id,
      period,
      mappingId,
    );
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  private async findMapping(orgId: string, id: string) {
    const m = await this.prisma.csvMapping.findUnique({ where: { id } });
    if (!m || m.orgId !== orgId) throw BusinessException.notFound('CSVマッピングが見つかりません');
    return m;
  }
}

@Module({
  imports: [SummariesModule],
  controllers: [CsvController],
  providers: [CsvService],
})
export class CsvModule {}
