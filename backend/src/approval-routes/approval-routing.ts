import { ApproverType, NoApproverPolicy } from '../common/constants';

/**
 * 承認経路の純粋ロジック（DB 非依存）。
 * ステップ定義のパースと、承認者候補から「保留／自動承認／ブロック」を決める判定を担う。
 */

/** 1ステップの承認者解決方式。 */
export interface StepDescriptor {
  step: number;
  approverType: string; // ApproverType
  approverRef: string | null; // user タイプの対象ユーザー ID 等
}

/**
 * approval_route.steps（JSON）をステップ記述子へ変換する。
 * 未定義・空なら「scope による単一ステップ」を既定とする。
 */
export function parseSteps(rawSteps: unknown): StepDescriptor[] {
  if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
    return [{ step: 1, approverType: ApproverType.SCOPE, approverRef: null }];
  }
  return rawSteps.map((s: any, i) => ({
    step: typeof s?.step === 'number' ? s.step : i + 1,
    approverType: s?.approver_type ?? ApproverType.SCOPE,
    approverRef: s?.approver_ref ?? null,
  }));
}

export type StepResolution = 'pending' | 'auto_approve' | 'block';

export interface StepDecisionInput {
  /** そのステップで承認者になり得るユーザー ID 群（固定承認者なら1件、scope なら動的集合）。 */
  candidateIds: string[];
  applicantId: string;
  allowSelfApprove: boolean;
  /** NoApproverPolicy。候補が0人になったときの扱い。 */
  onNoApprover: string;
}

export interface StepDecision {
  /** 自己除外を適用したあとの実際の承認者候補。 */
  eligibleIds: string[];
  resolution: StepResolution;
}

/**
 * 承認者候補に自己除外ポリシーを適用し、ステップの扱いを決める。
 * - 候補が残る → pending（人間の承認を待つ）
 * - 候補が0 → onNoApprover に従い auto_approve / block
 */
export function decideStep(input: StepDecisionInput): StepDecision {
  const eligibleIds = input.allowSelfApprove
    ? [...input.candidateIds]
    : input.candidateIds.filter((id) => id !== input.applicantId);

  if (eligibleIds.length > 0) {
    return { eligibleIds, resolution: 'pending' };
  }
  return {
    eligibleIds,
    resolution: input.onNoApprover === NoApproverPolicy.BLOCK ? 'block' : 'auto_approve',
  };
}
