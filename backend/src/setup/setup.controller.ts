import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators';
import { SetupDto } from './dto';
import { SetupService } from './setup.service';

@ApiTags('setup')
@Controller('setup')
export class SetupController {
  constructor(private readonly service: SetupService) {}

  @Public()
  @Get('status')
  @ApiOperation({ summary: '初期セットアップ済みかどうか' })
  async status() {
    return { initialized: await this.service.isInitialized() };
  }

  @Public()
  @Post()
  @ApiOperation({ summary: '初回のみ：管理者・組織・標準ロールを作成' })
  setup(@Body() dto: SetupDto) {
    return this.service.setup(dto);
  }
}
