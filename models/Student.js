import mongoose from 'mongoose';

const StudentSchema = new mongoose.Schema(
  {
    student_id: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    title: {
      type: String,
      trim: true,
      default: '',
    },
    first_name: {
      type: String,
      required: true,
      trim: true,
    },
    last_name: {
      type: String,
      required: true,
      trim: true,
    },
    level: {
      type: String,
      trim: true,
      default: 'ปวช.',
    },
    year: {
      type: String,
      trim: true,
      default: '1',
    },
    group: {
      type: String,
      trim: true,
      default: '',
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    advisor_email: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: {
      createdAt: 'created_date',
      updatedAt: 'updated_date',
    },
  }
);

export default mongoose.models.Student || mongoose.model('Student', StudentSchema);