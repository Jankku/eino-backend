import { ITask } from 'pg-promise';
import { DateTime } from 'luxon';
import { roleIdToName } from '../util/role';
import { DbBulletin } from './bulletins';
import { DbAudit } from './audit';
import { securityEventReasons, SecurityEventAction, securityEventsWhere } from './securityevents';

export const getAdminOverview = async (
  t: ITask<unknown>,
  period: { start_date?: string; end_date?: string },
) => {
  type OverviewCounts = {
    total_users: number;
    registered_users: number;
    total_books: number;
    added_books: number;
    total_movies: number;
    added_movies: number;
    email_verified: number;
    two_factor_enabled: number;
    disabled_accounts: number;
    active_bulletins: number;
    scheduled_bulletins: number;
  };

  type OverviewUser = {
    user_id: string;
    username: string;
    role_id: number;
    profile_picture_path: string | null;
    last_login_on: Date;
    book_count: number;
    movie_count: number;
  };

  const { generated_on } = await t.one<{ generated_on: Date }>(
    'SELECT CURRENT_TIMESTAMP AS generated_on',
  );
  const today = DateTime.fromJSDate(generated_on, { zone: 'utc' }).startOf('day');
  const start = period.start_date
    ? DateTime.fromISO(period.start_date, { zone: 'utc' })
    : today.minus({ days: 29 });
  const end = period.end_date ? DateTime.fromISO(period.end_date, { zone: 'utc' }) : today;

  const counts = await t.one<OverviewCounts>(
    `SELECT u.*, b.*, m.*, n.*
     FROM (
       SELECT COUNT(*) AS total_users,
         COUNT(*) FILTER (WHERE created_on >= $1 AND created_on < $2) AS registered_users,
         COUNT(*) FILTER (WHERE email_verified_on IS NOT NULL) AS email_verified,
         COUNT(*) FILTER (WHERE totp_enabled_on IS NOT NULL) AS two_factor_enabled,
         COUNT(*) FILTER (WHERE disabled_on IS NOT NULL) AS disabled_accounts
       FROM users
     ) u
     CROSS JOIN (
       SELECT COUNT(*) AS total_books,
         COUNT(*) FILTER (WHERE created_on >= $1 AND created_on < $2) AS added_books
       FROM books
     ) b
     CROSS JOIN (
       SELECT COUNT(*) AS total_movies,
         COUNT(*) FILTER (WHERE created_on >= $1 AND created_on < $2) AS added_movies
       FROM movies
     ) m
     CROSS JOIN (
       SELECT COUNT(*) FILTER (WHERE start_date <= CURRENT_TIMESTAMP) AS active_bulletins,
         COUNT(*) FILTER (WHERE start_date > CURRENT_TIMESTAMP) AS scheduled_bulletins
       FROM bulletins WHERE end_date >= CURRENT_TIMESTAMP AND end_date >= start_date
     ) n`,
    [start.toJSDate(), end.plus({ days: 1 }).toJSDate()],
  );

  const securityCounts = await t.any<{ action: SecurityEventAction; count: number }>(
    `SELECT action, COUNT(*) AS count FROM audit_log
     WHERE ${securityEventsWhere} GROUP BY action`,
  );
  const byAction = Object.fromEntries(
    Object.keys(securityEventReasons).map((action) => [
      action,
      securityCounts.find((row) => row.action === action)?.count ?? 0,
    ]),
  ) as Record<SecurityEventAction, number>;

  const users = await t.any<OverviewUser>(
    `SELECT u.user_id, u.username, u.role_id, u.profile_picture_path, u.last_login_on,
       (SELECT COUNT(*) FROM books b WHERE b.submitter = u.username) AS book_count,
       (SELECT COUNT(*) FROM movies m WHERE m.submitter = u.username) AS movie_count
     FROM (
       SELECT user_id, username, role_id, profile_picture_path, last_login_on
       FROM users WHERE last_login_on IS NOT NULL
       ORDER BY last_login_on DESC, user_id ASC LIMIT 5
     ) u
     ORDER BY u.last_login_on DESC, u.user_id ASC`,
  );
  const audits = await t.any<
    Pick<
      DbAudit,
      'id' | 'actor_user_id' | 'username' | 'action' | 'table_name' | 'record_id' | 'created_on'
    >
  >(
    `SELECT id, actor_user_id, username, action, table_name, record_id, created_on
     FROM audit_log WHERE created_on >= $1 AND created_on <= CURRENT_TIMESTAMP
     ORDER BY created_on DESC, id DESC LIMIT 5`,
    [today.toJSDate()],
  );
  const bulletins = await t.any<DbBulletin & { status: 'active' | 'scheduled' }>(
    `SELECT *, CASE WHEN start_date <= CURRENT_TIMESTAMP THEN 'active' ELSE 'scheduled' END AS status
     FROM bulletins WHERE end_date >= CURRENT_TIMESTAMP AND end_date >= start_date
     ORDER BY (start_date <= CURRENT_TIMESTAMP) DESC, start_date ASC, id ASC LIMIT 3`,
  );

  return {
    generated_on,
    period: { start_date: start.toISODate(), end_date: end.toISODate(), timezone: 'UTC' },
    users: { total: counts.total_users, registered: counts.registered_users },
    books: { total: counts.total_books, added: counts.added_books },
    movies: { total: counts.total_movies, added: counts.added_movies },
    security_events: {
      total: securityCounts.reduce((total, row) => total + row.count, 0),
      by_action: byAction,
    },
    recently_active_users: users.map((user) => ({ ...user, role: roleIdToName(user.role_id) })),
    account_security: {
      email_verified: counts.email_verified,
      email_unverified: counts.total_users - counts.email_verified,
      two_factor_enabled: counts.two_factor_enabled,
      two_factor_disabled: counts.total_users - counts.two_factor_enabled,
      disabled_accounts: counts.disabled_accounts,
    },
    recent_audit_activity: audits,
    bulletins: {
      active: counts.active_bulletins,
      scheduled: counts.scheduled_bulletins,
      items: bulletins,
    },
  };
};
