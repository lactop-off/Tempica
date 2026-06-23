import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { JobsService, QUEUE } from './jobs/jobs.service';
import { MailService } from './mail/mail.service';
import { PrismaService } from './prisma/prisma.service';

/**
 * 非同期ジョブの consumer。compose の worker サービス（任意）で起動する。
 * backend に内包したまま運用することもできるため、ここではジョブ処理のみ登録する。
 */
async function bootstrap() {
  const logger = new Logger('Worker');
  const app = await NestFactory.createApplicationContext(AppModule);
  const jobs = app.get(JobsService);
  const mail = app.get(MailService);
  const prisma = app.get(PrismaService);

  // 通知ジョブ：アプリ内通知に対応するメールを送信
  await jobs.work<{ notificationId: string; userId: string; type: string }>(
    QUEUE.NOTIFY,
    async (job) => {
      const user = await prisma.appUser.findUnique({ where: { id: job.data.userId } });
      if (!user) return;
      const subject = `[Tempica] 通知: ${job.data.type}`;
      await mail.send(user.email, subject, `新しい通知があります（種別: ${job.data.type}）。`);
      logger.log(`notify -> ${user.email} (${job.data.type})`);
    },
  );

  logger.log('Worker started, listening for jobs');
}

bootstrap();
