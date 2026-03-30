import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Task from '@/models/Task';
import Project from '@/models/Project';
import { verifyAuth } from '@/lib/auth';

// GET /api/tasks/:id — Get single task
export async function GET(request, { params }) {
  try {
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Access token required' }, { status: 401 });
    }

    await connectDB();
    const task = await Task.findById(params.id);

    if (!task) {
      return NextResponse.json({ message: 'Task not found' }, { status: 404 });
    }

    const project = await Project.findOne({ _id: task.projectId, userId: user.userId });
    if (!project) {
      return NextResponse.json({ message: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return NextResponse.json({ message: 'Task not found' }, { status: 404 });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

// PUT /api/tasks/:id — Update task
export async function PUT(request, { params }) {
  try {
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Access token required' }, { status: 401 });
    }

    await connectDB();
    const { title, description, status } = await request.json();

    const task = await Task.findById(params.id);

    if (!task) {
      return NextResponse.json({ message: 'Task not found' }, { status: 404 });
    }

    const project = await Project.findOne({ _id: task.projectId, userId: user.userId });
    if (!project) {
      return NextResponse.json({ message: 'Task not found' }, { status: 404 });
    }

    if (title !== undefined) {
      if (!title.trim()) {
        return NextResponse.json({ message: 'Title cannot be empty' }, { status: 400 });
      }
      task.title = title.trim();
    }

    if (description !== undefined) {
      task.description = description?.trim();
    }

    if (status !== undefined) {
      const validStatuses = ['todo', 'in-progress', 'done'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ message: 'Invalid status value' }, { status: 400 });
      }
      task.status = status;
    }

    await task.save();
    return NextResponse.json(task);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    if (error.kind === 'ObjectId') {
      return NextResponse.json({ message: 'Task not found' }, { status: 404 });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

// DELETE /api/tasks/:id — Delete task
export async function DELETE(request, { params }) {
  try {
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Access token required' }, { status: 401 });
    }

    await connectDB();
    const task = await Task.findById(params.id);

    if (!task) {
      return NextResponse.json({ message: 'Task not found' }, { status: 404 });
    }

    const project = await Project.findOne({ _id: task.projectId, userId: user.userId });
    if (!project) {
      return NextResponse.json({ message: 'Task not found' }, { status: 404 });
    }

    await task.deleteOne();
    return NextResponse.json({ message: 'Task deleted successfully' });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return NextResponse.json({ message: 'Task not found' }, { status: 404 });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
