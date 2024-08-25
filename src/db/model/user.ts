type User = {
  user_id: string;
  username: string;
  password: string;
  email: string | null;
  email_verified_on: Date;
  totp_enabled_on: Date;
  last_login_on: Date;
  created_on: Date;
};

export default User;
