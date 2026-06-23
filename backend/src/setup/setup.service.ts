import { Injectable } from '@nestjs/common';
import { BusinessException } from '../common/business-exception';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { ROLE_TEMPLATES } from '../rbac/role-templates';
import { SetupDto } from './dto';

/**
 * F-101 初期セットアップ。シングルテナント（1インスタンス=1組織）のため、
 * 組織が未作成のときだけ実行できる。標準ロールテンプレートも同時に投入する。
 */
@Injectable()
export class SetupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async isInitialized(): Promise<boolean> {
    const count = await this.prisma.organization.count();
    return count > 0;
  }

  async setup(dto: SetupDto) {
    if (await this.isInitialized()) {
      throw BusinessException.conflict('already_initialized', '既に初期セットアップ済みです');
    }
    const passwordHash = await AuthService.hashPassword(dto.admin.password);

    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: dto.organization.name, settings: {} },
      });

      await tx.closingPeriod.create({
        data: { orgId: org.id, closeDay: dto.organization.closeDay ?? 31 },
      });

      // 標準ロールテンプレートを投入
      const roles = await Promise.all(
        ROLE_TEMPLATES.map((t) =>
          tx.role.create({
            data: {
              orgId: org.id,
              name: t.name,
              isTemplate: true,
              permissions: t.permissions as unknown as object,
            },
          }),
        ),
      );
      const adminRole = roles.find((r) => r.name === 'システム管理者')!;

      const admin = await tx.appUser.create({
        data: {
          orgId: org.id,
          email: dto.admin.email,
          passwordHash,
          name: dto.admin.name,
          status: 'active',
        },
      });
      await tx.userRole.create({ data: { userId: admin.id, roleId: adminRole.id } });

      await tx.auditLog.create({
        data: { orgId: org.id, actorId: admin.id, action: 'setup.completed', target: org.id },
      });

      return {
        organization: { id: org.id, name: org.name },
        admin: { id: admin.id, email: admin.email, name: admin.name },
      };
    });
  }
}
