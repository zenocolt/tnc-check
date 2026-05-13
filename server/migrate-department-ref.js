import dotenv from 'dotenv';
import { connectToDatabase, getCollection, mongoose } from './db.js';
import Department from '../models/Department.js';
import Student from '../models/Student.js';

dotenv.config();

const normalizeStatus = (value) => {
  const status = String(value || '').trim().toLowerCase();
  if (!status) return value;

  if (status === 'present') return 'มา';
  if (status === 'absent') return 'ขาด';
  if (status === 'late') return 'สาย';
  if (status === 'leave') return 'ลา';
  return value;
};

const isObjectIdString = (value) => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);

async function resolveDepartmentIdByName(name, cache) {
  const cleanName = String(name || '').trim();
  if (!cleanName) return null;

  if (cache.has(cleanName)) {
    return cache.get(cleanName);
  }

  let department = await Department.findOne({ name: cleanName });
  if (!department) {
    department = await Department.create({ name: cleanName });
  }

  const id = department._id.toString();
  cache.set(cleanName, id);
  return id;
}

async function migrateStudentDepartments() {
  const studentsCollection = getCollection('Student');
  const cursor = studentsCollection.find({});
  const departmentCache = new Map();

  let converted = 0;
  let skipped = 0;

  // Keep iteration logic in raw collection space so invalid legacy docs can still be migrated.
  for await (const doc of cursor) {
    const value = doc.department;

    if (!value) {
      skipped += 1;
      continue;
    }

    if (typeof value !== 'string') {
      skipped += 1;
      continue;
    }

    const raw = value.trim();
    if (!raw) {
      skipped += 1;
      continue;
    }

    if (isObjectIdString(raw)) {
      skipped += 1;
      continue;
    }

    const departmentId = await resolveDepartmentIdByName(raw, departmentCache);
    if (!departmentId) {
      skipped += 1;
      continue;
    }

    await studentsCollection.updateOne(
      { _id: doc._id },
      {
        $set: {
          department: mongoose.Types.ObjectId.createFromHexString(departmentId),
          department_name: raw,
          updated_date: new Date().toISOString(),
        },
      }
    );
    converted += 1;
  }

  return { converted, skipped, departmentsCreatedOrLinked: departmentCache.size };
}

async function migrateAttendanceStudentRefs() {
  const attendanceCollection = getCollection('Attendance');
  const cursor = attendanceCollection.find({});
  const studentLookup = new Map();

  let studentRefBackfilled = 0;
  let statusNormalized = 0;
  let noteNormalized = 0;
  let skipped = 0;

  for await (const doc of cursor) {
    const updates = {};

    const hasStudentRef = doc.student && typeof doc.student !== 'string';
    if (!hasStudentRef && doc.student_id) {
      const studentCode = String(doc.student_id).trim();
      if (studentCode) {
        let studentId = studentLookup.get(studentCode);
        if (!studentId) {
          const student = await Student.findOne({ student_id: studentCode }).select('_id').lean();
          studentId = student?._id ? student._id.toString() : null;
          studentLookup.set(studentCode, studentId);
        }
        if (studentId) {
          updates.student = mongoose.Types.ObjectId.createFromHexString(studentId);
          studentRefBackfilled += 1;
        }
      }
    }

    const normalizedStatus = normalizeStatus(doc.status);
    if (normalizedStatus && normalizedStatus !== doc.status) {
      updates.status = normalizedStatus;
      statusNormalized += 1;
    }

    if ((doc.note === undefined || doc.note === null || doc.note === '') && doc.notes) {
      updates.note = String(doc.notes).trim();
      noteNormalized += 1;
    }

    if (Object.keys(updates).length === 0) {
      skipped += 1;
      continue;
    }

    updates.updated_date = new Date().toISOString();
    await attendanceCollection.updateOne({ _id: doc._id }, { $set: updates });
  }

  return { studentRefBackfilled, statusNormalized, noteNormalized, skipped };
}

async function runMigration() {
  await connectToDatabase();

  const studentResult = await migrateStudentDepartments();
  const attendanceResult = await migrateAttendanceStudentRefs();

  console.log('Migration complete');
  console.log('Student migration:', studentResult);
  console.log('Attendance migration:', attendanceResult);

  await mongoose.disconnect();
}

runMigration().catch(async (error) => {
  console.error('Migration failed:', error.message);
  await mongoose.disconnect();
  process.exit(1);
});