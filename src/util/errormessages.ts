const errorMessages = {
  USER_EXISTS: 'User already exists',
  USERNAME_REQUIRED: 'Username required',
  USERNAME_TYPE_ERROR: 'Username should be a string',
  PASSWORD_REQUIRED: 'Password required',
  PASSWORD_TYPE_ERROR: 'Password should be a string',
  PASSWORD_CONFIRM_REQUIRED: 'Confirm password required',
  PASSWORDS_NO_MATCH: "Passwords don't match",
  USERNAME_LENGTH_INVALID: 'Username length should be between 3-255 characters',
  PASSWORD_LENGTH_INVALID: 'Password length should be between 8-255 characters',
  PASSWORD_NO_MATCH: "Passwords don't match",
  REFRESHTOKEN_REQUIRED: 'refreshToken required',
  LIST_STATUS_INVALID: 'Invalid status',
  LIST_ID_REQUIRED: 'Id required',
  LIST_ID_TYPE_ERROR: 'Id must be a string',
  SEARCH_QUERY_TYPE_ERROR: 'Query must be a string',
  EMAIL_INVALID: 'Invalid email',
  EMAIL_EXISTS: 'Email already exists',
  OTP_INVALID: 'Invalid one-time password',
};

export default errorMessages;
