'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getProject, deleteProject, getTasksByProject, createTask, updateTask, deleteTask } from '@/lib/api';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id;

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Task form state
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskFormData, setTaskFormData] = useState({ title: '', description: '', status: 'todo' });
  const [editingTask, setEditingTask] = useState(null);
  const [taskSubmitting, setTaskSubmitting] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [projectData, tasksData] = await Promise.all([
          getProject(projectId),
          getTasksByProject(projectId),
        ]);
        setProject(projectData);
        setTasks(tasksData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [projectId]);

  const handleDeleteProject = async () => {
    if (!confirm('Are you sure you want to delete this project? All tasks will be deleted.')) {
      return;
    }

    try {
      await deleteProject(projectId);
      router.push('/projects');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleTaskSubmit = async (e) => {
    e.preventDefault();
    if (!taskFormData.title.trim()) return;

    setTaskSubmitting(true);
    try {
      if (editingTask) {
        const updated = await updateTask(editingTask._id, taskFormData);
        setTasks(tasks.map(t => t._id === editingTask._id ? updated : t));
      } else {
        const newTask = await createTask(projectId, taskFormData);
        setTasks([newTask, ...tasks]);
      }
      resetTaskForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setTaskSubmitting(false);
    }
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setTaskFormData({ title: task.title, description: task.description || '', status: task.status });
    setShowTaskForm(true);
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      await deleteTask(taskId);
      setTasks(tasks.filter(t => t._id !== taskId));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStatusChange = async (task, newStatus) => {
    try {
      const updated = await updateTask(task._id, { status: newStatus });
      setTasks(tasks.map(t => t._id === task._id ? updated : t));
    } catch (err) {
      setError(err.message);
    }
  };

  const resetTaskForm = () => {
    setShowTaskForm(false);
    setEditingTask(null);
    setTaskFormData({ title: '', description: '', status: 'todo' });
  };

  if (loading) {
    return <div className="loading">Loading project...</div>;
  }

  if (error) {
    return <div className="error-box">Error: {error}</div>;
  }

  if (!project) {
    return <div className="error-box">Project not found</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Link href="/projects" className="back-link">&larr; Back to Projects</Link>
          <h1 style={{ marginTop: '0.5rem' }}>{project.name}</h1>
          {project.description && (
            <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>{project.description}</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link href={`/projects/${projectId}/edit`} className="btn btn-primary">Edit</Link>
          <button onClick={handleDeleteProject} className="btn btn-danger">Delete</button>
        </div>
      </div>

      <hr style={{ margin: '2rem 0', border: 'none', borderTop: '1px solid #e5e7eb' }} />

      {/* Tasks Section */}
      <div>
        <div className="page-header">
          <h2>Tasks ({tasks.length})</h2>
          <button className="btn btn-primary" onClick={() => setShowTaskForm(true)}>
            Add Task
          </button>
        </div>

        {/* Task Form */}
        {showTaskForm && (
          <form onSubmit={handleTaskSubmit} className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>{editingTask ? 'Edit Task' : 'New Task'}</h3>
            <div className="form-group">
              <label htmlFor="taskTitle">Title *</label>
              <input
                type="text"
                id="taskTitle"
                value={taskFormData.title}
                onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                placeholder="Task title"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label htmlFor="taskDescription">Description</label>
              <textarea
                id="taskDescription"
                value={taskFormData.description}
                onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                placeholder="Task description"
                rows={2}
              />
            </div>
            <div className="form-group">
              <label htmlFor="taskStatus">Status</label>
              <select
                id="taskStatus"
                value={taskFormData.status}
                onChange={(e) => setTaskFormData({ ...taskFormData, status: e.target.value })}
              >
                <option value="todo">To Do</option>
                <option value="in-progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={taskSubmitting}>
                {taskSubmitting ? 'Saving...' : (editingTask ? 'Update' : 'Add Task')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetTaskForm}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Tasks List */}
        {tasks.length === 0 ? (
          <div className="card">
            <p>No tasks yet. Add your first task!</p>
          </div>
        ) : (
          <div>
            {tasks.map((task) => (
              <div key={task._id} className="card task-card">
                <div className="task-card-content">
                  <h3 style={{ marginBottom: '0.25rem' }}>{task.title}</h3>
                  {task.description && (
                    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>{task.description}</p>
                  )}
                </div>
                <div className="task-card-actions">
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusChange(task, e.target.value)}
                    className={`badge badge-${task.status}`}
                    style={{ cursor: 'pointer', border: 'none' }}
                  >
                    <option value="todo">To Do</option>
                    <option value="in-progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                  <button onClick={() => handleEditTask(task)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}>
                    Edit
                  </button>
                  <button onClick={() => handleDeleteTask(task._id)} className="btn btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
