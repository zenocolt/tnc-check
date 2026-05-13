export const DEFAULT_DEPARTMENTS = [
  'ช่างยนต์',
  'ยานยนต์ไฟฟ้า',
  'ช่างก่อสร้าง',
  'ช่างกลโรงงาน',
  'ช่างเชื่อมโลหะ',
  'ช่างไฟฟ้ากำลัง',
  'ช่างอิเล็กทรอนิกส์',
  'ช่างเมคคาทรอนิกส์',
  'เทคนิคคอมพิวเตอร์',
  'เทคโนโลยีธุรกิจดิจิทัล',
  'เทคโนโลยีสารสนเทศ',
  'การบัญชี',
  'การตลาด',
  'การเลขานุการ',
  'เครื่องประดับอัญมณี',
  'การจัดการโลจิสติกส์',
];

export function getDepartmentNames({ departmentEntities = [], students = [] } = {}) {
  const fromEntities = departmentEntities.map((d) => (d?.name || '').trim()).filter(Boolean);
  const fromStudents = students.map((s) => (s?.department || '').trim()).filter(Boolean);

  return [...new Set([...fromEntities, ...fromStudents, ...DEFAULT_DEPARTMENTS])];
}
