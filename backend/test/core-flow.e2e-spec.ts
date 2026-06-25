import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './setup-app';

/**
 * 中核フローの E2E:
 *   初期セットアップ → ログイン → 自分情報 → 打刻 → 二重打刻(409)
 *   → 勤務形態作成/割当 → 申請 → 承認 → 月次締め → CSV出力
 * 実行には PostgreSQL（DATABASE_URL=attendance_test 推奨）が必要。
 */
describe('Core flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let agent: ReturnType<typeof request.agent>;

  const admin = { name: '管理者', email: 'admin@e2e.test', password: 'Password123!' };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    // クリーンスレート（FK 順に削除）
    await prisma.$executeRawUnsafe(`
      TRUNCATE approval, request, user_work_pattern, work_rule, work_pattern,
        daily_summary, time_record, leave_balance, leave_type, monthly_close,
        csv_mapping, notification, audit_log, user_role, role, app_user,
        department, employment_type, closing_period, organization RESTART IDENTITY CASCADE;
    `);
    agent = request.agent(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  it('セットアップ前は initialized=false', async () => {
    const res = await agent.get('/api/v1/setup/status').expect(200);
    expect(res.body.initialized).toBe(false);
  });

  it('初期セットアップで組織と管理者を作成', async () => {
    const res = await agent
      .post('/api/v1/setup')
      .send({ organization: { name: 'E2E株式会社', closeDay: 31 }, admin })
      .expect(201);
    expect(res.body.organization.name).toBe('E2E株式会社');
  });

  it('ログインしてセッション Cookie を取得', async () => {
    await agent
      .post('/api/v1/auth/login')
      .send({ email: admin.email, password: admin.password })
      .expect(201);
    const me = await agent.get('/api/v1/auth/me').expect(200);
    expect(me.body.user.email).toBe(admin.email);
    expect(me.body.permissions.length).toBeGreaterThan(0);
  });

  it('打刻できる / 二重打刻は 409', async () => {
    await agent.post('/api/v1/time-records').send({ punch_type: 'clock_in' }).expect(201);
    const dup = await agent
      .post('/api/v1/time-records')
      .send({ punch_type: 'clock_in' })
      .expect(409);
    expect(dup.body.error.code).toBe('double_punch');
    await agent.post('/api/v1/time-records').send({ punch_type: 'clock_out' }).expect(201);
  });

  it('未認証では 401（新規エージェント）', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('勤務形態を作成し本人へ割当（期間重複は 409）', async () => {
    const pattern = await agent
      .post('/api/v1/work-patterns')
      .send({ name: '固定', type: 'fixed', workRule: { scheduledMinutes: 480, roundingUnit: 15 } })
      .expect(201);
    const me = await agent.get('/api/v1/auth/me').expect(200);
    const userId = me.body.user.id;
    await agent
      .post(`/api/v1/users/${userId}/work-patterns`)
      .send({ workPatternId: pattern.body.id, startDate: '2026-01-01' })
      .expect(201);
    const overlap = await agent
      .post(`/api/v1/users/${userId}/work-patterns`)
      .send({ workPatternId: pattern.body.id, startDate: '2026-06-01' })
      .expect(409);
    expect(overlap.body.error.code).toBe('overlap');
  });

  it('申請 → 承認者不在は終端ポリシーで自動承認（打刻修正）', async () => {
    const created = await agent
      .post('/api/v1/requests')
      .send({
        type: 'punch_fix',
        payload: {
          target_date: '2026-06-20',
          fix: [{ punch_type: 'clock_out', punched_at: '2026-06-20T18:30:00+09:00' }],
          reason: '打刻忘れ',
        },
      })
      .expect(201);

    // 申請者(管理者)が唯一の org 承認者 → 自己除外で承認者0人 →
    // 既定の onNoApprover=auto_approve により自動承認される。
    expect(created.body.status).toBe('approved');

    // 自分の申請は承認待ち一覧には出ない（自己承認は不可）
    const pending = await agent.get('/api/v1/approvals').expect(200);
    expect(Array.isArray(pending.body)).toBe(true);
    expect(pending.body.find((a: any) => a.request?.id === created.body.id)).toBeUndefined();
  });

  it('月次締め → CSV 出力（締め後は出力可）', async () => {
    await agent.post('/api/v1/closings').send({ period: '2026-06' }).expect(201);
    const csv = await agent.get('/api/v1/exports/csv?period=2026-06').expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('社員コード');
  });
});
