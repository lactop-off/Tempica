import { Controller, Get, Module, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/decorators';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('unread') unread?: string) {
    return this.service.list(user.id, unread === 'true');
  }

  @Post(':id/read')
  read(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.markRead(user.id, id);
  }
}

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
