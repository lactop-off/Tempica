import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthUser } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  static async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 12);
  }

  /** メール+パスワードを検証し、成功すれば認証ユーザーを返す。 */
  async validateUser(email: string, password: string): Promise<AuthUser | null> {
    const user = await this.prisma.appUser.findFirst({
      where: { email, status: 'active' },
    });
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;
    return {
      id: user.id,
      orgId: user.orgId,
      deptId: user.deptId,
      email: user.email,
      name: user.name,
    };
  }

  /** session から復元するための最小ユーザー取得。 */
  async findById(id: string): Promise<AuthUser | null> {
    const user = await this.prisma.appUser.findUnique({ where: { id } });
    if (!user || user.status !== 'active') return null;
    return {
      id: user.id,
      orgId: user.orgId,
      deptId: user.deptId,
      email: user.email,
      name: user.name,
    };
  }
}
