import { Injectable } from '@nestjs/common';
import { PassportSerializer } from '@nestjs/passport';
import { AuthUser } from '../common/decorators';
import { AuthService } from './auth.service';

/** session には user.id のみ保存し、リクエスト毎に最小ユーザーを復元する。 */
@Injectable()
export class SessionSerializer extends PassportSerializer {
  constructor(private readonly auth: AuthService) {
    super();
  }

  serializeUser(user: AuthUser, done: (err: unknown, id?: string) => void) {
    done(null, user.id);
  }

  async deserializeUser(id: string, done: (err: unknown, user?: AuthUser | null) => void) {
    try {
      const user = await this.auth.findById(id);
      done(null, user);
    } catch (e) {
      done(e);
    }
  }
}
