import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { RbacModule } from '../rbac/rbac.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LocalStrategy } from './local.strategy';
import { SessionSerializer } from './session.serializer';

@Module({
  imports: [PassportModule.register({ session: true }), RbacModule],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, SessionSerializer],
  exports: [AuthService],
})
export class AuthModule {}
