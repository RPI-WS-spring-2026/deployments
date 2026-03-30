'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getProjects } from '@/lib/api';

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const data = await getProjects();
        setProjects(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchProjects();
  }, []);

  if (loading) {
    return <div className="loading">Loading projects...</div>;
  }

  if (error) {
    return <div className="error-box">Error: {error}</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Projects</h1>
        <Link href="/projects/new" className="btn btn-primary">
          Create Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="card">
          <p>No projects yet. Create your first project!</p>
        </div>
      ) : (
        <div>
          {projects.map((project) => (
            <div key={project._id} className="card">
              <h2 style={{ marginBottom: '0.5rem' }}>
                <Link href={`/projects/${project._id}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                  {project.name}
                </Link>
              </h2>
              {project.description && (
                <p style={{ color: '#6b7280' }}>{project.description}</p>
              )}
              <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem' }}>
                Created: {new Date(project.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
