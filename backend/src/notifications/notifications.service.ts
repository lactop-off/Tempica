import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JobsService, QUEUE } from '../jobs/jobs.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
  ) {}

  /** アプリ内通知を作成し、メール送信ジョブを登録する。 */
  async notify(
    userId: string,
    type: string,
    payload: Record<string, unknown>,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const n = await client.notification.create({
      data: { userId, type, payload: payload as Prisma.InputJsonValue },
    });
    await this.jobs.enqueue(QUEUE.NOTIFY, { notificationId: n.id, userId, type });
    return n;
  }

  list(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { read: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({ where: { id, userId }, data: { read: true } });
    return { ok: true };
  }
}
