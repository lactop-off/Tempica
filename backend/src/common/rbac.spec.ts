import { Permission } from './constants';
import { isVisible, resolveScope } from './rbac';

const perms: Permission[] = [
  { feature: 'attendance', action: 'view', scope: 'self' },
  { feature: 'attendance', action: 'view', scope: 'department' },
  { feature: 'approval', action: 'approve', scope: 'org' },
];

describe('resolveScope', () => {
  it('複数権限のうち最も広い scope を返す', () => {
    expect(resolveScope(perms, 'attendance', 'view')).toBe('department');
  });
  it('権限が無ければ null', () => {
    expect(resolveScope(perms, 'csv', 'manage')).toBeNull();
  });
  it('org スコープを正しく返す', () => {
    expect(resolveScope(perms, 'approval', 'approve')).toBe('org');
  });
});

describe('isVisible', () => {
  const actor = { userId: 'u1', deptId: 'd1', accessibleDeptIds: ['d1', 'd2'] };

  it('self は本人のみ', () => {
    expect(isVisible('self', actor, { ownerUserId: 'u1' })).toBe(true);
    expect(isVisible('self', actor, { ownerUserId: 'u2' })).toBe(false);
  });
  it('department はアクセス可能部署のデータを許可', () => {
    expect(isVisible('department', actor, { ownerUserId: 'u2', ownerDeptId: 'd2' })).toBe(true);
    expect(isVisible('department', actor, { ownerUserId: 'u2', ownerDeptId: 'd3' })).toBe(false);
  });
  it('department でも本人は常に可', () => {
    expect(isVisible('department', actor, { ownerUserId: 'u1', ownerDeptId: 'dX' })).toBe(true);
  });
  it('org は全て許可', () => {
    expect(isVisible('org', actor, { ownerUserId: 'u9', ownerDeptId: 'dZ' })).toBe(true);
  });
});
