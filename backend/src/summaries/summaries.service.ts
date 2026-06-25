import { Injectable } from '@nestjs/common';
import { CloseStatus, RoundingMethod, WorkPatternType } from '../common/constants';
import { PrismaService } from '../prisma/prisma.service';
import { CalcRule, computeDailySummary } from './attendance-calc';

/** 勤務日（midnight UTC）と Time 値（1970-01-01Thh:mm:ssZ）を結合した絶対時刻を返す。 */
function combineDateAndTime(dateStr: string, time: Date): Date {
  const hh = String(time.getUTCHours()).padStart(2, '0');
  const mm = String(time.getUTCMinutes()).padStart(2, '0');
  return new Date(`${dateStr}T${hh}:${mm}:00`);
}

/** 日付を [00:00, 翌00:00) の範囲に変換（ローカルタイム基準）。 */
function dayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

@Injectable()
export class SummariesService {
  constructor(private readonly prisma: PrismaService) {}

  /** 指定日にユーザーへ適用される就業ルールを取得（無ければ既定値）。 */
  async resolveRule(userId: string, date: Date): Promise<CalcRule> {
    const dateStr = date.toISOString().slice(0, 10);
    const assignment = await this.prisma.userWorkPattern.findFirst({
      where: {
        userId,
        startDate: { lte: new Date(dateStr) },
        OR: [{ endDate: null }, { endDate: { gte: new Date(dateStr) } }],
      },
      include: { workPattern: { include: { workRules: true } } },
      orderBy: { startDate: 'desc' },
    });
    const workPattern = assignment?.workPattern;
    const wr = workPattern?.workRules[0];
    const rule: CalcRule = {
      scheduledMinutes: wr?.scheduledMinutes ?? 480,
      breakMinutes: wr?.breakMinutes ?? 60,
      roundingUnit: wr?.roundingUnit ?? 1,
      roundingMethod: (wr?.roundingMethod as RoundingMethod) ?? 'none',
    };

    // シフト制の従業員は固定の所定時刻を持たないため、その日の確定シフトを所定時刻・所定分の
    // 基準にする（遅刻・早退・残業はこのシフトに対して判定される）。確定シフトが無ければ既定値。
    if (workPattern?.type === WorkPatternType.SHIFT) {
      const shift = await this.prisma.shift.findUnique({
        where: { userId_shiftDate_kind: { userId, shiftDate: new Date(dateStr), kind: 'planned' } },
      });
      if (shift?.startTime && shift?.endTime) {
        const scheduledStart = combineDateAndTime(dateStr, shift.startTime);
        const scheduledEnd = combineDateAndTime(dateStr, shift.endTime);
        rule.scheduledStart = scheduledStart;
        rule.scheduledEnd = scheduledEnd;
        const span = (scheduledEnd.getTime() - scheduledStart.getTime()) / 60000;
        // 所定分はシフト長から所定休憩を控除（最低0）
        rule.scheduledMinutes = Math.max(0, Math.round(span) - rule.breakMinutes);
      }
    }

    return rule;
  }

  /** 1日分の打刻から日次集計を再計算して upsert する。締め済みは再計算しない。 */
  async recompute(userId: string, date: Date) {
    const { start, end } = dayRange(date);
    const workDate = new Date(start);

    const existing = await this.prisma.dailySummary.findUnique({
      where: { userId_workDate: { userId, workDate } },
    });
    if (existing?.status === CloseStatus.CLOSED) return existing;

    const records = await this.prisma.timeRecord.findMany({
      where: { userId, punchedAt: { gte: start, lt: end } },
      orderBy: { punchedAt: 'asc' },
    });
    const rule = await this.resolveRule(userId, workDate);
    const result = computeDailySummary(
      records.map((r) => ({ punchType: r.punchType, punchedAt: r.punchedAt })),
      rule,
    );

    return this.prisma.dailySummary.upsert({
      where: { userId_workDate: { userId, workDate } },
      create: { userId, workDate, ...result, status: CloseStatus.OPEN },
      update: { ...result },
    });
  }

  async daily(userId: string, from: Date, to: Date) {
    return this.prisma.dailySummary.findMany({
      where: { userId, workDate: { gte: from, lte: to } },
      orderBy: { workDate: 'asc' },
    });
  }

  /** 期間内の日次集計を月次サマリに合算。 */
  async monthly(userId: string, period: string) {
    const from = new Date(`${period}-01T00:00:00`);
    const to = new Date(from);
    to.setMonth(to.getMonth() + 1);
    to.setDate(0);
    const rows = await this.daily(userId, from, to);
    const sum = rows.reduce(
      (acc, r) => ({
        workedMinutes: acc.workedMinutes + r.workedMinutes,
        overtimeMinutes: acc.overtimeMinutes + r.overtimeMinutes,
        lateNightMinutes: acc.lateNightMinutes + r.lateNightMinutes,
        holidayMinutes: acc.holidayMinutes + r.holidayMinutes,
        lateMinutes: acc.lateMinutes + r.lateMinutes,
        earlyLeaveMinutes: acc.earlyLeaveMinutes + r.earlyLeaveMinutes,
      }),
      {
        workedMinutes: 0,
        overtimeMinutes: 0,
        lateNightMinutes: 0,
        holidayMinutes: 0,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
      },
    );
    return { period, userId, days: rows.length, total: sum, daily: rows };
  }
}
