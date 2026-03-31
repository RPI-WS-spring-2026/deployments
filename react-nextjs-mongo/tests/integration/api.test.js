/**
 * Integration Tests — API endpoints
 *
 * These tests hit the actual API routes with HTTP requests against a running
 * Next.js server with a real MongoDB connection. They verify that routes,
 * middleware, database operations, and authentication work together.
 *
 * Testing pyramid: INTEGRATION (some, moderate speed)
 *
 * Prerequisites: The app must be running (docker compose up) and connected
 * to a MongoDB instance. These tests run against http://localhost:3003.
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3003';

// Generate unique usernames to avoid conflicts between test runs
const uniqueId = () => Math.random().toString(36).substring(2, 8);

async function api(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}

describe('API Integration Tests', () => {

  // =========================================================================
  // Auth endpoints — Registration
  // =========================================================================
  describe('POST /api/auth/register', () => {
    test('registers a new user and returns 201', async () => {
      const username = `testuser_${uniqueId()}`;
      const { status, data } = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password: 'password123' }),
      });
      expect(status).toBe(201);
      expect(data.message).toContain(username);
    });

    test('rejects duplicate username with 409', async () => {
      const username = `dupuser_${uniqueId()}`;
      // Register first time
      await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password: 'password123' }),
      });
      // Register same username again
      const { status, data } = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password: 'password456' }),
      });
      expect(status).toBe(409);
      expect(data.error).toContain('already exists');
    });

    test('rejects missing username with 400', async () => {
      const { status } = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ password: 'password123' }),
      });
      expect(status).toBe(400);
    });

    test('rejects missing password with 400', async () => {
      const { status } = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: 'nopass' }),
      });
      expect(status).toBe(400);
    });
  });

  // =========================================================================
  // Auth endpoints — Login
  // =========================================================================
  describe('POST /api/auth/login', () => {
    const loginUser = `logintest_${uniqueId()}`;
    const loginPass = 'securepassword';

    beforeAll(async () => {
      await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: loginUser, password: loginPass }),
      });
    });

    test('returns a JWT token on valid login', async () => {
      const { status, data } = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: loginUser, password: loginPass }),
      });
      expect(status).toBe(200);
      expect(data.token).toBeDefined();
      expect(data.token.split('.')).toHaveLength(3); // valid JWT format
    });

    test('rejects wrong password with 401', async () => {
      const { status, data } = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: loginUser, password: 'wrongpass' }),
      });
      expect(status).toBe(401);
      expect(data.error).toContain('Invalid');
    });

    test('rejects non-existent user with 401', async () => {
      const { status } = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'ghost_user_xyz', password: 'anything' }),
      });
      expect(status).toBe(401);
    });

    test('rejects missing credentials with 400', async () => {
      const { status } = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      expect(status).toBe(400);
    });
  });

  // =========================================================================
  // Protected endpoints — Projects
  // =========================================================================
  describe('Projects API (authenticated)', () => {
    let token;
    const projectUser = `projuser_${uniqueId()}`;

    beforeAll(async () => {
      await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: projectUser, password: 'pass123' }),
      });
      const { data } = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: projectUser, password: 'pass123' }),
      });
      token = data.token;
    });

    test('GET /api/projects returns 401 without token', async () => {
      const { status } = await api('/api/projects');
      expect(status).toBe(401);
    });

    test('POST /api/projects returns 401 without token', async () => {
      const { status } = await api('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name: 'Unauthorized' }),
      });
      expect(status).toBe(401);
    });

    test('GET /api/projects returns empty array for new user', async () => {
      const { status, data } = await api('/api/projects', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(status).toBe(200);
      expect(data).toEqual([]);
    });

    test('POST /api/projects creates a project and returns 201', async () => {
      const { status, data } = await api('/api/projects', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: 'Test Project', description: 'Integration test' }),
      });
      expect(status).toBe(201);
      expect(data.name).toBe('Test Project');
      expect(data.description).toBe('Integration test');
      expect(data.userId).toBeDefined();
      expect(data._id).toBeDefined();
    });

    test('GET /api/projects returns the created project', async () => {
      const { status, data } = await api('/api/projects', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(status).toBe(200);
      expect(data.length).toBeGreaterThanOrEqual(1);
      expect(data[0].name).toBe('Test Project');
    });

    test('POST /api/projects rejects empty name with 400', async () => {
      const { status } = await api('/api/projects', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: '' }),
      });
      expect(status).toBe(400);
    });
  });

  // =========================================================================
  // Authorization — User isolation
  // =========================================================================
  describe('Authorization (user isolation)', () => {
    let tokenA, tokenB;

    beforeAll(async () => {
      const userA = `userA_${uniqueId()}`;
      const userB = `userB_${uniqueId()}`;

      // Register and login user A
      await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: userA, password: 'pass123' }),
      });
      const resA = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: userA, password: 'pass123' }),
      });
      tokenA = resA.data.token;

      // Register and login user B
      await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: userB, password: 'pass456' }),
      });
      const resB = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: userB, password: 'pass456' }),
      });
      tokenB = resB.data.token;

      // User A creates a project
      await api('/api/projects', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ name: "User A's Secret Project" }),
      });
    });

    test("User B cannot see User A's projects", async () => {
      const { status, data } = await api('/api/projects', {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      expect(status).toBe(200);
      const projectNames = data.map(p => p.name);
      expect(projectNames).not.toContain("User A's Secret Project");
    });

    test("User A can see their own project", async () => {
      const { status, data } = await api('/api/projects', {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      expect(status).toBe(200);
      const projectNames = data.map(p => p.name);
      expect(projectNames).toContain("User A's Secret Project");
    });
  });
});
