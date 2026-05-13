import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Users, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { getDepartmentNames } from '@/lib/departments';
import { useUserPermissions } from '@/lib/access-control';

function parseBulkRows(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const commaParts = line.split(',').map((p) => p.trim()).filter(Boolean);
      if (commaParts.length >= 3) {
        const [student_id, first_name, last_name] = commaParts;
        return { student_id, first_name, last_name };
      }

      const parts = line.split(/\s+/).filter(Boolean);
      if (parts.length >= 3) {
        const [student_id, first_name, ...last] = parts;
        return { student_id, first_name, last_name: last.join(' ') };
      }

      return null;
    })
    .filter(Boolean);
}

export default function StudentByRoom() {
  const { user } = useOutletContext();
  const permissions = useUserPermissions(user);
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';

  const [level, setLevel] = useState('ปวช.');
  const [year, setYear] = useState('1');
  const [group, setGroup] = useState('1');
  const [department, setDepartment] = useState('');
  const [advisorName, setAdvisorName] = useState('');

  const [single, setSingle] = useState({ student_id: '', title: 'นาย', first_name: '', last_name: '' });
  const [bulkText, setBulkText] = useState('');
  const [savingSingle, setSavingSingle] = useState(false);
  const [savingBulk, setSavingBulk] = useState(false);
  const [deletingRoom, setDeletingRoom] = useState(false);

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => base44.entities.Student.list('-created_date', 10000),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list('-created_date', 100),
  });

  const deptNames = getDepartmentNames({ departmentEntities: departments, students });

  const roomStudents = useMemo(() => {
    return students
      .filter((s) => (department ? s.department === department : true))
      .filter((s) => s.level === level)
      .filter((s) => s.year === year)
      .filter((s) => (s.group || '') === group)
      .sort((a, b) => (a.student_id || '').localeCompare(b.student_id || ''));
  }, [students, department, level, year, group]);

  const assignedAdvisor = isAdmin ? advisorName.trim() : (user?.email || '');

  const buildBasePayload = () => ({
    level,
    year,
    group,
    department,
    advisor_email: assignedAdvisor,
  });

  const hasRoomMeta = Boolean(level && year && group && department);

  const handleAddSingle = async () => {
    if (!hasRoomMeta) {
      toast({ title: 'กรุณาเลือกข้อมูลห้องให้ครบ', variant: 'destructive' });
      return;
    }

    if (!single.student_id || !single.first_name || !single.last_name) {
      toast({ title: 'กรอกข้อมูลนักศึกษาให้ครบ', variant: 'destructive' });
      return;
    }

    const duplicate = students.some((s) => s.student_id === single.student_id);
    if (duplicate) {
      toast({ title: 'รหัสนักศึกษาซ้ำ', description: 'มีรหัสนี้ในระบบแล้ว', variant: 'destructive' });
      return;
    }

    setSavingSingle(true);
    try {
      await base44.entities.Student.create({
        ...buildBasePayload(),
        ...single,
      });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setSingle({ student_id: '', title: 'นาย', first_name: '', last_name: '' });
      toast({ title: 'เพิ่มนักศึกษาสำเร็จ' });
    } finally {
      setSavingSingle(false);
    }
  };

  const handleAddBulk = async () => {
    if (!hasRoomMeta) {
      toast({ title: 'กรุณาเลือกข้อมูลห้องให้ครบ', variant: 'destructive' });
      return;
    }

    const parsed = parseBulkRows(bulkText);
    if (parsed.length === 0) {
      toast({ title: 'ไม่พบข้อมูลที่นำเข้าได้', description: 'รูปแบบ: รหัส,ชื่อ,นามสกุล', variant: 'destructive' });
      return;
    }

    const existingIds = new Set(students.map((s) => s.student_id));
    const uniqueRows = parsed.filter((r) => !existingIds.has(r.student_id));

    if (uniqueRows.length === 0) {
      toast({ title: 'รายการซ้ำทั้งหมด', description: 'ไม่มีรายการใหม่ที่เพิ่มได้', variant: 'destructive' });
      return;
    }

    setSavingBulk(true);
    try {
      await Promise.all(
        uniqueRows.map((row) =>
          base44.entities.Student.create({
            ...buildBasePayload(),
            title: 'นาย',
            ...row,
          })
        )
      );
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setBulkText('');
      toast({ title: 'เพิ่มรายชื่อสำเร็จ', description: `เพิ่ม ${uniqueRows.length} คน` });
    } finally {
      setSavingBulk(false);
    }
  };

  const handleDeleteRoomStudents = async () => {
    if (!hasRoomMeta) {
      toast({ title: 'กรุณาเลือกข้อมูลห้องให้ครบ', variant: 'destructive' });
      return;
    }

    if (roomStudents.length === 0) {
      toast({ title: 'ไม่มีรายชื่อในห้องนี้ให้ลบ' });
      return;
    }

    const roomLabel = `${level} ปี ${year} กลุ่ม ${group}${department ? ` (${department})` : ''}`;
    const confirmed = confirm(`ยืนยันลบรายชื่อนักเรียนห้อง ${roomLabel} ทั้งหมด ${roomStudents.length} คน?`);
    if (!confirmed) return;

    setDeletingRoom(true);
    try {
      await Promise.all(roomStudents.map((student) => base44.entities.Student.delete(student.id)));
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['all-attendance'] });
      toast({ title: 'ลบรายชื่อสำเร็จ', description: `ลบ ${roomStudents.length} คนจากห้องนี้แล้ว` });
    } finally {
      setDeletingRoom(false);
    }
  };

  if (!permissions.canEditData) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          คุณไม่มีสิทธิ์ใช้งานระบบนักเรียน
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">ระบบนักเรียน</h1>
        <p className="text-muted-foreground">เพิ่มรายชื่อนักเรียนแยกตามห้องเรียน</p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <Label>ระดับชั้น</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ปวช.">ปวช.</SelectItem>
                  <SelectItem value="ปวส.">ปวส.</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ชั้นปี</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ห้อง/กลุ่ม</Label>
              <Input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="เช่น 1" />
            </div>
            <div className="md:col-span-2">
              <Label>แผนกวิชา</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger><SelectValue placeholder="เลือกแผนก" /></SelectTrigger>
                <SelectContent>
                  {deptNames.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isAdmin && (
            <div>
              <Label>ชื่อครูที่ปรึกษา</Label>
              <Input
                value={advisorName}
                onChange={(e) => setAdvisorName(e.target.value)}
                placeholder="เช่น นายสมชาย ใจดี"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 font-semibold">
              <Plus className="w-4 h-4" />
              เพิ่มทีละคน
            </div>

            <div>
              <Label>รหัสนักศึกษา</Label>
              <Input
                value={single.student_id}
                onChange={(e) => setSingle((prev) => ({ ...prev, student_id: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>คำนำหน้า</Label>
                <Select value={single.title} onValueChange={(v) => setSingle((prev) => ({ ...prev, title: v }))}>
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
                <Input
                  value={single.first_name}
                  onChange={(e) => setSingle((prev) => ({ ...prev, first_name: e.target.value }))}
                />
              </div>
              <div>
                <Label>นามสกุล</Label>
                <Input
                  value={single.last_name}
                  onChange={(e) => setSingle((prev) => ({ ...prev, last_name: e.target.value }))}
                />
              </div>
            </div>

            <Button onClick={handleAddSingle} disabled={savingSingle} className="w-full gap-2">
              <Save className="w-4 h-4" />
              {savingSingle ? 'กำลังบันทึก...' : 'บันทึกนักศึกษา'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 font-semibold">
              <Users className="w-4 h-4" />
              เพิ่มหลายคนในครั้งเดียว
            </div>
            <p className="text-sm text-muted-foreground">
              ใส่ทีละบรรทัด: รหัส,ชื่อ,นามสกุล หรือ รหัส ชื่อ นามสกุล
            </p>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              className="w-full min-h-40 rounded-md border bg-background p-3 text-sm"
              placeholder={'66001,สมชาย,ใจดี\n66002,สมหญิง,ใจงาม'}
            />
            <Button onClick={handleAddBulk} disabled={savingBulk} className="w-full">
              {savingBulk ? 'กำลังเพิ่มรายชื่อ...' : 'เพิ่มรายชื่อเข้าห้องนี้'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              รายชื่อนักเรียนในห้อง: {level} ปี {year} กลุ่ม {group} {department ? `(${department})` : ''} | ทั้งหมด {roomStudents.length} คน
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="gap-2"
              onClick={handleDeleteRoomStudents}
              disabled={deletingRoom || roomStudents.length === 0}
            >
              <Trash2 className="w-4 h-4" />
              {deletingRoom ? 'กำลังลบ...' : 'ลบรายชื่อเด็กห้องนี้'}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>รหัส</TableHead>
                  <TableHead>ชื่อ-นามสกุล</TableHead>
                  <TableHead>ครูที่ปรึกษา</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roomStudents.map((s, idx) => (
                  <TableRow key={s.id}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell className="font-mono text-xs">{s.student_id}</TableCell>
                    <TableCell>{s.title || ''}{s.first_name} {s.last_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.advisor_email || '-'}</TableCell>
                  </TableRow>
                ))}
                {roomStudents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      ยังไม่มีรายชื่อนักเรียนในห้องนี้
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
