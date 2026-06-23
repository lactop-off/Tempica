import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { ROLE_TEMPLATES } from '../src/rbac/role-templates';

/**
 * 開発・デモ用の初期データ投入。
 * 既に組織が存在する場合は何もしない（本番では Web の初期セットアップを使用）。
 *
 * 投入内容: デモ組織 / 標準ロール / 部署 / 雇用区分 / 勤務形態+就業ルール /
 *           管理者・一般従業員 / 休暇種別。
 */
const prisma = new PrismaClient();

async function main() {
  if ((await prisma.organization.count()) > 0) {
    console.log('既に初期化済みのためシードをスキップします。');
    return;
  }

  const passwordHash = await bcrypt.hash('Password123!', 12);

  const org = await prisma.organization.create({
    data: { name: 'デモ株式会社', settings: { csvAllowUnclosed: false } },
  });
  await prisma.closingPeriod.create({ data: { orgId: org.id, closeDay: 31 } });

  const roles = await Promise.all(
    ROLE_TEMPLATES.map((t) =>
      prisma.role.create({
        data: { orgId: org.id, name: t.name, isTemplate: true, permissions: t.permissions as object },
      }),
    ),
  );
  const roleByName = (n: string) => roles.find((r) => r.name === n)!;

  const hq = await prisma.department.create({
    data: { orgId: org.id, name: '本社', kind: 'location', sortOrder: 1 },
  });
  const dev = await prisma.department.create({
    data: { orgId: org.id, parentId: hq.id, name: '開発部', kind: 'department', sortOrder: 1 },
  });

  const fulltime = await prisma.employmentType.create({ data: { orgId: org.id, name: '正社員' } });

  const pattern = await prisma.workPattern.create({
    data: {
      orgId: org.id,
      name: '標準（固定9-18）',
      type: 'fixed',
      rule: { start: '09:00', end: '18:00' },
      workRules: {
        create: [
          {
            orgId: org.id,
            scheduledMinutes: 480,
            breakMinutes: 60,
            roundingUnit: 15,
            roundingMethod: 'nearest',
            overtimeRule: { legal: true },
          },
        ],
      },
    },
  });

  const admin = await prisma.appUser.create({
    data: {
      orgId: org.id,
      deptId: hq.id,
      employmentTypeId: fulltime.id,
      email: 'admin@example.com',
      passwordHash,
      name: '管理 太郎',
      employeeCode: 'EMP0001',
      status: 'active',
    },
  });
  await prisma.userRole.create({ data: { userId: admin.id, roleId: roleByName('システム管理者').id } });

  const manager = await prisma.appUser.create({
    data: {
      orgId: org.id,
      deptId: dev.id,
      employmentTypeId: fulltime.id,
      email: 'manager@example.com',
      passwordHash,
      name: '管理 次郎',
      employeeCode: 'EMP0002',
      status: 'active',
    },
  });
  await prisma.userRole.create({ data: { userId: manager.id, roleId: roleByName('現場管理者').id } });

  const employee = await prisma.appUser.create({
    data: {
      orgId: org.id,
      deptId: dev.id,
      employmentTypeId: fulltime.id,
      email: 'employee@example.com',
      passwordHash,
      name: '社員 花子',
      employeeCode: 'EMP0003',
      status: 'active',
    },
  });
  await prisma.userRole.create({ data: { userId: employee.id, roleId: roleByName('一般従業員').id } });

  // 勤務形態の個人割当（有効期間つき）
  for (const u of [admin, manager, employee]) {
    await prisma.userWorkPattern.create({
      data: { userId: u.id, workPatternId: pattern.id, startDate: new Date('2026-01-01'), endDate: null },
    });
  }

  // 休暇種別 + 残数
  const paidLeave = await prisma.leaveType.create({
    data: { orgId: org.id, name: '有給休暇', paid: true, unit: 'day', grantRule: { autoGrant: true } },
  });
  await prisma.leaveType.create({
    data: { orgId: org.id, name: '振替休日', paid: true, unit: 'day' },
  });
  for (const u of [manager, employee]) {
    await prisma.leaveBalance.create({
      data: {
        userId: u.id,
        leaveTypeId: paidLeave.id,
        grantedMinutes: 480 * 10, // 10日分
        usedMinutes: 0,
        expiresOn: new Date('2027-03-31'),
      },
    });
  }

  console.log('シード完了:');
  console.log('  組織       :', org.name);
  console.log('  ログイン例 : admin@example.com / manager@example.com / employee@example.com');
  console.log('  パスワード : Password123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
