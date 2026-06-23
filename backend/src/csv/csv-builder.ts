/**
 * 汎用 CSV 生成（F-1001）。マッピング設定（項目・並び・整形）に従って
 * 行データから CSV 文字列を構築する純粋ロジック。
 */

export interface CsvColumn {
  column: string; // 出力ヘッダ名
  source: string; // 値のソースキー（例: total.workedMinutes）
  format?: string; // minutes(既定) / hours / hhmm / raw
  order?: number;
}

/** ドット区切りパスでネスト値を取得。 */
function pick(row: Record<string, any>, path: string): any {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), row);
}

export function formatValue(value: any, format?: string): string {
  if (value == null) return '';
  if (format === 'hours' && typeof value === 'number') return (value / 60).toFixed(2);
  if (format === 'hhmm' && typeof value === 'number') {
    const sign = value < 0 ? '-' : '';
    const v = Math.abs(value);
    const h = Math.floor(v / 60);
    const m = v % 60;
    return `${sign}${h}:${String(m).padStart(2, '0')}`;
  }
  return String(value);
}

/** CSV のフィールドエスケープ（RFC 4180 準拠）。 */
export function escapeField(s: string): string {
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildCsv(rows: Record<string, any>[], columns: CsvColumn[]): string {
  const cols = [...columns].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const header = cols.map((c) => escapeField(c.column)).join(',');
  const lines = rows.map((row) =>
    cols.map((c) => escapeField(formatValue(pick(row, c.source), c.format))).join(','),
  );
  return [header, ...lines].join('\r\n');
}
