import { buildL0Prompt, buildL1Prompt, parseL0Response, parseL1Response } from '../summarizer';

describe('summarizer', () => {
  describe('buildL0Prompt', () => {
    it('should create a prompt for one-line abstract', () => {
      const prompt = buildL0Prompt('The user prefers dark mode in VS Code with 2-space tabs.');
      expect(prompt).toContain('one sentence');
      expect(prompt).toContain('no secrets');
      expect(prompt).toContain('dark mode');
    });

    it('should truncate very long content', () => {
      const long = 'x'.repeat(10000);
      const prompt = buildL0Prompt(long);
      expect(prompt.length).toBeLessThan(6000);
    });
  });

  describe('buildL1Prompt', () => {
    it('should create a prompt for structured overview', () => {
      const prompt = buildL1Prompt('The user prefers dark mode.');
      expect(prompt).toContain('structured overview');
      expect(prompt).toContain('Do NOT include');
    });
  });

  describe('parseL0Response', () => {
    it('should trim and truncate to 500 chars', () => {
      const result = parseL0Response('  A summary of preferences.  ');
      expect(result).toBe('A summary of preferences.');
    });

    it('should truncate beyond 500 chars', () => {
      const long = 'a'.repeat(600);
      const result = parseL0Response(long);
      expect(result.length).toBeLessThanOrEqual(500);
    });
  });

  describe('parseL1Response', () => {
    it('should trim and truncate to 10000 chars', () => {
      const result = parseL1Response('## Overview\n- Item 1');
      expect(result).toBe('## Overview\n- Item 1');
    });
  });
});
