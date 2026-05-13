import dotenv from 'dotenv';
import { connectToDatabase, mongoose } from './db.js';
import Attendance from '../models/Attendance.js';
import Department from '../models/Department.js';
import Student from '../models/Student.js';

dotenv.config();

const SAMPLE_DEPARTMENT = {
  name: 'เทคโนโลยีสารสนเทศ',
  code: 'IT',
};

const SAMPLE_STUDENTS = [
  { student_id: 'IT001', title: 'นาย', first_name: 'สมชาย', last_name: 'ใจดี', level: 'ปวช.', year: '1', group: '1' },
  { student_id: 'IT002', title: 'นาย', first_name: 'นพดล', last_name: 'สุขสวัสดิ์', level: 'ปวช.', year: '1', group: '1' },
  { student_id: 'IT003', title: 'นางสาว', first_name: 'ธัญญา', last_name: 'เรืองศรี', level: 'ปวช.', year: '1', group: '1' },
  { student_id: 'IT004', title: 'นาย', first_name: 'ปรชญา', last_name: 'สมบูรณ์', level: 'ปวช.', year: '1', group: '1' },
  { student_id: 'IT005', title: 'นาย', first_name: 'วิชัย', last_name: 'มั่นคง', level: 'ปวช.', year: '1', group: '1' },
];

const STATUS_BY_DAY = [
  ['มา', 'มา', 'มา', 'สาย', 'มา'],
  ['มา', 'ขาด', 'มา', 'มา', 'มา'],
  ['ลา', 'มา', 'มา', 'มา', 'สาย'],
  ['มา', 'มา', 'ขาด', 'มา', 'มา'],
  ['มา', 'มา', 'มา', 'มา', 'ลา'],
];

const getLastFiveDates = () => {
  const base = new Date();
  return Array.from({ length: 5 }, (_, index) => {
    const date = new Date(base);
    date.setDate(base.getDate() - (4 - index));
    return date.toISOString().split('T')[0];
  });
};

async function seed() {
  await connectToDatabase();

  const department = await Department.findOneAndUpdate(
    { name: SAMPLE_DEPARTMENT.name },
    SAMPLE_DEPARTMENT,
    { upsert: true, new: true, runValidators: true }
  );

  const students = [];
  for (const studentData of SAMPLE_STUDENTS) {
    const student = await Student.findOneAndUpdate(
      { student_id: studentData.student_id },
      {
        ...studentData,
        department: department._id,
        advisor_email: 'teacher@local',
      },
      { upsert: true, new: true, runValidators: true }
    );
    students.push(student);
  }

  const dates = getLastFiveDates();
  for (let dateIndex = 0; dateIndex < dates.length; dateIndex += 1) {
    for (let studentIndex = 0; studentIndex < students.length; studentIndex += 1) {
      await Attendance.findOneAndUpdate(
        { student: students[studentIndex]._id, date: dates[dateIndex] },
        {
          date: dates[dateIndex],
          student: students[studentIndex]._id,
          status: STATUS_BY_DAY[dateIndex][studentIndex],
          note: STATUS_BY_DAY[dateIndex][studentIndex] === 'มา' ? '' : 'ข้อมูลตัวอย่าง',
          recorded_by: 'seed-script',
        },
        { upsert: true, new: true, runValidators: true }
      );
    }
  }

  console.log('Seed completed');
  console.log(`Department: ${department.name}`);
  console.log(`Students: ${students.length}`);
  console.log(`Attendance days: ${dates.length}`);

  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error('Seed failed:', error.message);
  await mongoose.disconnect();
  process.exit(1);
});