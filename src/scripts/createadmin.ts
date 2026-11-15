// Creates an admin account from ADMIN_USERNAME and ADMIN_PASSWORD: `npm run create-admin`.
import { z } from 'zod';
import { db, pgp } from '../db/config.ts';
import { addAudit } from '../db/audit.ts';
import { isUserUnique } from '../db/users.ts';
import { getPasswordStrength } from '../util/auth.ts';
import { Logger, logError } from '../util/logger.ts';
import { generatePasswordHash } from '../util/password.ts';
import { passwordSchema, usernameSchema } from '../util/zodschema.ts';

const createAdmin = async () => {
  const input = z
    .object({ ADMIN_USERNAME: usernameSchema, ADMIN_PASSWORD: passwordSchema })
    .safeParse(process.env);
  if (!input.success) {
    throw new Error(z.prettifyError(input.error));
  }
  const { ADMIN_USERNAME: username, ADMIN_PASSWORD: password } = input.data;

  const { isStrong, error } = getPasswordStrength({ username, password: password.trim() });
  if (!isStrong) {
    throw new Error(error);
  }

  await db.tx('createAdmin', async (t) => {
    if (!(await isUserUnique(t, username))) {
      throw new Error(`User ${username} already exists`);
    }
    const user = await t.one<{ user_id: string }>({
      text: `INSERT INTO users (username, password, role_id, role_modified_on)
             VALUES ($1, $2, (SELECT id FROM roles WHERE name = 'admin'), CURRENT_TIMESTAMP)
             RETURNING user_id`,
      values: [username, await generatePasswordHash(password)],
    });
    await addAudit(t, {
      actor_user_id: user.user_id,
      username,
      action: 'register',
      new_data: { role: 'admin' },
    });
  });
  Logger.info(`Admin ${username} created`);
};

try {
  await createAdmin();
} catch (error) {
  logError(error);
  process.exitCode = 1;
} finally {
  pgp.end();
}
