import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import * as XLSX from 'xlsx';
import { Plus, Upload, Trash2, Search, Download, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { getDepartmentNames } from '@/lib/departments';
import { useUserPermissions } from '@/lib/access-control';

const HEADER_MAP = {
  'รหัสนักศึกษา': 'student_id',
  'student_id': 'student_id',
  'คำนำหน้า': 'title',
  'title': 'title',
  'ชื่อ': 'first_name',
  'first_name': 'first_name',
  'นามสกุล': 'last_name',
  'last_name': 'last_name',
  'ระดับชั้น': 'level',
  'level': 'level',
  'ชั้นปี': 'year',
  'year': 'year',
  'กลุ่ม': 'group',
  'group': 'group',
  'แผนกวิชา': 'department',
  'department': 'department',
  'ชื่อครูที่ปรึกษา': 'advisor_email',
  'อีเมลครูที่ปรึกษา': 'advisor_email',
  'advisor_email': 'advisor_email',
};

const REQUIRED_FIELDS = ['student_id', 'first_name', 'last_name', 'department'];

const normalizeHeader = (value) => String(value ?? '').trim().toLowerCase();

const parseCsvLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
};

const parseStudentsFromCsv = (text) => {
  const normalized = text.replace(/^\uFEFF/, '');
  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('ไฟล์ CSV ไม่มีข้อมูลสำหรับนำเข้า');
  }

  const rawHeaders = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => parseCsvLine(line));
  return mapRowsToStudents(rawHeaders, rows);
};

const mapRowsToStudents = (rawHeaders, rows) => {
  const mappedHeaders = rawHeaders.map((h) => HEADER_MAP[normalizeHeader(h)] || null);

  const unknownHeaders = rawHeaders.filter((_, idx) => !mappedHeaders[idx]);
  if (unknownHeaders.length > 0) {
    throw new Error(`คอลัมน์ไม่รองรับ: ${unknownHeaders.join(', ')}`);
  }

  const missingRequired = REQUIRED_FIELDS.filter((field) => !mappedHeaders.includes(field));
  if (missingRequired.length > 0) {
    throw new Error(`คอลัมน์จำเป็นไม่ครบ: ${missingRequired.join(', ')}`);
  }

  return rows
    .filter((cells) => cells.some((cell) => String(cell ?? '').trim() !== ''))
    .map((cells, rowIndex) => {
      const item = {
        student_id: '',
        title: '',
        first_name: '',
        last_name: '',
        level: 'ปวช.',
        year: '1',
        group: '',
        department: '',
        advisor_email: '',
      };

      mappedHeaders.forEach((key, idx) => {
        if (!key) return;
        item[key] = String(cells[idx] ?? '').trim();
      });

      for (const field of REQUIRED_FIELDS) {
        if (!item[field]) {
          throw new Error(`ข้อมูลไม่ครบที่บรรทัด ${rowIndex + 2} (ต้องมี ${field})`);
        }
      }

      return item;
    });
};

const parseStudentsFromXlsx = async (file) => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error('ไม่พบชีตในไฟล์ Excel');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });

  if (!rows.length || rows.length < 2) {
    throw new Error('ไฟล์ Excel ไม่มีข้อมูลสำหรับนำเข้า');
  }

  const rawHeaders = rows[0].map((cell) => String(cell ?? '').trim());
  const dataRows = rows.slice(1).map((row) => row.map((cell) => String(cell ?? '').trim()));
  return mapRowsToStudents(rawHeaders, dataRows);
};

