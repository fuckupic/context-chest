import { Role } from '@prisma/client';

export type Permission =
  | 'recall'
  | 'browse'
  | 'remember'
  | 'content'
  | 'forget'
  | 'sessions'
  | 'grants';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  tool: ['recall', 'browse'],
  assistant: ['recall', 'browse', 'remember', 'content', 'sessions'],
  admin: ['recall', 'browse', 'remember', 'content', 'sessions', 'forget', 'grants'],
};

const ROLE_SCOPES: Record<Role, string[]> = {
  tool: ['vault.read'],
  assistant: ['vault.read', 'vault.write'],
  admin: ['vault.read', 'vault.write'],
};

export class GrantService {
  hasPermission(role: Role, permission: Permission): boolean {
    return ROLE_PERMISSIONS[role].includes(permission);
  }

  permissionsForRole(role: Role): Permission[] {
    return [...ROLE_PERMISSIONS[role]];
  }

  deriveScopesFromRole(role: Role): string[] {
    return [...ROLE_SCOPES[role]];
  }
}
