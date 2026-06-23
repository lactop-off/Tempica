import { Body, Controller, Get, Module, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, ValidateNested } from 'class-validator';
import { Action, Feature, PunchType } from '../common/constants';
import { BusinessException } from '../common/business-exception';
import { AuthUser, CurrentUser, RequirePermission } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { SummariesModule } from '../summaries/summaries.module';
import { SummariesService } from '../summaries/summaries.service';
import { deriveState, validatePunch } from './punch-state';

const PUNCH_TYPES = Object.values(PunchType);

class GeoDto {
  @IsNumber() lat!: number;
  @IsNumber() lng!: number;
}
class PunchDto {
  @IsIn(PUNCH_TYPES) punch_type!: string;
  @IsOptional() @IsIn(['web', 'mobile']) source?: string;
  @IsOptional() @ValidateNested() @Type(() => GeoDto) geo?: GeoDto;
}

@ApiTags('time-records')
@Controller('time-records')
class TimeRecordsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly summaries: SummariesService,
  ) {}

  @Post()
  @ApiOperation({ summary: '打刻（出勤/退勤/休憩）。二重打刻は 409。' })
  @RequirePermission(Feature.ATTENDANCE, Action.CREATE)
  async punch(@CurrentUser() user: AuthUser, @Body() dto: PunchDto) {
    const now = new Date();
    const { start, end } = this.todayRange(now);
    const todays = await this.prisma.timeRecord.findMany({
      where: { userId: user.id, punchedAt: { gte: start, lt: end } },
      orderBy: { punchedAt: 'asc' },
      select: { punchType: true },
    });
    const state = deriveState(todays.map((t) => t.punchType));
    const check = validatePunch(state, dto.punch_type);
    if (!check.ok) {
      throw BusinessException.conflict('double_punch', check.reason ?? '打刻できません');
    }

    const record = await this.prisma.timeRecord.create({
      data: {
        userId: user.id,
        punchType: dto.punch_type,
        punchedAt: now,
        source: dto.source ?? 'web',
        geoLat: dto.geo?.lat,
        geoLng: dto.geo?.lng,
      },
    });
    // 日次集計を即時再計算
    await this.summaries.recompute(user.id, now);
    return { id: record.id, punch_type: record.punchType, punched_at: record.punchedAt };
  }

  @Get()
  @ApiOperation({ summary: '自分の打刻履歴（期間指定可、既定は本日）' })
  @RequirePermission(Feature.ATTENDANCE, Action.VIEW)
  async list(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const now = new Date();
    const range =
      from && to
        ? { gte: new Date(from), lte: new Date(to) }
        : (() => {
            const r = this.todayRange(now);
            return { gte: r.start, lt: r.end };
          })();
    return this.prisma.timeRecord.findMany({
      where: { userId: user.id, punchedAt: range },
      orderBy: { punchedAt: 'asc' },
    });
  }

  private todayRange(now: Date) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }
}

@Module({
  imports: [SummariesModule],
  controllers: [TimeRecordsController],
})
export class TimeRecordsModule {}
