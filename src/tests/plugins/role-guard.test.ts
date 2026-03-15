import { rolePermissions, extractRoleFromToken } from '../../plugins/role-guard';

describe('role-guard', () => {
  describe('rolePermissions', () => {
    it('should map tool to read-only permissions', () => {
      expect(rolePermissions('tool')).toEqual(
        expect.arrayContaining(['recall', 'browse'])
      );
      expect(rolePermissions('tool')).not.toContain('remember');
    });

    it('should map admin to all permissions', () => {
      const perms = rolePermissions('admin');
      expect(perms).toContain('forget');
      expect(perms).toContain('grants');
    });
  });

  describe('extractRoleFromToken', () => {
    it('should return admin for direct JWT (owner)', () => {
      const decoded = { sub: 'user-1' };
      expect(extractRoleFromToken(decoded)).toBe('admin');
    });

    it('should return role from grant token', () => {
      const decoded = { sub: 'user-1', aud: 'client-1', role: 'tool' };
      expect(extractRoleFromToken(decoded)).toBe('tool');
    });

    it('should default to tool for grant without role', () => {
      const decoded = { sub: 'user-1', aud: 'client-1' };
      expect(extractRoleFromToken(decoded)).toBe('tool');
    });
  });
});
