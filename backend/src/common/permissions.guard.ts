import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BusinessException } from './business-exception';
import { IS_PUBLIC_KEY, PERMISSION_KEY, RequiredPermission } from './decorators';
import { RbacService } from '../rbac/rbac.service';

/**
 * 認証 + 権限（機能×操作）チェックを行う統合ガード。
 * - @Public() は素通り
 * - 未認証は 401
 * - @RequirePermission(feature, action) が無いエンドポイントは「認証済みなら可」
 * - 権限ありなら scope を解決し、req.resolvedScope / req.accessibleDeptIds を付与
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbac: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    if (!req.isAuthenticated?.() || !req.user) {
      throw new BusinessException(401 as any, 'unauthorized', '認証が必要です');
    }

    const required = this.reflector.getAllAndOverride<RequiredPermission>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true; // 権限指定の無いエンドポイントは認証のみで許可

    const scope = await this.rbac.resolveScope(req.user.id, required.feature, required.action);
    if (!scope) {
      throw BusinessException.forbidden('forbidden', 'この操作を行う権限がありません');
    }
    req.resolvedScope = scope;
    req.accessibleDeptIds = await this.rbac.accessibleDeptIds(
      req.user.orgId,
      req.user.deptId,
      scope,
    );
    return true;
  }
}
