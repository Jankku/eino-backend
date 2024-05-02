type User = {
  user_id: string;
  username: string;
  email?: string;
  email_verified_on: Date;
  password: string;
  created_on: Date;
  last_login_on: Date;
};

export default User;
