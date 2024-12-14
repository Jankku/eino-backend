import { ITask } from 'pg-promise';
import { Logger } from '../util/logger';

export type Role = {
  id: number;
  name: 'admin' | 'basic' | 'demo';
  created_on: Date;
};

export const roleMap = new Map<Role['name'], Role>();

export const initRoleMap = async (t: ITask<unknown>): Promise<void> => {
  const roles = await t.many<Role>('SELECT * FROM roles');
  for (const role of roles) {
    roleMap.set(role.name, role);
  }
  Logger.info('Role map initialized');
};

export const getDefaultRoleId = (): Role['id'] => {
  const hasRole = roleMap.has('basic');
  if (!hasRole) throw new Error('Role map not initialized');
  return roleMap.get('basic')!.id;
};
