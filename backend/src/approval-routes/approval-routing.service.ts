import { Injectable } from '@nestjs/common';
import { ApproverType, NoApproverPolicy } from '../common/constants';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { parseSteps, StepDescriptor } from './approval-routing';

export interface RoutePlan {
  steps: StepDescriptor[];
  onNoApprover: string;
  allowSelfApprove: boolean;
}

/** ステップごとの承認者候補。固定承認者なら fixedApproverId が定まる。 */
export interface StepCandidates {
  ids: string[];
  fixedApproverId: string | null;
}

/**
 * 承認経路の解決（DB 依存）。経路定義の取得と、各ステップの承認者候補解決を担う。
 * RequestsService（申請作成時のステップ生成）と ApprovalsService（自動解決）の双方が利用する。
 */
@Injectable()
export class ApprovalRoutingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
  ) {}

  /** 申請種別に対する承認経路（無ければ scope 単一ステップ・auto_approve を既定）を返す。 */
  async resolvePlan(orgId: string, type: string): Promise<RoutePlan> {
    const route = await this.prisma.approvalRoute.findFirst({
      where: { orgId, OR: [{ appliesTo: type }, { appliesTo: 'all' }] },
      orderBy: { appliesTo: 'asc' }, // 'all' より具体的な type を優先
    });
    return {
      steps: parseSteps(route?.steps),
      onNoApprover: route?.onNoApprover ?? NoApproverPolicy.AUTO_APPROVE,
      allowSelfApprove: route?.allowSelfApprove ?? false,
    };
  }

  /**
   * 1ステップの承認者候補を解決する。
   * - user                : approver_ref のユーザー（active のみ）
   * - department_manager / manager_of_applicant : 申請者の所属部署の部署長
   * - scope（既定）       : APPROVAL.APPROVE を持ち申請者が見える全ユーザー（動的）
   */
  async candidateApprovers(
    orgId: string,
    step: StepDescriptor,
    applicant: { userId: string; deptId?: string | null },
  ): Promise<StepCandidates> {
    switch (step.approverType) {
      case ApproverType.USER: {
        const id = step.approverRef;
        if (!id) return { ids: [], fixedApproverId: null };
        const u = await this.prisma.appUser.findFirst({
          where: { id, orgId, status: 'active' },
          select: { id: true },
        });
        return u ? { ids: [u.id], fixedApproverId: u.id } : { ids: [], fixedApproverId: null };
      }
      case ApproverType.DEPARTMENT_MANAGER:
      case ApproverType.MANAGER_OF_APPLICANT: {
        const managerId = await this.departmentManagerOf(orgId, applicant.deptId);
        return managerId
          ? { ids: [managerId], fixedApproverId: managerId }
          : { ids: [], fixedApproverId: null };
      }
      case ApproverType.SCOPE:
      default: {
        const ids = await this.rbac.eligibleApproverIds(orgId, applicant);
        return { ids, fixedApproverId: null };
      }
    }
  }

  /** 申請者の所属部署の部署長（active）を返す。未設定なら null。 */
  private async departmentManagerOf(
    orgId: string,
    deptId: string | null | undefined,
  ): Promise<string | null> {
    if (!deptId) return null;
    const dept = await this.prisma.department.findFirst({
      where: { id: deptId, orgId },
      select: { managerUserId: true, manager: { select: { status: true } } },
    });
    if (!dept?.managerUserId || dept.manager?.status !== 'active') return null;
    return dept.managerUserId;
  }
}
