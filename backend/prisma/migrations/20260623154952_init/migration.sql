-- CreateTable
CREATE TABLE "organization" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "parent_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "kind" VARCHAR(20) NOT NULL DEFAULT 'department',
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employment_type" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "employment_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_user" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "dept_id" UUID,
    "employment_type_id" UUID,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "employee_code" VARCHAR(60),
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "hired_on" DATE,
    "retired_on" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_template" BOOLEAN NOT NULL DEFAULT false,
    "permissions" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_role" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,

    CONSTRAINT "user_role_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "work_pattern" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "rule" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "work_pattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_rule" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "work_pattern_id" UUID NOT NULL,
    "scheduled_minutes" INTEGER NOT NULL DEFAULT 480,
    "break_minutes" INTEGER NOT NULL DEFAULT 60,
    "rounding_unit" INTEGER NOT NULL DEFAULT 1,
    "rounding_method" VARCHAR(10) NOT NULL DEFAULT 'none',
    "overtime_rule" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "work_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_work_pattern" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "work_pattern_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,

    CONSTRAINT "user_work_pattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "closing_period" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "close_day" INTEGER NOT NULL DEFAULT 31,

    CONSTRAINT "closing_period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_record" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "punch_type" VARCHAR(20) NOT NULL,
    "punched_at" TIMESTAMPTZ NOT NULL,
    "source" VARCHAR(20) NOT NULL DEFAULT 'web',
    "geo_lat" DECIMAL(9,6),
    "geo_lng" DECIMAL(9,6),
    "is_corrected" BOOLEAN NOT NULL DEFAULT false,
    "request_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_summary" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "worked_minutes" INTEGER NOT NULL DEFAULT 0,
    "overtime_minutes" INTEGER NOT NULL DEFAULT 0,
    "late_night_minutes" INTEGER NOT NULL DEFAULT 0,
    "holiday_minutes" INTEGER NOT NULL DEFAULT 0,
    "late_minutes" INTEGER NOT NULL DEFAULT 0,
    "early_leave_minutes" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'open',

    CONSTRAINT "daily_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_close" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "period" CHAR(7) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'open',
    "closed_by" UUID,
    "closed_at" TIMESTAMPTZ,

    CONSTRAINT "monthly_close_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "leave_type_id" UUID,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "current_step" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_route" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "applies_to" VARCHAR(30) NOT NULL DEFAULT 'all',
    "steps" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "approval_route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "step" INTEGER NOT NULL,
    "approver_id" UUID,
    "result" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "comment" TEXT,
    "acted_at" TIMESTAMPTZ,

    CONSTRAINT "approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_type" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT true,
    "unit" VARCHAR(10) NOT NULL DEFAULT 'day',
    "grant_rule" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "leave_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balance" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "granted_minutes" INTEGER NOT NULL DEFAULT 0,
    "used_minutes" INTEGER NOT NULL DEFAULT 0,
    "expires_on" DATE,

    CONSTRAINT "leave_balance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "shift_date" DATE NOT NULL,
    "start_time" TIME,
    "end_time" TIME,
    "kind" VARCHAR(20) NOT NULL DEFAULT 'planned',

    CONSTRAINT "shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csv_mapping" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "mapping" JSONB NOT NULL DEFAULT '[]',
    "encoding" VARCHAR(20) NOT NULL DEFAULT 'utf-8',

    CONSTRAINT "csv_mapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(60) NOT NULL,
    "target" VARCHAR(120),
    "detail" JSONB,
    "at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "payload" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "department_org_id_idx" ON "department"("org_id");

-- CreateIndex
CREATE INDEX "app_user_org_id_idx" ON "app_user"("org_id");

-- CreateIndex
CREATE INDEX "app_user_dept_id_idx" ON "app_user"("dept_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_org_id_email_key" ON "app_user"("org_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "role_org_id_name_key" ON "role"("org_id", "name");

-- CreateIndex
CREATE INDEX "user_work_pattern_user_id_idx" ON "user_work_pattern"("user_id");

-- CreateIndex
CREATE INDEX "time_record_user_id_punched_at_idx" ON "time_record"("user_id", "punched_at");

-- CreateIndex
CREATE UNIQUE INDEX "daily_summary_user_id_work_date_key" ON "daily_summary"("user_id", "work_date");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_close_org_id_period_key" ON "monthly_close"("org_id", "period");

-- CreateIndex
CREATE INDEX "request_org_id_status_idx" ON "request"("org_id", "status");

-- CreateIndex
CREATE INDEX "approval_approver_id_result_idx" ON "approval"("approver_id", "result");

-- CreateIndex
CREATE UNIQUE INDEX "approval_request_id_step_key" ON "approval"("request_id", "step");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balance_user_id_leave_type_id_expires_on_key" ON "leave_balance"("user_id", "leave_type_id", "expires_on");

-- CreateIndex
CREATE UNIQUE INDEX "shift_user_id_shift_date_kind_key" ON "shift"("user_id", "shift_date", "kind");

-- CreateIndex
CREATE INDEX "audit_log_org_id_at_idx" ON "audit_log"("org_id", "at");

-- CreateIndex
CREATE INDEX "notification_user_id_read_idx" ON "notification"("user_id", "read");

-- AddForeignKey
ALTER TABLE "department" ADD CONSTRAINT "department_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department" ADD CONSTRAINT "department_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_type" ADD CONSTRAINT "employment_type_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_employment_type_id_fkey" FOREIGN KEY ("employment_type_id") REFERENCES "employment_type"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role" ADD CONSTRAINT "role_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_pattern" ADD CONSTRAINT "work_pattern_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_rule" ADD CONSTRAINT "work_rule_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_rule" ADD CONSTRAINT "work_rule_work_pattern_id_fkey" FOREIGN KEY ("work_pattern_id") REFERENCES "work_pattern"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_work_pattern" ADD CONSTRAINT "user_work_pattern_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_work_pattern" ADD CONSTRAINT "user_work_pattern_work_pattern_id_fkey" FOREIGN KEY ("work_pattern_id") REFERENCES "work_pattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "closing_period" ADD CONSTRAINT "closing_period_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_record" ADD CONSTRAINT "time_record_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_summary" ADD CONSTRAINT "daily_summary_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_close" ADD CONSTRAINT "monthly_close_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_close" ADD CONSTRAINT "monthly_close_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request" ADD CONSTRAINT "request_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request" ADD CONSTRAINT "request_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request" ADD CONSTRAINT "request_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_type"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_route" ADD CONSTRAINT "approval_route_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval" ADD CONSTRAINT "approval_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval" ADD CONSTRAINT "approval_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_type" ADD CONSTRAINT "leave_type_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balance" ADD CONSTRAINT "leave_balance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balance" ADD CONSTRAINT "leave_balance_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift" ADD CONSTRAINT "shift_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csv_mapping" ADD CONSTRAINT "csv_mapping_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
