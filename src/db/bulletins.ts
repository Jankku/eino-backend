import { ITask } from 'pg-promise';
import { pgp } from './config';

export const bulletinTypes = ['success', 'info', 'warning', 'error'] as const;
export type BulletinType = (typeof bulletinTypes)[number];

export const bulletinVisibilities = ['public', 'user', 'condition'] as const;
export type BulletinVisiblity = (typeof bulletinVisibilities)[number];

export const bulletinConditions = ['2fa_not_enabled', 'email_not_verified'] as const;
export type BulletinCondition = (typeof bulletinConditions)[number];

export type Bulletin = {
  title: string;
  message: string | null;
  name: string | null;
  type: BulletinType;
  visibility: BulletinVisiblity;
  condition: BulletinCondition | null;
  start_date: Date;
  end_date: Date;
};

export type DbBulletin = Bulletin & {
  id: string;
  created_on: Date;
  updated_on: Date;
};

export const getAllBulletins = async (t: ITask<unknown>): Promise<DbBulletin[]> => {
  return await t.any('SELECT * FROM bulletins');
};

export const getPublicBulletins = async (t: ITask<unknown>): Promise<DbBulletin[]> => {
  return await t.any(
    "SELECT id, title, message, name, type FROM bulletins WHERE visibility = 'public' AND start_date <= NOW() AND end_date >= NOW()",
  );
};

export const getUserBulletins = async (
  t: ITask<unknown>,
  userId: string,
): Promise<DbBulletin[]> => {
  return await t.any(
    'SELECT b.id, b.title, b.message, b.name, b.type FROM bulletins b JOIN bulletin_users bu ON b.id = bu.bulletin_id WHERE bu.user_id = $1 AND b.start_date <= NOW() AND b.end_date >= NOW()',
    [userId],
  );
};

export const createBulletin = async (
  t: ITask<unknown>,
  bulletin: Partial<Bulletin>,
): Promise<DbBulletin['id']> => {
  const result = await t.one(
    'INSERT INTO bulletins(title, message, name, type, visibility, condition, start_date, end_date) VALUES(${title}, ${message}, ${name}, ${type}, ${visibility}, ${condition}, ${start_date}, ${end_date}) RETURNING id',
    bulletin,
  );
  return result.id;
};

export const updateBulletin = async (
  t: ITask<unknown>,
  { bulletinId, bulletin }: { bulletinId: DbBulletin['id']; bulletin: Partial<Bulletin> },
) => {
  await t.none(
    'UPDATE bulletins SET title = ${title}, message = ${message}, name = ${name}, type = ${type}, visibility = ${visibility}, condition = ${condition}, start_date = ${start_date}, end_date = ${end_date}, updated_on = CURRENT_TIMESTAMP WHERE id = ${bulletinId}',
    { bulletinId, ...bulletin },
  );
};

const bulletinUsersCs = new pgp.helpers.ColumnSet(['bulletin_id', 'user_id'], {
  table: 'bulletin_users',
});

export const updateBulletinUsers = async (
  t: ITask<unknown>,
  { bulletinId, userIds }: { bulletinId: DbBulletin['id']; userIds: string[] },
) => {
  await t.none('DELETE FROM bulletin_users WHERE bulletin_id = $1', bulletinId);
  const values = userIds.map((userId) => ({ bulletin_id: bulletinId, user_id: userId }));
  await t.none(pgp.helpers.insert(values, bulletinUsersCs));
};

export const insertBulletinUsers = async (
  t: ITask<unknown>,
  { bulletinId, userIds }: { bulletinId: DbBulletin['id']; userIds: string[] },
) => {
  const values = userIds.map((userId) => ({ bulletin_id: bulletinId, user_id: userId }));
  await t.none(pgp.helpers.insert(values, bulletinUsersCs));
};

export const deleteBulletin = async (t: ITask<unknown>, bulletinId: string) => {
  await t.none('DELETE FROM bulletins WHERE id = $1', bulletinId);
};
