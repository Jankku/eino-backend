const generateEmailVerifyLink = (token: string): string => {
  return `URL_HERE/?token=${token}`;
};

export { generateEmailVerifyLink };
