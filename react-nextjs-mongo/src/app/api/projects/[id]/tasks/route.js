import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Project from '@/models/Project';
import Task from '@/models/Task';
import { verifyAuth } from '@/lib/auth';

// GET /api/projects/:id/tasks — List tasks for a project
export async function GET(request, { params }) {
  try {
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Access token required' }, { status: 401 });
    }

    await connectDB();
    const projectId = params.id;

    const project = await Project.findOne({ _id: projectId, userId: user.userId });
    if (!project) {
      return NextResponse.json({ message: 'Project not found' }, { status: 404 });
    }

    const tasks = await Task.find({ projectId }).sort({ createdAt: -1 });
    return NextResponse.json(tasks);
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return NextResponse.json({ message: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

// POST /api/projects/:id/tasks — Create a task in a project
export async function POST(request, { params }) {
  try {
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Access token required' }, { status: 401 });
    }

    await connectDB();
    const projectId = params.id;
    const { title, description, status } = await request.json();

    const project = await Project.findOne({ _id: projectId, userId: user.userId });
    if (!project) {
      return NextResponse.json({ message: 'Project not found' }, { status: 404 });
    }

    if (!title || !title.trim()) {
      return NextResponse.json({ message: 'Title is required' }, { status: 400 });
    }

    const task = await Task.create({
      projectId,
      title: title.trim(),
      description: description?.trim(),
      status: status || 'todo',
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    if (error.kind === 'ObjectId') {
      return NextResponse.json({ message: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
