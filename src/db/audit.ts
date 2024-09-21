import { ITask } from 'pg-promise';

export const auditAction = {
  LOGIN: 'login',
  REGISTER: 'register',
  PASSWORD_FORGOT: 'password_forgot',
  PASSWORD_RESET_EMAIL_SENT: 'password_reset_email_sent',
  PASSWORD_RESETED: 'password_reseted',
  EMAIL_UPDATED: 'email_updated',
  EMAIL_VERIFICATION_EMAIL_SENT: 'email_verification_email_sent',
  EMAIL_VERIFIED: 'email_verified',
  TWO_FACTOR_AUTHENTICATION_ENABLED: 'two_factor_authentication_enabled',
  TWO_FACTOR_AUTHENTICATION_DISABLED: 'two_factor_authentication_disabled',
  PROFILE_SHARED: 'profile_shared',
  PROFILE_PICTURE_UPDATED: 'profile_picture_updated',
  PROFILE_DATA_EXPORTED: 'profile_data_exported',
  PROFILE_DATA_IMPORTED: 'profile_data_imported',
  ACCOUNT_DELETED: 'account_deleted',
  ACCESS_TOKEN_REFRESHED: 'access_token_refresh',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
} as const;

export type AuditAction = (typeof auditAction)[keyof typeof auditAction];

export type Audit = {
  username: string;
  action: AuditAction;
  table_name?: 'users' | 'books' | 'movies' | 'user_book_list' | 'user_movie_list';
  record_id?: string;
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
};

export type DbAudit = Audit & {
  id: number;
  created_on: Date;
};

export const getAuditsByUsername = async (
  t: ITask<unknown>,
  username: string,
): Promise<DbAudit[]> => {
  return await t.any(
    'SELECT * FROM audit_log WHERE username = $1 ORDER BY created_on ASC',
    username,
  );
};

export const getAuditsByActionNewerThan = async (
  t: ITask<unknown>,
  { actions, date }: { actions: AuditAction[]; date: Date },
): Promise<DbAudit[]> => {
  return await t.any(
    'SELECT * FROM audit_log WHERE action IN ($1:list) AND created_on > $2 ORDER BY created_on ASC',
    [actions, date],
  );
};

export const addAudit = async (t: ITask<unknown>, audit: Audit): Promise<void> => {
  const newAudit: Audit = {
    table_name: undefined,
    record_id: undefined,
    old_data: undefined,
    new_data: undefined,
    ...audit,
  };
  await t.none(
    'INSERT INTO audit_log(username, action, table_name, record_id, old_data, new_data) VALUES(${username}, ${action}, ${table_name}, ${record_id}, ${old_data}, ${new_data})',
    newAudit,
  );
};
