// 表示整形ヘルパー。

/** 分 → "H:MM"（労働時間・残数表示用）。 */
export function hhmm(minutes: number | undefined | null): string {
  if (minutes == null) return '0:00';
  const sign = minutes < 0 ? '-' : '';
  const v = Math.abs(Math.round(minutes));
  const h = Math.floor(v / 60);
  const m = v % 60;
  return `${sign}${h}:${String(m).padStart(2, '0')}`;
}

/** 分 → "N.N日"（所定480分=1日換算）。 */
export function days(minutes: number, scheduled = 480): string {
  return (minutes / scheduled).toFixed(1);
}

/** ISO日時 → "HH:MM"。 */
export function clockTime(iso: string | undefined): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** ISO/Date → "YYYY-MM-DD"。 */
export function ymd(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

/** "YYYY-MM"。 */
export function ym(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const REQUEST_TYPE_LABEL: Record<string, string> = {
  punch_fix: '打刻修正',
  overtime: '残業',
  late_early: '遅刻・早退',
  leave: '休暇',
  direct: '直行直帰',
  business_trip: '出張',
};

export const REQUEST_STATUS_LABEL: Record<string, string> = {
  pending: '承認待ち',
  approved: '承認済み',
  rejected: '差戻し',
  canceled: '取消',
};

export const PUNCH_LABEL: Record<string, string> = {
  clock_in: '出勤',
  clock_out: '退勤',
  break_start: '休憩開始',
  break_end: '休憩終了',
};
