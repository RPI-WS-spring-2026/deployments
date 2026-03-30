import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Project from '@/models/Project';
import Task from '@/models/Task';
import { verifyAuth } from '@/lib/auth';

// GET /api/projects/:id — Get single project
export async function GET(request, { params }) {
  try {
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Access token required' }, { status: 401 });
    }

    await connectDB();
    const project = await Project.findOne({ _id: params.id, userId: user.userId });

    if (!project) {
      return NextResponse.json({ message: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return NextResponse.json({ message: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

// PUT /api/projects/:id — Update project
export async function PUT(request, { params }) {
  try {
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Access token required' }, { status: 401 });
    }

    await connectDB();
    const { name, description } = await request.json();

    const project = await Project.findOne({ _id: params.id, userId: user.userId });

    if (!project) {
      return NextResponse.json({ message: 'Project not found' }, { status: 404 });
    }

    if (name !== undefined) {
      if (!name.trim()) {
        return NextResponse.json({ message: 'Name cannot be empty' }, { status: 400 });
      }
      project.name = name.trim();
    }

    if (description !== undefined) {
      project.description = description?.trim();
    }

    await project.save();
    return NextResponse.json(project);
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

// DELETE /api/projects/:id — Delete project and associated tasks
export async function DELETE(request, { params }) {
  try {
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Access token required' }, { status: 401 });
    }

    await connectDB();
    const project = await Project.findOne({ _id: params.id, userId: user.userId });

    if (!project) {
      return NextResponse.json({ message: 'Project not found' }, { status: 404 });
    }

    await Task.deleteMany({ projectId: project._id });
    await project.deleteOne();

    return NextResponse.json({ message: 'Project deleted successfully' });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return NextResponse.json({ message: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
