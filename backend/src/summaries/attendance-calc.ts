import { PunchType, RoundingMethod } from '../common/constants';

export interface PunchInput {
  punchType: string;
  punchedAt: Date;
}

export interface CalcRule {
  scheduledMinutes: number;
  /** 所定休憩（実打刻が無い場合のフォールバックには使わない。実打刻優先） */
  breakMinutes: number;
  roundingUnit: number; // 1〜60
  roundingMethod: RoundingMethod;
  /** 深夜帯（既定 22:00〜翌5:00） */
  nightStartHour?: number;
  nightEndHour?: number;
  /** 法定/所定休日か */
  isHoliday?: boolean;
  /** 所定始業・終業（遅刻・早退判定に使用。未指定なら判定しない） */
  scheduledStart?: Date;
  scheduledEnd?: Date;
}

export interface DailyCalcResult {
  workedMinutes: number;
  overtimeMinutes: number;
  lateNightMinutes: number;
  holidayMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
}

/** 時間（分）を丸め単位・方法で丸める。 */
export function roundMinutes(minutes: number, unit: number, method: RoundingMethod): number {
  if (unit <= 1 || method === 'none') return Math.round(minutes);
  const q = minutes / unit;
  switch (method) {
    case 'up':
      return Math.ceil(q) * unit;
    case 'down':
      return Math.floor(q) * unit;
    case 'nearest':
      return Math.round(q) * unit;
    default:
      return Math.round(minutes);
  }
}

interface Interval {
  start: Date;
  end: Date;
}

/** 打刻列から [clock_in, clock_out] / [break_start, break_end] の区間を構築する。 */
function buildIntervals(punches: PunchInput[]): { work: Interval[]; breaks: Interval[] } {
  const sorted = [...punches].sort((a, b) => a.punchedAt.getTime() - b.punchedAt.getTime());
  const work: Interval[] = [];
  const breaks: Interval[] = [];
  let workStart: Date | null = null;
  let breakStart: Date | null = null;

  for (const p of sorted) {
    switch (p.punchType) {
      case PunchType.CLOCK_IN:
        workStart = p.punchedAt;
        break;
      case PunchType.CLOCK_OUT:
        if (workStart) {
          work.push({ start: workStart, end: p.punchedAt });
          workStart = null;
        }
        break;
      case PunchType.BREAK_START:
        breakStart = p.punchedAt;
        break;
      case PunchType.BREAK_END:
        if (breakStart) {
          breaks.push({ start: breakStart, end: p.punchedAt });
          breakStart = null;
        }
        break;
    }
  }
  return { work, breaks };
}

function durationMin(i: Interval): number {
  return Math.max(0, (i.end.getTime() - i.start.getTime()) / 60000);
}

/** 区間 [s,e) と [ws,we) の重なり（分）。 */
function overlapMin(s: Date, e: Date, ws: Date, we: Date): number {
  const start = Math.max(s.getTime(), ws.getTime());
  const end = Math.min(e.getTime(), we.getTime());
  return Math.max(0, (end - start) / 60000);
}

/** ある暦日 d の深夜帯（前日分の翌5:00 と当日22:00〜翌5:00）と区間の重なりを計算。 */
function nightOverlap(i: Interval, nightStartHour: number, nightEndHour: number): number {
  let total = 0;
  // 区間がまたぐ可能性のある各日について、その日の [00:00, endHour) と [startHour, 24:00) を評価
  const dayStart = new Date(i.start);
  dayStart.setHours(0, 0, 0, 0);
  for (let offset = 0; offset <= 2; offset++) {
    const base = new Date(dayStart);
    base.setDate(base.getDate() + offset);
    // 早朝帯 [00:00, nightEndHour)
    const earlyStart = new Date(base);
    earlyStart.setHours(0, 0, 0, 0);
    const earlyEnd = new Date(base);
    earlyEnd.setHours(nightEndHour, 0, 0, 0);
    total += overlapMin(i.start, i.end, earlyStart, earlyEnd);
    // 深夜帯 [nightStartHour, 24:00)
    const lateStart = new Date(base);
    lateStart.setHours(nightStartHour, 0, 0, 0);
    const lateEnd = new Date(base);
    lateEnd.setDate(lateEnd.getDate() + 1);
    lateEnd.setHours(0, 0, 0, 0);
    total += overlapMin(i.start, i.end, lateStart, lateEnd);
  }
  return total;
}

/**
 * 1日の打刻列と就業ルールから日次集計を計算する。
 * 労働時間 = Σ(出勤〜退勤) − Σ(休憩)。残業 = max(0, 労働 − 所定)。
 */
export function computeDailySummary(punches: PunchInput[], rule: CalcRule): DailyCalcResult {
  const { work, breaks } = buildIntervals(punches);
  const nightStartHour = rule.nightStartHour ?? 22;
  const nightEndHour = rule.nightEndHour ?? 5;

  const grossWork = work.reduce((s, i) => s + durationMin(i), 0);
  const breakTotal = breaks.reduce((s, i) => s + durationMin(i), 0);
  const rawWorked = Math.max(0, grossWork - breakTotal);

  const workedMinutes = roundMinutes(rawWorked, rule.roundingUnit, rule.roundingMethod);

  // 深夜：労働区間の深夜重なりから、その区間に含まれる休憩の深夜重なりを差し引く
  let nightWork = 0;
  for (const w of work) nightWork += nightOverlap(w, nightStartHour, nightEndHour);
  for (const b of breaks) nightWork -= nightOverlap(b, nightStartHour, nightEndHour);
  const lateNightMinutes = Math.max(0, Math.round(nightWork));

  const holidayMinutes = rule.isHoliday ? workedMinutes : 0;
  // 休日労働は全量が残業外として別管理。平日のみ所定超過を残業に計上。
  const overtimeMinutes = rule.isHoliday ? 0 : Math.max(0, workedMinutes - rule.scheduledMinutes);

  let lateMinutes = 0;
  let earlyLeaveMinutes = 0;
  const firstIn = work[0]?.start;
  const lastOut = work[work.length - 1]?.end;
  if (rule.scheduledStart && firstIn && firstIn.getTime() > rule.scheduledStart.getTime()) {
    lateMinutes = roundMinutes(
      (firstIn.getTime() - rule.scheduledStart.getTime()) / 60000,
      rule.roundingUnit,
      rule.roundingMethod,
    );
  }
  if (rule.scheduledEnd && lastOut && lastOut.getTime() < rule.scheduledEnd.getTime()) {
    earlyLeaveMinutes = roundMinutes(
      (rule.scheduledEnd.getTime() - lastOut.getTime()) / 60000,
      rule.roundingUnit,
      rule.roundingMethod,
    );
  }

  return {
    workedMinutes,
    overtimeMinutes,
    lateNightMinutes,
    holidayMinutes,
    lateMinutes,
    earlyLeaveMinutes,
  };
}
