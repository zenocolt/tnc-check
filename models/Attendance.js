import mongoose from 'mongoose';

const AttendanceSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['มา', 'สาย', 'ขาด', 'ลา'],
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    recorded_by: {
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

AttendanceSchema.index({ student: 1, date: 1 }, { unique: true });

export default mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);