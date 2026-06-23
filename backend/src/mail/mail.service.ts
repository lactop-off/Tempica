import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * SMTP メール送信。SMTP_URL 未設定ならログ出力のみ（自己ホストで SMTP 未準備でも動作）。
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter?: nodemailer.Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('SMTP_URL');
    this.from = this.config.get<string>('SMTP_FROM', 'no-reply@example.com');
    if (url) {
      this.transporter = nodemailer.createTransport(url);
    }
  }

  async send(to: string, subject: string, text: string): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`[mail skipped] to=${to} subject=${subject}`);
      return;
    }
    await this.transporter.sendMail({ from: this.from, to, subject, text });
  }
}
