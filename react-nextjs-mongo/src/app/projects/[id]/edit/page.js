'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getProject, updateProject } from '@/lib/api';

export default function EditProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchProject() {
      try {
        const project = await getProject(projectId);
        setFormData({
          name: project.name,
          description: project.description || '',
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchProject();
  }, [projectId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Project name is required');
      return;
    }

    setSubmitting(true);

    try {
      await updateProject(projectId, formData);
      router.push(`/projects/${projectId}`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading project...</div>;
  }

  return (
    <div>
      <a href={`/projects/${projectId}`} className="back-link">&larr; Back to Project</a>
      <h1>Edit Project</h1>

      <form onSubmit={handleSubmit} className="card" style={{ marginTop: '2rem', maxWidth: '600px' }}>
        {error && <div className="error-box">{error}</div>}

        <div className="form-group">
          <label htmlFor="name">Project Name *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter project name"
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Enter project description"
            rows={4}
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => router.back()}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
