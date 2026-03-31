/**
 * Unit Tests — Input validation logic
 *
 * These tests verify validation rules that the API routes enforce.
 * We test the validation logic as pure functions — no HTTP, no database.
 *
 * Testing pyramid: UNIT (many, fast, cheap)
 */

// Validation functions extracted from route handlers for testability
function validateProjectInput(name) {
  if (!name || !name.trim()) return { valid: false, error: 'Name is required' };
  if (name.trim().length > 100) return { valid: false, error: 'Name too long' };
  return { valid: true, name: name.trim() };
}

function validateTaskInput(title, status) {
  if (!title || !title.trim()) return { valid: false, error: 'Title is required' };
  if (title.trim().length > 200) return { valid: false, error: 'Title too long' };
  if (status !== undefined) {
    const validStatuses = ['todo', 'in-progress', 'done'];
    if (!validStatuses.includes(status)) {
      return { valid: false, error: 'Invalid status value' };
    }
  }
  return { valid: true, title: title.trim(), status: status || 'todo' };
}

function validateAuthInput(username, password) {
  if (!username || !password) return { valid: false, error: 'Username and password are required' };
  if (typeof username !== 'string' || typeof password !== 'string') return { valid: false, error: 'Invalid input types' };
  return { valid: true };
}

describe('Validation — Unit Tests', () => {

  // =========================================================================
  // Project name validation
  // =========================================================================
  describe('validateProjectInput()', () => {
    test('accepts a valid project name', () => {
      const result = validateProjectInput('My Project');
      expect(result.valid).toBe(true);
      expect(result.name).toBe('My Project');
    });

    test('trims whitespace from project name', () => {
      const result = validateProjectInput('  Trimmed  ');
      expect(result.name).toBe('Trimmed');
    });

    test('rejects empty string', () => {
      expect(validateProjectInput('').valid).toBe(false);
    });

    test('rejects whitespace-only string', () => {
      expect(validateProjectInput('   ').valid).toBe(false);
    });

    test('rejects null', () => {
      expect(validateProjectInput(null).valid).toBe(false);
    });

    test('rejects undefined', () => {
      expect(validateProjectInput(undefined).valid).toBe(false);
    });

    test('rejects name longer than 100 characters', () => {
      const longName = 'a'.repeat(101);
      expect(validateProjectInput(longName).valid).toBe(false);
    });

    test('accepts name exactly 100 characters', () => {
      const name = 'a'.repeat(100);
      expect(validateProjectInput(name).valid).toBe(true);
    });
  });

  // =========================================================================
  // Task input validation
  // =========================================================================
  describe('validateTaskInput()', () => {
    test('accepts valid title with default status', () => {
      const result = validateTaskInput('Fix bug');
      expect(result.valid).toBe(true);
      expect(result.status).toBe('todo');
    });

    test('accepts valid title with explicit status', () => {
      const result = validateTaskInput('Fix bug', 'in-progress');
      expect(result.valid).toBe(true);
      expect(result.status).toBe('in-progress');
    });

    test('accepts all valid statuses', () => {
      expect(validateTaskInput('t', 'todo').valid).toBe(true);
      expect(validateTaskInput('t', 'in-progress').valid).toBe(true);
      expect(validateTaskInput('t', 'done').valid).toBe(true);
    });

    test('rejects invalid status', () => {
      expect(validateTaskInput('t', 'invalid').valid).toBe(false);
      expect(validateTaskInput('t', 'DONE').valid).toBe(false);
      expect(validateTaskInput('t', '').valid).toBe(false);
    });

    test('rejects empty title', () => {
      expect(validateTaskInput('').valid).toBe(false);
    });

    test('rejects title longer than 200 characters', () => {
      expect(validateTaskInput('a'.repeat(201)).valid).toBe(false);
    });
  });

  // =========================================================================
  // Auth input validation
  // =========================================================================
  describe('validateAuthInput()', () => {
    test('accepts valid username and password', () => {
      expect(validateAuthInput('alice', 'pass123').valid).toBe(true);
    });

    test('rejects missing username', () => {
      expect(validateAuthInput(null, 'pass').valid).toBe(false);
      expect(validateAuthInput('', 'pass').valid).toBe(false);
    });

    test('rejects missing password', () => {
      expect(validateAuthInput('alice', null).valid).toBe(false);
      expect(validateAuthInput('alice', '').valid).toBe(false);
    });

    test('rejects both missing', () => {
      expect(validateAuthInput(null, null).valid).toBe(false);
    });
  });
});
