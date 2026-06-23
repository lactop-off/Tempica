import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthUser, CurrentUser, Public } from '../common/decorators';
import { RbacService } from '../rbac/rbac.service';
import { LoginDto } from './dto';
import { LocalAuthGuard } from './local-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly rbac: RbacService) {}

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @ApiOperation({ summary: 'メール+パスワードでログイン（HttpOnly セッション Cookie を発行）' })
  login(@CurrentUser() user: AuthUser, @Body() _dto: LoginDto) {
    return user;
  }

  @Post('logout')
  @ApiOperation({ summary: 'ログアウト（セッション破棄）' })
  async logout(@Req() req: Request) {
    await new Promise<void>((resolve, reject) =>
      req.logout((err) => (err ? reject(err) : resolve())),
    );
    await new Promise<void>((resolve) => req.session.destroy(() => resolve()));
    return { ok: true };
  }

  @Get('me')
  @ApiOperation({ summary: '自分の情報と権限一覧を取得' })
  async me(@CurrentUser() user: AuthUser) {
    const permissions = await this.rbac.getPermissions(user.id);
    return { user, permissions };
  }
}
