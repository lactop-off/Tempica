-- 承認経路の終端ポリシー（承認者不在時の扱い）と自己承認フラグ
ALTER TABLE "approval_route" ADD COLUMN     "allow_self_approve" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "on_no_approver" VARCHAR(20) NOT NULL DEFAULT 'auto_approve';

-- 部署長（承認経路の department_manager / manager_of_applicant 解決に使用）
ALTER TABLE "department" ADD COLUMN     "manager_user_id" UUID;

-- AddForeignKey
ALTER TABLE "department" ADD CONSTRAINT "department_manager_user_id_fkey" FOREIGN KEY ("manager_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
