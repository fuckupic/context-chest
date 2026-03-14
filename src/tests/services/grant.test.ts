import { GrantService } from '../../services/grant';

describe('GrantService', () => {
  describe('checkPermission', () => {
    const service = new GrantService();

    it('should allow tool role to recall and browse', () => {
      expect(service.hasPermission('tool', 'recall')).toBe(true);
      expect(service.hasPermission('tool', 'browse')).toBe(true);
    });

    it('should deny tool role from remember and forget', () => {
      expect(service.hasPermission('tool', 'remember')).toBe(false);
      expect(service.hasPermission('tool', 'content')).toBe(false);
      expect(service.hasPermission('tool', 'forget')).toBe(false);
      expect(service.hasPermission('tool', 'sessions')).toBe(false);
      expect(service.hasPermission('tool', 'grants')).toBe(false);
    });

    it('should allow assistant role read + write but not delete/grants', () => {
      expect(service.hasPermission('assistant', 'recall')).toBe(true);
      expect(service.hasPermission('assistant', 'browse')).toBe(true);
      expect(service.hasPermission('assistant', 'remember')).toBe(true);
      expect(service.hasPermission('assistant', 'content')).toBe(true);
      expect(service.hasPermission('assistant', 'sessions')).toBe(true);
      expect(service.hasPermission('assistant', 'forget')).toBe(false);
      expect(service.hasPermission('assistant', 'grants')).toBe(false);
    });

    it('should allow admin role everything', () => {
      expect(service.hasPermission('admin', 'recall')).toBe(true);
      expect(service.hasPermission('admin', 'remember')).toBe(true);
      expect(service.hasPermission('admin', 'forget')).toBe(true);
      expect(service.hasPermission('admin', 'grants')).toBe(true);
      expect(service.hasPermission('admin', 'sessions')).toBe(true);
    });
  });

  describe('permissionsForRole', () => {
    const service = new GrantService();

    it('should return correct permissions for each role', () => {
      expect(service.permissionsForRole('tool')).toEqual(['recall', 'browse']);
      expect(service.permissionsForRole('assistant')).toEqual(
        expect.arrayContaining(['recall', 'browse', 'remember', 'content', 'sessions'])
      );
      expect(service.permissionsForRole('admin')).toEqual(
        expect.arrayContaining(['recall', 'browse', 'remember', 'content', 'sessions', 'forget', 'grants'])
      );
    });
  });

  describe('deriveScopesFromRole', () => {
    const service = new GrantService();

    it('should derive backward-compatible scopes', () => {
      expect(service.deriveScopesFromRole('tool')).toEqual(['vault.read']);
      expect(service.deriveScopesFromRole('assistant')).toEqual(['vault.read', 'vault.write']);
      expect(service.deriveScopesFromRole('admin')).toEqual(['vault.read', 'vault.write']);
    });
  });
});
