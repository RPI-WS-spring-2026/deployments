import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Project from '@/models/Project';
import { verifyAuth } from '@/lib/auth';

// GET /api/projects — List projects for the authenticated user
export async function GET(request) {
  try {
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Access token required' }, { status: 401 });
    }

    await connectDB();
    const projects = await Project.find({ userId: user.userId }).sort({ createdAt: -1 });
    return NextResponse.json(projects);
  } catch (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

// POST /api/projects — Create a project
export async function POST(request) {
  try {
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Access token required' }, { status: 401 });
    }

    await connectDB();
    const { name, description } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ message: 'Name is required' }, { status: 400 });
    }

    const project = await Project.create({
      name: name.trim(),
      description: description?.trim(),
      userId: user.userId,
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
