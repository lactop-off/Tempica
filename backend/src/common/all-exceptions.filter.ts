import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { Response } from 'express';

/**
 * 設計書 E. の統一エラーレスポンス { error: { code, message, details } } に整形する。
 * - BusinessException: そのまま整形済み body を返す
 * - class-validator の 400: VALIDATION_ERROR に変換
 * - Prisma の既知エラー: 409/404 等にマッピング
 * - その他 500: 詳細を隠してログ ID のみ返す
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    // 既に整形済み（BusinessException）
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null && 'error' in body) {
        return res.status(status).json(body);
      }
      // Nest 標準例外（ValidationPipe 含む）
      const message =
        typeof body === 'object' && body !== null && 'message' in body
          ? (body as any).message
          : exception.message;
      const code =
        status === HttpStatus.UNPROCESSABLE_ENTITY || status === HttpStatus.BAD_REQUEST
          ? 'VALIDATION_ERROR'
          : status === HttpStatus.UNAUTHORIZED
            ? 'unauthorized'
            : status === HttpStatus.FORBIDDEN
              ? 'forbidden'
              : status === HttpStatus.NOT_FOUND
                ? 'not_found'
                : 'error';
      const details = Array.isArray(message)
        ? message.map((m: string) => ({ reason: m }))
        : undefined;
      return res.status(status).json({
        error: { code, message: Array.isArray(message) ? '入力値が不正です' : message, details },
      });
    }

    // Prisma の既知エラー
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return res.status(HttpStatus.CONFLICT).json({
          error: {
            code: 'conflict',
            message: '一意制約に違反しています',
            details: [{ reason: 'unique_violation' }],
          },
        });
      }
      if (exception.code === 'P2025') {
        return res
          .status(HttpStatus.NOT_FOUND)
          .json({ error: { code: 'not_found', message: 'リソースが見つかりません' } });
      }
      // EXCLUDE 制約（期間重複）などの raw な制約違反は P2010/P2034 等で来ることがある
    }
    if (
      exception instanceof Prisma.PrismaClientUnknownRequestError ||
      (exception as any)?.message?.includes?.('user_work_pattern_no_overlap')
    ) {
      return res.status(HttpStatus.CONFLICT).json({
        error: {
          code: 'overlap',
          message: '割当期間が重複しています',
          details: [{ reason: 'overlap' }],
        },
      });
    }

    const logId = randomUUID();
    this.logger.error(`Unhandled exception [${logId}]`, exception as any);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: 'internal_error',
        message: 'サーバ内部エラーが発生しました',
        details: [{ reason: logId }],
      },
    });
  }
}
