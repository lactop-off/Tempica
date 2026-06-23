import { periodsOverlap } from './users.service';

const d = (s: string) => new Date(s);

describe('periodsOverlap（勤務形態割当の期間重複）', () => {
  it('完全に分離した期間は重複しない', () => {
    expect(periodsOverlap(d('2026-01-01'), d('2026-03-31'), d('2026-04-01'), d('2026-06-30'))).toBe(
      false,
    );
  });
  it('境界が接する期間は重複（inclusive）', () => {
    expect(periodsOverlap(d('2026-01-01'), d('2026-03-31'), d('2026-03-31'), d('2026-06-30'))).toBe(
      true,
    );
  });
  it('包含関係は重複', () => {
    expect(periodsOverlap(d('2026-01-01'), d('2026-12-31'), d('2026-05-01'), d('2026-06-30'))).toBe(
      true,
    );
  });
  it('終了日 null（無限）は以降すべてと重複', () => {
    expect(periodsOverlap(d('2026-01-01'), null, d('2030-01-01'), null)).toBe(true);
  });
  it('片方が無限でも開始前なら重複しない', () => {
    expect(periodsOverlap(d('2026-06-01'), null, d('2026-01-01'), d('2026-05-31'))).toBe(false);
  });
});
