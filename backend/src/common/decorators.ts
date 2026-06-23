import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Action, Feature } from './constants';

/** ログイン中ユーザーの最小プリンシパル（session から復元）。 */
export interface AuthUser {
  id: string;
  orgId: string;
  deptId?: string | null;
  email: string;
  name: string;
}

/** 認証不要エンドポイントの印。 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** 必要権限（機能×操作）のメタデータ。 */
export const PERMISSION_KEY = 'requiredPermission';
export interface RequiredPermission {
  feature: Feature;
  action: Action;
}
export const RequirePermission = (feature: Feature, action: Action) =>
  SetMetadata(PERMISSION_KEY, { feature, action } as RequiredPermission);

/** ハンドラ引数として認証ユーザーを受け取る。 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);

/** PermissionsGuard が解決した scope / アクセス可能部署を受け取る。 */
export const ResolvedScope = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return {
    scope: req.resolvedScope,
    accessibleDeptIds: req.accessibleDeptIds as string[] | undefined,
  };
});
