import { buildCsv, escapeField, formatValue } from './csv-builder';

describe('formatValue', () => {
  it('minutes 既定はそのまま', () => {
    expect(formatValue(480)).toBe('480');
  });
  it('hours は時間換算（小数2桁）', () => {
    expect(formatValue(90, 'hours')).toBe('1.50');
  });
  it('hhmm は H:MM 形式', () => {
    expect(formatValue(485, 'hhmm')).toBe('8:05');
  });
  it('null は空文字', () => {
    expect(formatValue(null, 'hhmm')).toBe('');
  });
});

describe('escapeField', () => {
  it('カンマ・引用符を含む値はクオートしエスケープ', () => {
    expect(escapeField('a,"b"')).toBe('"a,""b"""');
  });
});

describe('buildCsv', () => {
  it('order に従い列を並べ、ヘッダ + 行を生成', () => {
    const rows = [{ name: '山田', total: { workedMinutes: 480 } }];
    const csv = buildCsv(rows, [
      { column: '労働', source: 'total.workedMinutes', format: 'hhmm', order: 2 },
      { column: '氏名', source: 'name', format: 'raw', order: 1 },
    ]);
    expect(csv).toBe('氏名,労働\r\n山田,8:00');
  });
});
