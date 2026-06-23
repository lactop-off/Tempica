import { computeDailySummary, roundMinutes } from './attendance-calc';

const at = (h: number, m = 0) => new Date(2026, 5, 23, h, m, 0); // 2026-06-23 ローカル

describe('roundMinutes', () => {
  it('none はそのまま（四捨五入のみ）', () => {
    expect(roundMinutes(67.4, 1, 'none')).toBe(67);
  });
  it('up は単位で切り上げ', () => {
    expect(roundMinutes(61, 15, 'up')).toBe(75);
  });
  it('down は単位で切り捨て', () => {
    expect(roundMinutes(74, 15, 'down')).toBe(60);
  });
  it('nearest は単位で四捨五入', () => {
    expect(roundMinutes(68, 15, 'nearest')).toBe(75);
    expect(roundMinutes(67, 15, 'nearest')).toBe(60);
  });
});

describe('computeDailySummary', () => {
  const rule = {
    scheduledMinutes: 480,
    breakMinutes: 60,
    roundingUnit: 1,
    roundingMethod: 'none' as const,
  };

  it('9-18 勤務・休憩1hで実働480分・残業0', () => {
    const r = computeDailySummary(
      [
        { punchType: 'clock_in', punchedAt: at(9) },
        { punchType: 'break_start', punchedAt: at(12) },
        { punchType: 'break_end', punchedAt: at(13) },
        { punchType: 'clock_out', punchedAt: at(18) },
      ],
      rule,
    );
    expect(r.workedMinutes).toBe(480);
    expect(r.overtimeMinutes).toBe(0);
  });

  it('所定超過は残業に計上', () => {
    const r = computeDailySummary(
      [
        { punchType: 'clock_in', punchedAt: at(9) },
        { punchType: 'break_start', punchedAt: at(12) },
        { punchType: 'break_end', punchedAt: at(13) },
        { punchType: 'clock_out', punchedAt: at(20) },
      ],
      rule,
    );
    expect(r.workedMinutes).toBe(600); // 11h - 1h = 10h
    expect(r.overtimeMinutes).toBe(120); // 600 - 480
  });

  it('深夜帯（22-翌5時）を集計', () => {
    const r = computeDailySummary(
      [
        { punchType: 'clock_in', punchedAt: at(20) },
        { punchType: 'clock_out', punchedAt: new Date(2026, 5, 24, 1, 0) }, // 翌1:00
      ],
      rule,
    );
    // 22:00-翌1:00 = 180分が深夜
    expect(r.lateNightMinutes).toBe(180);
  });

  it('丸め単位15分・nearest を実働に適用', () => {
    const r = computeDailySummary(
      [
        { punchType: 'clock_in', punchedAt: at(9) },
        { punchType: 'clock_out', punchedAt: at(17, 7) }, // 8h7m
      ],
      { ...rule, roundingUnit: 15, roundingMethod: 'nearest' },
    );
    expect(r.workedMinutes).toBe(480); // 487 -> 480
  });

  it('休日労働は holidayMinutes に計上し残業は0', () => {
    const r = computeDailySummary(
      [
        { punchType: 'clock_in', punchedAt: at(9) },
        { punchType: 'clock_out', punchedAt: at(15) },
      ],
      { ...rule, isHoliday: true },
    );
    expect(r.holidayMinutes).toBe(360);
    expect(r.overtimeMinutes).toBe(0);
  });

  it('所定始業より遅い出勤は遅刻分を計上', () => {
    const r = computeDailySummary(
      [
        { punchType: 'clock_in', punchedAt: at(9, 30) },
        { punchType: 'clock_out', punchedAt: at(18) },
      ],
      { ...rule, scheduledStart: at(9) },
    );
    expect(r.lateMinutes).toBe(30);
  });
});
