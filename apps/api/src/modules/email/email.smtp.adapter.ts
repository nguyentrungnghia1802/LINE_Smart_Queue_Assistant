import nodemailer, { type Transporter } from 'nodemailer';

import { config } from '../../config';

import type { EmailMessage, IEmailAdapter } from './email.types';

export class SmtpEmailAdapter implements IEmailAdapter {
  private readonly transporter: Transporter;

  constructor() {
    if (!config.email.smtp.host || !config.email.smtp.user || !config.email.smtp.password) {
      throw new Error('SMTP_HOST, SMTP_USER and SMTP_PASSWORD are required for SMTP email');
    }
    this.transporter = nodemailer.createTransport({
      host: config.email.smtp.host,
      port: config.email.smtp.port,
      secure: config.email.smtp.secure,
      auth: {
        user: config.email.smtp.user,
        pass: config.email.smtp.password,
      },
    });
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: {
        name: message.fromName,
        address: message.fromAddress,
      },
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}
