import { ApproverType } from '../common/constants';
import { decideStep, parseSteps } from './approval-routing';

describe('parseSteps', () => {
  it('空・未定義は scope の単一ステップを既定とする', () => {
    expect(parseSteps(undefined)).toEqual([
      { step: 1, approverType: ApproverType.SCOPE, approverRef: null },
    ]);
    expect(parseSteps([])).toEqual([
      { step: 1, approverType: ApproverType.SCOPE, approverRef: null },
    ]);
  });

  it('JSON ステップを記述子へ変換する（step 欠落は連番補完）', () => {
    const steps = parseSteps([
      { approver_type: 'department_manager' },
      { step: 5, approver_type: 'user', approver_ref: 'u1' },
    ]);
    expect(steps).toEqual([
      { step: 1, approverType: 'department_manager', approverRef: null },
      { step: 5, approverType: 'user', approverRef: 'u1' },
    ]);
  });
});

describe('decideStep', () => {
  const base = { applicantId: 'me', allowSelfApprove: false, onNoApprover: 'auto_approve' };

  it('承認者候補がいれば pending', () => {
    const d = decideStep({ ...base, candidateIds: ['boss'] });
    expect(d.resolution).toBe('pending');
    expect(d.eligibleIds).toEqual(['boss']);
  });

  it('候補が申請者本人だけなら自己除外され、auto_approve に落ちる', () => {
    const d = decideStep({ ...base, candidateIds: ['me'] });
    expect(d.eligibleIds).toEqual([]);
    expect(d.resolution).toBe('auto_approve');
  });

  it('allowSelfApprove なら本人を残して pending', () => {
    const d = decideStep({ ...base, allowSelfApprove: true, candidateIds: ['me'] });
    expect(d.resolution).toBe('pending');
    expect(d.eligibleIds).toEqual(['me']);
  });

  it('候補0かつ onNoApprover=block なら block', () => {
    const d = decideStep({ ...base, onNoApprover: 'block', candidateIds: [] });
    expect(d.resolution).toBe('block');
  });

  it('自分以外の承認者がいれば自己除外しても pending', () => {
    const d = decideStep({ ...base, candidateIds: ['me', 'boss'] });
    expect(d.eligibleIds).toEqual(['boss']);
    expect(d.resolution).toBe('pending');
  });
});
