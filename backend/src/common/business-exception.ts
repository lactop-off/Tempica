import { HttpException, HttpStatus } from '@nestjs/common';

export interface ErrorDetail {
  field?: string;
  reason: string;
}

/**
 * 業務バリデーション違反を表す例外。
 * 設計書 E. の統一レスポンス形式 { error: { code, message, details } } に整形される。
 */
export class BusinessException extends HttpException {
  constructor(
    status: HttpStatus,
    public readonly code: string,
    message: string,
    public readonly details?: ErrorDetail[],
  ) {
    super({ error: { code, message, details } }, status);
  }

  static validation(message: string, details?: ErrorDetail[]) {
    return new BusinessException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'VALIDATION_ERROR',
      message,
      details,
    );
  }

  static conflict(code: string, message: string, details?: ErrorDetail[]) {
    return new BusinessException(HttpStatus.CONFLICT, code, message, details);
  }

  static forbidden(code: string, message: string) {
    return new BusinessException(HttpStatus.FORBIDDEN, code, message);
  }

  static notFound(message = 'リソースが見つかりません') {
    return new BusinessException(HttpStatus.NOT_FOUND, 'not_found', message);
  }
}
