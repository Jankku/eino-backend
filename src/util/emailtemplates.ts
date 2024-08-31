import { EmailTemplate } from '../util/email';

export const confirmEmailTemplate = (totp: string): EmailTemplate => ({
  category: 'confirm_email',
  subject: 'Confirm your email',
  text: `
    Enter the following one-time code to confirm your email:
    
    ${totp}

    If you didn't request to confirm your email, you can ignore this email.
    `,
});

export const resetPasswordTemplate = (totp: string): EmailTemplate => ({
  category: 'reset_password',
  subject: 'Reset your password',
  text: `
    To reset your password, input the following one-time code on the reset password page:

    ${totp}

    If you didn't request a password reset, you can ignore this email.
    `,
});
