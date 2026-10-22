import { Role, roleMap } from '../db/role';

export const roleIdToName = (id: number): Role['name'] => {
  for (const [name, role] of roleMap) {
    if (role.id === id) return name;
  }
  throw new Error(`Role id ${id} not found`);
};
