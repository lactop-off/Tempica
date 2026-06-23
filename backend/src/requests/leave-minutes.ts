/**
 * 休暇申請の消化時間（分）を算出する。
 * payload.days / payload.hours / unit から計算。1日 = 所定労働(既定480分)。
 */
export function computeLeaveMinutes(
  payload: Record<string, any>,
  unit: string,
  scheduledMinutes = 480,
): number {
  if (unit === 'hour') {
    const hours = Number(payload.hours ?? 0);
    return Math.round(hours * 60);
  }
  if (unit === 'half') {
    const halves = Number(payload.halfCount ?? (payload.half ? 1 : 0));
    return Math.round(halves * (scheduledMinutes / 2));
  }
  // day
  const days = Number(payload.days ?? 1);
  return Math.round(days * scheduledMinutes);
}
