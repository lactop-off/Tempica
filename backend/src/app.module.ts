import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PermissionsGuard } from './common/permissions.guard';
import { PrismaModule } from './prisma/prisma.module';
import { RbacModule } from './rbac/rbac.module';
import { JobsModule } from './jobs/jobs.module';
import { MailModule } from './mail/mail.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { SetupModule } from './setup/setup.module';
import { OrganizationModule } from './organization/organization.module';
import { DepartmentsModule } from './departments/departments.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { WorkPatternsModule } from './work-patterns/work-patterns.module';
import { TimeRecordsModule } from './time-records/time-records.module';
import { SummariesModule } from './summaries/summaries.module';
import { RequestsModule } from './requests/requests.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { LeaveModule } from './leave/leave.module';
import { ShiftsModule } from './shifts/shifts.module';
import { ClosingsModule } from './closings/closings.module';
import { CsvModule } from './csv/csv.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // 基盤
    PrismaModule,
    RbacModule,
    JobsModule,
    MailModule,
    AuditModule,
    // ドメイン
    AuthModule,
    SetupModule,
    OrganizationModule,
    DepartmentsModule,
    UsersModule,
    RolesModule,
    WorkPatternsModule,
    TimeRecordsModule,
    SummariesModule,
    RequestsModule,
    ApprovalsModule,
    LeaveModule,
    ShiftsModule,
    ClosingsModule,
    CsvModule,
    NotificationsModule,
    HealthModule,
  ],
  providers: [
    // 認証 + 権限（機能×操作）を全エンドポイントに適用（@Public() で除外）
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
