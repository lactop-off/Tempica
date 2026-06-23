import { Injectable } from '@nestjs/common';
import * as iconv from 'iconv-lite';
import { BusinessException } from '../common/business-exception';
import { CloseStatus } from '../common/constants';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { SummariesService } from '../summaries/summaries.service';
import { buildCsv, CsvColumn } from './csv-builder';

/** mapping 未指定時の既定カラム（給与システム向けの最小セット）。 */
const DEFAULT_COLUMNS: CsvColumn[] = [
  { column: '社員コード', source: 'employeeCode', format: 'raw', order: 1 },
  { column: '氏名', source: 'name', format: 'raw', order: 2 },
  { column: '対象月', source: 'period', format: 'raw', order: 3 },
  { column: '労働時間', source: 'total.workedMinutes', format: 'hhmm', order: 4 },
  { column: '残業時間', source: 'total.overtimeMinutes', format: 'hhmm', order: 5 },
  { column: '深夜時間', source: 'total.lateNightMinutes', format: 'hhmm', order: 6 },
  { column: '休日時間', source: 'total.holidayMinutes', format: 'hhmm', order: 7 },
  { column: '遅刻', source: 'total.lateMinutes', format: 'hhmm', order: 8 },
  { column: '早退', source: 'total.earlyLeaveMinutes', format: 'hhmm', order: 9 },
];

@Injectable()
export class CsvService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly summaries: SummariesService,
    private readonly audit: AuditService,
  ) {}

  async export(orgId: string, actorId: string, period: string, mappingId?: string) {
    let columns = DEFAULT_COLUMNS;
    let encoding = 'utf-8';
    if (mappingId) {
      const mapping = await this.prisma.csvMapping.findUnique({ where: { id: mappingId } });
      if (!mapping || mapping.orgId !== orgId) {
        throw BusinessException.notFound('CSVマッピングが見つかりません');
      }
      const cols = mapping.mapping as unknown as CsvColumn[];
      if (Array.isArray(cols) && cols.length) columns = cols;
      encoding = mapping.encoding;
    }

    // 未締めデータ混在チェック（組織設定で許可されていなければ 409）
    const close = await this.prisma.monthlyClose.findUnique({
      where: { orgId_period: { orgId, period } },
    });
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    const allowUnclosed = (org?.settings as any)?.csvAllowUnclosed === true;
    if (close?.status !== CloseStatus.CLOSED && !allowUnclosed) {
      throw BusinessException.conflict('period_not_closed', '未締めのデータが含まれています', [
        { reason: 'period_not_closed' },
      ]);
    }

    const users = await this.prisma.appUser.findMany({
      where: { orgId },
      include: { department: true },
      orderBy: { employeeCode: 'asc' },
    });

    const rows = [];
    for (const u of users) {
      const monthly = await this.summaries.monthly(u.id, period);
      rows.push({
        employeeCode: u.employeeCode ?? '',
        name: u.name,
        email: u.email,
        department: u.department?.name ?? '',
        period,
        days: monthly.days,
        total: monthly.total,
      });
    }

    const csv = buildCsv(rows, columns);
    const buffer =
      encoding === 'shift_jis' ? iconv.encode(csv, 'Shift_JIS') : Buffer.from('﻿' + csv, 'utf-8');

    await this.audit.record({
      orgId,
      actorId,
      action: 'csv.export',
      target: period,
      detail: { mappingId: mappingId ?? null, encoding, rows: rows.length },
    });

    const contentType =
      encoding === 'shift_jis' ? 'text/csv; charset=Shift_JIS' : 'text/csv; charset=utf-8';
    return { buffer, contentType, filename: `attendance_${period}.csv` };
  }
}
