/**
 * API Client — with JWT authentication support
 *
 * Since the API routes live on the same origin (/api/...),
 * no base URL is needed. The token is stored in localStorage
 * and sent with every request via the Authorization header.
 */

// ============ Auth Token Management ============

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function setToken(token) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('token', token);
}

export function clearToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
}

export function getUsername() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('username');
}

export function setUsername(username) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('username', username);
}

export function clearUsername() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('username');
}

// ============ Core Fetch ============

async function fetchAPI(endpoint, options = {}) {
  const token = getToken();

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    ...options,
  };

  const response = await fetch(endpoint, config);

  // Redirect to login on 401
  if (response.status === 401 && typeof window !== 'undefined') {
    clearToken();
    clearUsername();
    window.location.href = '/login';
    throw new Error('Session expired. Please log in again.');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.error || error.message || 'API request failed');
  }

  return response.json();
}

// ============ Auth API ============

export async function register(username, password) {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Registration failed');
  }
  return data;
}

export async function login(username, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Login failed');
  }
  // Store the token and username
  setToken(data.token);
  setUsername(username);
  return data;
}

export function logout() {
  clearToken();
  clearUsername();
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}

// ============ Projects API ============

export async function getProjects() {
  return fetchAPI('/api/projects');
}

export async function getProject(id) {
  return fetchAPI(`/api/projects/${id}`);
}

export async function createProject(data) {
  return fetchAPI('/api/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProject(id, data) {
  return fetchAPI(`/api/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteProject(id) {
  return fetchAPI(`/api/projects/${id}`, {
    method: 'DELETE',
  });
}

// ============ Tasks API ============

export async function getTasksByProject(projectId) {
  return fetchAPI(`/api/projects/${projectId}/tasks`);
}

export async function createTask(projectId, data) {
  return fetchAPI(`/api/projects/${projectId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getTask(id) {
  return fetchAPI(`/api/tasks/${id}`);
}

export async function updateTask(id, data) {
  return fetchAPI(`/api/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteTask(id) {
  return fetchAPI(`/api/tasks/${id}`, {
    method: 'DELETE',
  });
}
