import { PunchType } from '../common/constants';

export type PunchState = 'out' | 'in' | 'break';

/** 当日の打刻列から現在状態を求める。 */
export function deriveState(punchTypes: string[]): PunchState {
  let state: PunchState = 'out';
  for (const t of punchTypes) {
    switch (t) {
      case PunchType.CLOCK_IN:
        state = 'in';
        break;
      case PunchType.CLOCK_OUT:
        state = 'out';
        break;
      case PunchType.BREAK_START:
        if (state === 'in') state = 'break';
        break;
      case PunchType.BREAK_END:
        if (state === 'break') state = 'in';
        break;
    }
  }
  return state;
}

/**
 * 新しい打刻が現在状態に対して妥当か検証する（二重打刻防止）。
 * 不正なら理由を返す。
 */
export function validatePunch(state: PunchState, next: string): { ok: boolean; reason?: string } {
  switch (next) {
    case PunchType.CLOCK_IN:
      return state === 'out' ? { ok: true } : { ok: false, reason: '既に出勤済みです' };
    case PunchType.CLOCK_OUT:
      return state === 'in' || state === 'break'
        ? { ok: true }
        : { ok: false, reason: '出勤していません' };
    case PunchType.BREAK_START:
      return state === 'in'
        ? { ok: true }
        : { ok: false, reason: '休憩を開始できる状態ではありません' };
    case PunchType.BREAK_END:
      return state === 'break' ? { ok: true } : { ok: false, reason: '休憩中ではありません' };
    default:
      return { ok: false, reason: '不正な打刻種別です' };
  }
}
