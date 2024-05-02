export const passwordResetTemplate = (resetLink: string) => `
    <h1>Reset your password</h1>
    <p>Click the link below to reset your password:</p>
    <a href="${resetLink}">Reset your password</a>
    <p>If you didn't request a password reset, you can ignore this email.</p>
    `;
