import { deriveState, validatePunch } from './punch-state';

describe('deriveState', () => {
  it('未打刻は out', () => {
    expect(deriveState([])).toBe('out');
  });
  it('出勤後は in', () => {
    expect(deriveState(['clock_in'])).toBe('in');
  });
  it('休憩中は break', () => {
    expect(deriveState(['clock_in', 'break_start'])).toBe('break');
  });
  it('休憩終了で in に戻る', () => {
    expect(deriveState(['clock_in', 'break_start', 'break_end'])).toBe('in');
  });
  it('退勤後は out', () => {
    expect(deriveState(['clock_in', 'clock_out'])).toBe('out');
  });
});

describe('validatePunch（二重打刻防止）', () => {
  it('退勤前の再出勤は不可', () => {
    expect(validatePunch('in', 'clock_in').ok).toBe(false);
  });
  it('出勤していなければ退勤不可', () => {
    expect(validatePunch('out', 'clock_out').ok).toBe(false);
  });
  it('出勤中なら休憩開始可', () => {
    expect(validatePunch('in', 'break_start').ok).toBe(true);
  });
  it('休憩中でなければ休憩終了不可', () => {
    expect(validatePunch('in', 'break_end').ok).toBe(false);
  });
  it('正常な出勤は可', () => {
    expect(validatePunch('out', 'clock_in').ok).toBe(true);
  });
});
