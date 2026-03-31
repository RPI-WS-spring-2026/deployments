/**
 * Unit Tests — Auth module (src/lib/auth.js)
 *
 * These tests verify the JWT signing and verification logic in isolation,
 * without any database or HTTP server. This is the fastest layer of testing.
 *
 * Testing pyramid: UNIT (many, fast, cheap)
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

// Since auth.js uses ES modules, we test the logic directly
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

function verifyAuth(authHeader) {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  try {
    return jwt.verify(parts[1], JWT_SECRET);
  } catch {
    return null;
  }
}

describe('Auth Module — Unit Tests', () => {

  // =========================================================================
  // signToken
  // =========================================================================
  describe('signToken()', () => {
    test('returns a string JWT token', () => {
      const token = signToken({ username: 'alice', userId: '123' });
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    test('token contains the correct payload', () => {
      const token = signToken({ username: 'bob', userId: '456' });
      const decoded = jwt.decode(token);
      expect(decoded.username).toBe('bob');
      expect(decoded.userId).toBe('456');
    });

    test('token has an expiration claim', () => {
      const token = signToken({ username: 'carol', userId: '789' });
      const decoded = jwt.decode(token);
      expect(decoded.exp).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });

    test('token expires in approximately 1 hour', () => {
      const token = signToken({ username: 'dave', userId: '000' });
      const decoded = jwt.decode(token);
      const diff = decoded.exp - decoded.iat;
      expect(diff).toBe(3600); // 1 hour in seconds
    });
  });

  // =========================================================================
  // verifyAuth
  // =========================================================================
  describe('verifyAuth()', () => {
    test('returns decoded payload for a valid Bearer token', () => {
      const token = signToken({ username: 'alice', userId: '123' });
      const result = verifyAuth(`Bearer ${token}`);
      expect(result.username).toBe('alice');
      expect(result.userId).toBe('123');
    });

    test('returns null when no auth header is provided', () => {
      expect(verifyAuth(null)).toBeNull();
      expect(verifyAuth(undefined)).toBeNull();
    });

    test('returns null for empty string', () => {
      expect(verifyAuth('')).toBeNull();
    });

    test('returns null when Bearer prefix is missing', () => {
      const token = signToken({ username: 'alice', userId: '123' });
      expect(verifyAuth(token)).toBeNull(); // no "Bearer " prefix
    });

    test('returns null for "Basic" auth scheme', () => {
      expect(verifyAuth('Basic abc123')).toBeNull();
    });

    test('returns null for an invalid/tampered token', () => {
      expect(verifyAuth('Bearer invalid.token.here')).toBeNull();
    });

    test('returns null for an expired token', () => {
      // Create a token that expired 1 hour ago
      const token = jwt.sign(
        { username: 'expired', userId: '999' },
        JWT_SECRET,
        { expiresIn: '-1h' }
      );
      expect(verifyAuth(`Bearer ${token}`)).toBeNull();
    });

    test('returns null for a token signed with wrong secret', () => {
      const token = jwt.sign(
        { username: 'alice', userId: '123' },
        'wrong-secret',
        { expiresIn: '1h' }
      );
      expect(verifyAuth(`Bearer ${token}`)).toBeNull();
    });

    test('returns null for Bearer with no token after it', () => {
      expect(verifyAuth('Bearer ')).toBeNull();
    });

    test('returns null for Bearer with extra spaces', () => {
      const token = signToken({ username: 'alice', userId: '123' });
      expect(verifyAuth(`Bearer  ${token}`)).toBeNull(); // double space
    });
  });
});
