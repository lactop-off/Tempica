// 最小の className 結合ユーティリティ（外部依存なし）。
export function clsx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
