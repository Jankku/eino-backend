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

      return config.isProduction
        ? client.send(mail)
        : config.EMAIL_MAILTRAP_TEST_INBOX_ID
          ? client.testing.send(mail)
          : { success: false, errors: [] };
    } catch (error) {
      Logger.info((error as Error).message);
      return { success: false, errors: [] };
    }
  } else {
    Logger.info(`Email to ${recipient}: ${template.subject}\n${template.text}`);
    return new Promise((resolve) => resolve({ success: true, message_ids: [] }));
  }
};
