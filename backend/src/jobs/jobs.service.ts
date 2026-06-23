import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PgBoss from 'pg-boss';

export const QUEUE = {
  NOTIFY: 'notify',
  CSV_EXPORT: 'csv-export',
  RECALC_SUMMARY: 'recalc-summary',
} as const;

/**
 * pg-boss（PostgreSQL 上のジョブキュー）ラッパー。Redis を不要にする。
 * backend に内包して起動するが、worker プロセス（worker.ts）でも同じ DB を共有して
 * ジョブを消費できる。テスト環境などジョブが不要な場合は ENABLE_JOBS=false で無効化。
 */
@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private boss?: PgBoss;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get('ENABLE_JOBS', 'true') !== 'false';
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.warn('JobsService disabled (ENABLE_JOBS=false)');
      return;
    }
    const connectionString = this.config.getOrThrow<string>('DATABASE_URL');
    this.boss = new PgBoss({ connectionString });
    this.boss.on('error', (e) => this.logger.error('pg-boss error', e));
    await this.boss.start();
    this.logger.log('pg-boss started');
  }

  async onModuleDestroy() {
    await this.boss?.stop({ graceful: true });
  }

  /** ジョブを登録する。キューが無効なら no-op。 */
  async enqueue(queue: string, data: Record<string, unknown>): Promise<string | null> {
    if (!this.boss) return null;
    return this.boss.send(queue, data);
  }

  /** worker 側でハンドラを登録する。 */
  async work<T extends object>(queue: string, handler: (job: PgBoss.Job<T>) => Promise<void>) {
    if (!this.boss) return;
    await this.boss.work<T>(queue, async (job) => handler(job));
  }

  get instance(): PgBoss | undefined {
    return this.boss;
  }
}
