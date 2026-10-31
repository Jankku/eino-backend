import { Mail, MailtrapClient, SendError, SendResponse } from 'mailtrap';
import { config } from '../config';
import { Logger } from './logger';

export type EmailTemplate = {
  subject: string;
  text: string;
  category: 'confirm_email' | 'reset_password';
};

const client = new MailtrapClient({
  token: config.EMAIL_MAILTRAP_TOKEN || '',
  testInboxId: config.EMAIL_MAILTRAP_TEST_INBOX_ID,
  sandbox: !config.isProduction,
});

export const sendEmail = async ({
  recipient,
  template,
}: {
  recipient: string;
  template: EmailTemplate;
}): Promise<SendResponse | SendError> => {
  if (config.EMAIL_MAILTRAP_TOKEN && config.EMAIL_SENDER) {
    try {
      const mail: Mail = {
        ...template,
        from: { name: 'Eino', email: config.EMAIL_SENDER },
        to: [{ email: recipient }],
      };

      return config.isProduction || config.EMAIL_MAILTRAP_TEST_INBOX_ID
        ? await client.send(mail)
        : { success: false, errors: [] };
    } catch {
      Logger.error('Failed to send email');
      return { success: false, errors: [] };
    }
  }

  if (config.NODE_ENV === 'development') {
    Logger.info(`Email to ${recipient}: ${template.subject}\n${template.text}`);
    return { success: true, message_ids: [] };
  }

  return { success: false, errors: [] };
};
