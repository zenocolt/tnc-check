// Utility to seed sample data for demonstration
// Can be called from browser console or integrated into admin panel

import { base44 } from '@/api/base44Client';

const IT_DEPARTMENT = 'เทคโนโลยีสารสนเทศ';
const ROOM = 'ห้อง 4/1 (IT)';

const SAMPLE_STUDENTS = [
  { firstName: 'สมชาย', lastName: 'ใจดี' },
  { firstName: 'นพดล', lastName: 'สุขสวัสดิ์' },
  { firstName: 'ธัญญา', lastName: 'เรืองศรี' },
  { firstName: 'ปรชญา', lastName: 'สมบูรณ์' },
  { firstName: 'วิชัย', lastName: 'มั่นคง' },
  { firstName: 'สุรชัย', lastName: 'ศรีสวัสดิ์' },
  { firstName: 'ธีรชัย', lastName: 'รักษ์ชัย' },
  { firstName: 'สมศรี', lastName: 'พงศ์พิทยา' },
  { firstName: 'อนุ', lastName: 'ทองหลาง' },
  { firstName: 'วรวุฒิ', lastName: 'ชาติสุวรรณ' },
];

/**
 * Seed 10 students and 5 days of attendance for IT department
 * @returns {Promise<void>}
 */
export async function seedSampleData() {
  try {
    console.log('🌱 Starting seed data creation...\n');

    // 1. Create students
    console.log(`📚 Creating 10 students for ${IT_DEPARTMENT}...`);
    const studentIds = [];

    for (let i = 0; i < SAMPLE_STUDENTS.length; i++) {
      const { firstName, lastName } = SAMPLE_STUDENTS[i];
      const student = await base44.entities.Student.create({
        first_name: firstName,
        last_name: lastName,
        code: `IT${String(i + 1).padStart(3, '0')}`,
        department: IT_DEPARTMENT,
        room: ROOM,
        advisor_email: 'teacher@school.ac.th',
      });
      studentIds.push(student.id);
      console.log(`  ✓ ${firstName} ${lastName} (${student.id})`);
    }

    // 2. Create attendance records for 5 days
    console.log(`\n📅 Creating 5 days of attendance records...`);

    const today = new Date();
    const dates = [];
    for (let day = 0; day < 5; day++) {
      const date = new Date(today);
      date.setDate(date.getDate() - (4 - day)); // Last 5 days
      dates.push(date);
    }

    for (const date of dates) {
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      console.log(`\n  📍 ${dateStr} - Creating attendance records:`);

      for (let i = 0; i < studentIds.length; i++) {
        const studentId = studentIds[i];
        const { firstName, lastName } = SAMPLE_STUDENTS[i];

        // Simulate some students absent (15% absence rate)
        const isPresent = Math.random() > 0.15;

        const attendance = await base44.entities.Attendance.create({
          student_id: studentId,
          date: dateStr,
          status: isPresent ? 'present' : 'absent',
          room: ROOM,
          department: IT_DEPARTMENT,
          notes: isPresent ? 'ปกติ' : 'ขาด',
        });

        const statusEmoji = isPresent ? '✓' : '✗';
        const statusText = isPresent ? 'มา' : 'ขาด';
        console.log(`    ${statusEmoji} ${firstName} ${lastName} - ${statusText}`);
      }
    }

    console.log('\n✅ Seed data completed successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   Department: ${IT_DEPARTMENT}`);
    console.log(`   Room: ${ROOM}`);
    console.log(`   Students: 10`);
    console.log(`   Attendance days: 5`);
    console.log(`   Total attendance records: 50`);

  } catch (error) {
    console.error('❌ Error creating seed data:', error.message);
    throw error;
  }
}

/**
 * Display sample data info in the console
 */
export function showSampleDataInfo() {
  console.log('\n📋 Sample Data Information:');
  console.log('─'.repeat(50));
  console.log(`Department: ${IT_DEPARTMENT}`);
  console.log(`Room: ${ROOM}`);
  console.log('\n👥 Students:');
  SAMPLE_STUDENTS.forEach((student, i) => {
    console.log(`   ${i + 1}. ${student.firstName} ${student.lastName} (รหัส: IT${String(i + 1).padStart(3, '0')})`);
  });
  console.log('\n📅 Attendance: 5 days (with ~15% absence rate)');
  console.log('─'.repeat(50));
}
