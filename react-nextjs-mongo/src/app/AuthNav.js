'use client';

import { useState, useEffect } from 'react';
import { getToken, getUsername, logout } from '@/lib/api';

export default function AuthNav() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsernameState] = useState('');

  useEffect(() => {
    const token = getToken();
    const user = getUsername();
    setLoggedIn(!!token);
    setUsernameState(user || '');
  }, []);

  return (
    <ul className="nav-links">
      {loggedIn ? (
        <>
          <li><a href="/projects">Projects</a></li>
          <li style={{ color: 'rgba(255,255,255,0.7)' }}>Hi, {username}</li>
          <li>
            <button
              onClick={logout}
              style={{
                background: 'none',
                border: '1px solid rgba(255,255,255,0.5)',
                color: 'white',
                padding: '0.25rem 0.75rem',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Logout
            </button>
          </li>
        </>
      ) : (
        <li><a href="/login">Login</a></li>
      )}
    </ul>
  );
}
