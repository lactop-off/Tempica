import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { BusinessException } from '../common/business-exception';
import { AuthUser } from '../common/decorators';
import { AuthService } from './auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly auth: AuthService) {
    super({ usernameField: 'email', passwordField: 'password' });
  }

  async validate(email: string, password: string): Promise<AuthUser> {
    const user = await this.auth.validateUser(email, password);
    if (!user) {
      throw new BusinessException(
        401 as any,
        'unauthorized',
        'メールアドレスまたはパスワードが正しくありません',
      );
    }
    return user;
  }
}
