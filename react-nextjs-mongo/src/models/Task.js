import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Project ID is required']
  },
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    maxlength: [200, 'Task title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  status: {
    type: String,
    enum: {
      values: ['todo', 'in-progress', 'done'],
      message: 'Status must be one of: todo, in-progress, done'
    },
    default: 'todo'
  }
}, {
  timestamps: true
});

taskSchema.index({ projectId: 1 });

export default mongoose.models.Task || mongoose.model('Task', taskSchema);
