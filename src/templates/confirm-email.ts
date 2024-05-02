export const confirmEmailTemplate = (totp: number) => `
    <h1>Confirm your email</h1>
    <p>Enter the following code to confirm your email:</p>
    <h2>${totp}</h2>
    <p>If you didn't request to confirm your email, you can ignore this email.</p>
    `;
