import { ITask } from 'pg-promise';

export type BulletinVisiblity = 'public' | 'user' | 'condition';

export type BulletinCondition = '2fa_not_enabled' | 'email_not_verified';

export type Bulletin = {
  title: string;
  content: string | null;
  visibility: BulletinVisiblity;
  condition: BulletinCondition | null;
  start_date: Date;
  end_date: Date;
};

export type DbBulletin = Bulletin & {
  id: string;
  created_on: Date;
};

export const getPublicBulletins = async (t: ITask<unknown>): Promise<DbBulletin[]> => {
  return await t.any(
    "SELECT id, title, content FROM bulletins WHERE visibility = 'public' AND start_date <= NOW() AND end_date >= NOW()",
  );
};

export const getUserBulletins = async (
  t: ITask<unknown>,
  { username }: { username: string },
): Promise<DbBulletin[]> => {
  return await t.any(
    "SELECT id, title, content FROM bulletins WHERE visibility = 'user' AND start_date <= NOW() AND end_date >= NOW()",
    { username },
  );
};

export const createBulletin = async (t: ITask<unknown>, bulletin: Partial<Bulletin>) => {
  await t.none(
    'INSERT INTO bulletins(title, content, visibility, condition, start_date, end_date) VALUES(${title}, ${content}, ${visibility}, ${condition}, ${start_date}, ${end_date})',
    bulletin,
  );
};
