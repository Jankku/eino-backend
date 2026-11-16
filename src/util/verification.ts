export const isVerificationExpired = (date: Date) => date.getTime() < Date.now();
