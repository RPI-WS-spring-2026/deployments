'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/api';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // If logged in, redirect to projects
    if (getToken()) {
      router.push('/projects');
    }
  }, [router]);

  return (
    <div style={{ textAlign: 'center', marginTop: '4rem' }}>
      <h1>Welcome to Project Manager</h1>
      <p style={{ marginTop: '1rem', color: '#6b7280' }}>
        A simple project and task management application.
      </p>
      <p style={{ marginTop: '0.5rem', color: '#6b7280' }}>
        Log in to manage your projects and tasks.
      </p>
      <Link href="/login" className="btn btn-primary" style={{ marginTop: '2rem', display: 'inline-block' }}>
        Login / Register
      </Link>
    </div>
  );
}
