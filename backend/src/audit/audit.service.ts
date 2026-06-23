import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** 監査ログ（F-1102）。重要操作の証跡を記録する。 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(params: {
    orgId: string;
    actorId?: string | null;
    action: string;
    target?: string;
    detail?: Prisma.InputJsonValue;
    tx?: Prisma.TransactionClient;
  }): Promise<void> {
    const client = params.tx ?? this.prisma;
    await client.auditLog.create({
      data: {
        orgId: params.orgId,
        actorId: params.actorId ?? null,
        action: params.action,
        target: params.target,
        detail: params.detail,
      },
    });
  }
}