export default function Students() {
  const { user } = useOutletContext();
  const permissions = useUserPermissions(user);
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('all');
  const [importing, setImporting] = useState(false);

  const [form, setForm] = useState({
    student_id: '', title: 'นาย', first_name: '', last_name: '',
    level: 'ปวช.', year: '1', group: '', department: '', advisor_email: ''
  });

  const [editForm, setEditForm] = useState({
    student_id: '', title: 'นาย', first_name: '', last_name: '',
    level: 'ปวช.', year: '1', group: '', department: '', advisor_email: ''
  });

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students'],
    queryFn: () => base44.entities.Student.list('-created_date', 10000),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list('-created_date', 100),
  });

  const deptNames = getDepartmentNames({ departmentEntities: departments, students });

  if (!permissions.canEditData) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          คุณไม่มีสิทธิ์แก้ไขข้อมูลนักศึกษา
        </CardContent>
      </Card>
    );
  }

  const filtered = students
    .filter(s => {
      const matchSearch = !search || 
        s.student_id?.includes(search) || 
        `${s.first_name} ${s.last_name}`.includes(search);
      const matchDept = filterDept === 'all' || s.department === filterDept;
      return matchSearch && matchDept;
    })
    .sort((a, b) => (a.student_id || '').localeCompare(b.student_id || ''));

  const handleAdd = async () => {
    await base44.entities.Student.create(form);
    queryClient.invalidateQueries({ queryKey: ['students'] });
    queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
    queryClient.invalidateQueries({ queryKey: ['all-attendance'] });
    setShowAdd(false);
    setForm({ student_id: '', title: 'นาย', first_name: '', last_name: '', level: 'ปวช.', year: '1', group: '', department: '', advisor_email: '' });
    toast({ title: 'เพิ่มนักศึกษาสำเร็จ' });
  };

  const handleEdit = (student) => {
    setEditingStudent(student);
    setEditForm({
      student_id: student.student_id || '',
      title: student.title || 'นาย',
      first_name: student.first_name || '',
      last_name: student.last_name || '',
      level: student.level || 'ปวช.',
      year: student.year || '1',
      group: student.group || '',
      department: student.department || '',
      advisor_email: student.advisor_email || ''
    });
    setShowEdit(true);
  };

  const handleUpdate = async () => {
    await base44.entities.Student.update(editingStudent.id, editForm);
    queryClient.invalidateQueries({ queryKey: ['students'] });
    queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
    queryClient.invalidateQueries({ queryKey: ['all-attendance'] });
    setShowEdit(false);
    setEditingStudent(null);
    setEditForm({
      student_id: '', title: 'นาย', first_name: '', last_name: '',
      level: 'ปวช.', year: '1', group: '', department: '', advisor_email: ''
    });
    toast({ title: 'แก้ไขข้อมูลสำเร็จ' });
  };

  const handleDelete = async (id) => {
    if (confirm('ยืนยันการลบข้อมูลนักศึกษา?')) {
      await base44.entities.Student.delete(id);
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['all-attendance'] });
      toast({ title: 'ลบข้อมูลสำเร็จ' });
    }
  };

  const importStudentsWithDedup = async (items) => {
    const existingIds = new Set(students.map((s) => String(s.student_id || '').trim()));
    const seenInFile = new Set();
    const duplicates = [];

    const uniqueItems = items.filter((item) => {
      const id = String(item.student_id || '').trim();
      if (!id) return false;

      if (existingIds.has(id) || seenInFile.has(id)) {
        duplicates.push(id);
        return false;
      }

      seenInFile.add(id);
      return true;
    });

    if (uniqueItems.length === 0) {
      const duplicatePreview = [...new Set(duplicates)].slice(0, 5).join(', ');
      throw new Error(`ไม่ได้นำเข้าข้อมูล: รหัสนักศึกษาซ้ำทั้งหมด${duplicatePreview ? ` (${duplicatePreview})` : ''}`);
    }

    await base44.entities.Student.bulkCreate(uniqueItems);
    queryClient.invalidateQueries({ queryKey: ['students'] });
    queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
    queryClient.invalidateQueries({ queryKey: ['all-attendance'] });

    if (duplicates.length > 0) {
      toast({
        title: 'นำเข้าสำเร็จบางส่วน',
        description: `เพิ่ม ${uniqueItems.length} คน, ข้ามรายการซ้ำ ${duplicates.length} คน`,
      });
    } else {
      toast({ title: 'นำเข้าสำเร็จ', description: `เพิ่มนักศึกษา ${uniqueItems.length} คน` });
    }
  };

  const handleFileImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);

    try {
      const extension = String(file.name.split('.').pop() || '').toLowerCase();

      // Fast path: parse CSV locally to avoid slow external extraction.
      if (extension === 'csv') {
        const csvText = await file.text();
        const studentsFromCsv = parseStudentsFromCsv(csvText);

        if (studentsFromCsv.length === 0) {
          throw new Error('ไม่พบข้อมูลนักศึกษาในไฟล์ CSV');
        }

        await importStudentsWithDedup(studentsFromCsv);
        setShowImport(false);
        return;
      }

      if (extension === 'xlsx' || extension === 'xls') {
        const studentsFromXlsx = await parseStudentsFromXlsx(file);

        if (studentsFromXlsx.length === 0) {
          throw new Error('ไม่พบข้อมูลนักศึกษาในไฟล์ Excel');
        }

        await importStudentsWithDedup(studentsFromXlsx);
        setShowImport(false);
        return;
      }

      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            students: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  student_id: { type: "string", description: "รหัสนักศึกษา" },
                  title: { type: "string", description: "คำนำหน้า เช่น นาย นางสาว" },
                  first_name: { type: "string", description: "ชื่อ" },
                  last_name: { type: "string", description: "นามสกุล" },
                  level: { type: "string", description: "ระดับชั้น ปวช. หรือ ปวส." },
                  year: { type: "string", description: "ชั้นปี" },
                  group: { type: "string", description: "กลุ่มเรียน" },
                  department: { type: "string", description: "แผนกวิชา" },
                  advisor_email: { type: "string", description: "ชื่อครูที่ปรึกษา" }
                }
              }
            }
          }
        }
      });

      if (result.status === 'success' && result.output?.students?.length > 0) {
        await importStudentsWithDedup(result.output.students);
        setShowImport(false);
      } else {
        throw new Error('ไม่สามารถอ่านข้อมูลจากไฟล์ได้');
      }
    } catch (error) {
      toast({
        title: 'นำเข้าข้อมูลไม่สำเร็จ',
        description: error?.message || 'กรุณาตรวจสอบรูปแบบไฟล์และลองใหม่',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleDownloadTemplate = () => {
    const rows = [
      ['รหัสนักศึกษา', 'คำนำหน้า', 'ชื่อ', 'นามสกุล', 'ระดับชั้น', 'ชั้นปี', 'กลุ่ม', 'แผนกวิชา', 'ชื่อครูที่ปรึกษา'],
      ['6601001', 'นาย', 'สมชาย', 'ใจดี', 'ปวช.', '1', '1', 'เทคโนโลยีสารสนเทศ', 'นายวิวัฒน์ ใจดี'],
    ];

    const escapeCsv = (value) => {
      const text = String(value ?? '');
      if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    const csvContent = `\uFEFF${rows.map((row) => row.map(escapeCsv).join(',')).join('\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student-import-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">จัดการนักศึกษา</h1>
          <p className="text-muted-foreground">ทั้งหมด {students.length} คน</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setShowImport(true)}>
            <Upload className="w-4 h-4" /> นำเข้า Excel
          </Button>
          <Button className="gap-2" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4" /> เพิ่มนักศึกษา
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="ค้นหารหัสหรือชื่อ..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterDept} onValueChange={setFilterDept}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกแผนก</SelectItem>
            {deptNames.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>รหัส</TableHead>
                  <TableHead>ชื่อ-นามสกุล</TableHead>
                  <TableHead className="hidden md:table-cell">ระดับ</TableHead>
                  <TableHead className="hidden md:table-cell">ปี/กลุ่ม</TableHead>
                  <TableHead>แผนก</TableHead>
                  <TableHead className="hidden lg:table-cell">ครูที่ปรึกษา</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s, idx) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-mono text-xs">{s.student_id}</TableCell>
                    <TableCell className="font-medium">{s.title || ''}{s.first_name} {s.last_name}</TableCell>
                    <TableCell className="hidden md:table-cell">{s.level}</TableCell>
                    <TableCell className="hidden md:table-cell">{s.year}/{s.group || '-'}</TableCell>
                    <TableCell className="text-sm">{s.department}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{s.advisor_email || '-'}</TableCell>
                    <TableCell className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(s)}>
                        <Edit className="w-4 h-4 text-blue-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">ไม่พบข้อมูล</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>เพิ่มนักศึกษา</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>รหัสนักศึกษา</Label>
              <Input value={form.student_id} onChange={e => setForm({...form, student_id: e.target.value})} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>คำนำหน้า</Label>
                <Select value={form.title} onValueChange={v => setForm({...form, title: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="นาย">นาย</SelectItem>
                    <SelectItem value="นางสาว">นางสาว</SelectItem>
                    <SelectItem value="นาง">นาง</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>ชื่อ</Label>
                <Input value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} />
              </div>
              <div>
                <Label>นามสกุล</Label>
                <Input value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>ระดับชั้น</Label>
                <Select value={form.level} onValueChange={v => setForm({...form, level: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ปวช.">ปวช.</SelectItem>
                    <SelectItem value="ปวส.">ปวส.</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>ชั้นปี</Label>
                <Select value={form.year} onValueChange={v => setForm({...form, year: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>กลุ่ม</Label>
                <Input value={form.group} onChange={e => setForm({...form, group: e.target.value})} />
              </div>
            </div>
            <div>
              <Label>แผนกวิชา</Label>
              <Select value={form.department} onValueChange={v => setForm({...form, department: v})}>
                <SelectTrigger><SelectValue placeholder="เลือกแผนก" /></SelectTrigger>
                <SelectContent>
                  {deptNames.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ชื่อครูที่ปรึกษา</Label>
              <Input value={form.advisor_email} onChange={e => setForm({...form, advisor_email: e.target.value})} placeholder="เช่น นายสมชาย ใจดี" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>ยกเลิก</Button>
            <Button onClick={handleAdd}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>แก้ไขข้อมูลนักศึกษา</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>รหัสนักศึกษา</Label>
              <Input value={editForm.student_id} onChange={e => setEditForm({...editForm, student_id: e.target.value})} disabled />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>คำนำหน้า</Label>
                <Select value={editForm.title} onValueChange={v => setEditForm({...editForm, title: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="นาย">นาย</SelectItem>
                    <SelectItem value="นางสาว">นางสาว</SelectItem>
                    <SelectItem value="นาง">นาง</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>ชื่อ</Label>
                <Input value={editForm.first_name} onChange={e => setEditForm({...editForm, first_name: e.target.value})} />
              </div>
              <div>
                <Label>นามสกุล</Label>
                <Input value={editForm.last_name} onChange={e => setEditForm({...editForm, last_name: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>ระดับชั้น</Label>
                <Select value={editForm.level} onValueChange={v => setEditForm({...editForm, level: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ปวช.">ปวช.</SelectItem>
                    <SelectItem value="ปวส.">ปวส.</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>ชั้นปี</Label>
                <Select value={editForm.year} onValueChange={v => setEditForm({...editForm, year: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>กลุ่ม</Label>
                <Input value={editForm.group} onChange={e => setEditForm({...editForm, group: e.target.value})} />
              </div>
            </div>
            <div>
              <Label>แผนกวิชา</Label>
              <Select value={editForm.department} onValueChange={v => setEditForm({...editForm, department: v})}>
                <SelectTrigger><SelectValue placeholder="เลือกแผนก" /></SelectTrigger>
                <SelectContent>
                  {deptNames.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ชื่อครูที่ปรึกษา</Label>
              <Input value={editForm.advisor_email} onChange={e => setEditForm({...editForm, advisor_email: e.target.value})} placeholder="เช่น นายสมชาย ใจดี" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>ยกเลิก</Button>
            <Button onClick={handleUpdate}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>นำเข้าข้อมูลจาก Excel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              อัปโหลดไฟล์ Excel (.xlsx) ที่มีคอลัมน์: รหัสนักศึกษา, คำนำหน้า, ชื่อ, นามสกุล, ระดับชั้น, ชั้นปี, กลุ่ม, แผนกวิชา, อีเมลครูที่ปรึกษา
            </p>
            <Button type="button" variant="outline" className="w-full gap-2" onClick={handleDownloadTemplate}>
              <Download className="w-4 h-4" /> ดาวน์โหลดไฟล์ตัวอย่าง (CSV)
            </Button>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileImport}
              disabled={importing}
            />
            {importing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                กำลังนำเข้าข้อมูล...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}