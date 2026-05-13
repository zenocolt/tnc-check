import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { getDepartmentNames } from '@/lib/departments';
import { useUserPermissions } from '@/lib/access-control';

const STATUS_OPTIONS = [
  { value: 'มา', label: 'มา', color: 'bg-green-500 text-white hover:bg-green-600' },
  { value: 'ขาด', label: 'ขาด', color: 'bg-red-500 text-white hover:bg-red-600' },
  { value: 'ลา', label: 'ลา', color: 'bg-yellow-400 text-yellow-900 hover:bg-yellow-500' },
  { value: 'สาย', label: 'สาย', color: 'bg-orange-500 text-white hover:bg-orange-600' },
];

const INACTIVE_STYLE = {
  'มา': 'border-green-300 text-green-700 hover:bg-green-50',
  'ขาด': 'border-red-300 text-red-700 hover:bg-red-50',
  'ลา': 'border-yellow-300 text-yellow-700 hover:bg-yellow-50',
  'สาย': 'border-orange-300 text-orange-700 hover:bg-orange-50',
};

export default function AttendanceCheck() {
  const { user } = useOutletContext();
  const permissions = useUserPermissions(user);
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [attendanceData, setAttendanceData] = useState({});
  const [saving, setSaving] = useState(false);
  const savingRef = React.useRef(false);

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => base44.entities.Student.list('-created_date', 10000),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list('-created_date', 100),
  });

  const { data: existingAttendance = [] } = useQuery({
    queryKey: ['attendance-date', selectedDate],
    queryFn: () => base44.entities.Attendance.filter({ date: selectedDate }, '-created_date', 10000),
  });

  const isAdmin = user?.role === 'admin';

  // Filter students
  const filteredStudents = useMemo(() => {
    let list = students;
    if (!isAdmin) {
      list = list.filter(s => s.advisor_email === user?.email);
    }
    if (selectedLevel !== 'all') list = list.filter(s => s.level === selectedLevel);
    if (selectedDept !== 'all') list = list.filter(s => s.department === selectedDept);
    if (selectedYear !== 'all') list = list.filter(s => s.year === selectedYear);
    if (selectedGroup !== 'all') list = list.filter(s => s.group === selectedGroup);
    return list.sort((a, b) => (a.student_id || '').localeCompare(b.student_id || ''));
  }, [students, isAdmin, user, selectedLevel, selectedDept, selectedYear, selectedGroup]);

  // Initialize attendance data from existing records
  React.useEffect(() => {
    const data = {};
    existingAttendance.forEach(a => {
      data[a.student_id] = { status: a.status, note: a.note || '', id: a.id };
    });
    setAttendanceData(data);
  }, [existingAttendance]);

  const deptNames = getDepartmentNames({ departmentEntities: departments, students });
  const groups = [...new Set(filteredStudents.map(s => s.group))].filter(Boolean).sort();

  const setStatus = (studentId, status) => {
    setAttendanceData(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], status }
    }));
  };

  const setNote = (studentId, note) => {
    setAttendanceData(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], note }
    }));
  };

  const markAll = (status) => {
    const newData = { ...attendanceData };
    filteredStudents.forEach(s => {
      newData[s.student_id] = { ...newData[s.student_id], status };
    });
    setAttendanceData(newData);
  };

  const handleSave = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const records = filteredStudents
      .filter(s => attendanceData[s.student_id]?.status)
      .map(s => ({
        date: selectedDate,
        student_id: s.student_id,
        student_name: `${s.first_name} ${s.last_name}`,
        status: attendanceData[s.student_id].status,
        department: s.department,
        level: s.level,
        year: s.year,
        group: s.group || '',
        note: attendanceData[s.student_id]?.note || '',
        recorded_by: user?.email || '',
      }));

    // Delete existing records for these students on this date, then create new
    for (const record of records) {
      const existing = existingAttendance.find(a => a.student_id === record.student_id);
      if (existing) {
        await base44.entities.Attendance.update(existing.id, record);
      } else {
        await base44.entities.Attendance.create(record);
      }
    }

    queryClient.invalidateQueries({ queryKey: ['attendance-date', selectedDate] });
    queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
    toast({ title: 'บันทึกสำเร็จ', description: `บันทึกข้อมูลการเข้าแถว ${records.length} คน` });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const checkedCount = filteredStudents.filter(s => attendanceData[s.student_id]?.status).length;

  if (!permissions.canTakeAttendance) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          คุณไม่มีสิทธิ์บันทึกการเช็คชื่อ
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">บันทึกการเข้าแถว</h1>
        <p className="text-muted-foreground">เช็คชื่อเข้าแถวหน้าเสาธง</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">วันที่</label>
              <Input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">ระดับชั้น</label>
              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="ปวช.">ปวช.</SelectItem>
                  <SelectItem value="ปวส.">ปวส.</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">แผนกวิชา</label>
              <Select value={selectedDept} onValueChange={setSelectedDept}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {deptNames.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">ชั้นปี</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="1">ปี 1</SelectItem>
                  <SelectItem value="2">ปี 2</SelectItem>
                  <SelectItem value="3">ปี 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">กลุ่มเรียน</label>
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {groups.map(g => <SelectItem key={g} value={g}>กลุ่ม {g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      {filteredStudents.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">เช็คทั้งหมด:</span>
          {STATUS_OPTIONS.map(opt => (
            <Button
              key={opt.value}
              size="sm"
              variant="outline"
              className={INACTIVE_STYLE[opt.value]}
              onClick={() => markAll(opt.value)}
            >
              {opt.label}ทั้งหมด
            </Button>
          ))}
          <span className="ml-auto text-sm text-muted-foreground">
            {checkedCount}/{filteredStudents.length} คน
          </span>
        </div>
      )}

      {/* Student List */}
      {filteredStudents.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            {students.length === 0 ? 'ยังไม่มีข้อมูลนักศึกษา กรุณาเพิ่มข้อมูลก่อน' : 'ไม่พบนักศึกษาตามเงื่อนไขที่เลือก'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredStudents.map((student, idx) => {
            const data = attendanceData[student.student_id] || {};
            return (
              <Card key={student.id} className="overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-xs text-muted-foreground w-6 text-right flex-shrink-0">{idx + 1}</span>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {student.title || ''}{student.first_name} {student.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">{student.student_id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {STATUS_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setStatus(student.student_id, opt.value)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                            data.status === opt.value
                              ? opt.color
                              : `bg-transparent ${INACTIVE_STYLE[opt.value]}`
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <Input
                      placeholder="หมายเหตุ"
                      value={data.note || ''}
                      onChange={e => setNote(student.student_id, e.target.value)}
                      className="w-full sm:w-32 h-8 text-xs"
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Save Button */}
      {filteredStudents.length > 0 && (
        <div className="sticky bottom-4 flex justify-center">
          <Button 
            size="lg" 
            onClick={handleSave}
            disabled={saving || checkedCount === 0}
            className="shadow-xl px-8 bg-primary"
          >
            {saving ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> กำลังบันทึก...</>
            ) : (
              <><Save className="w-5 h-5 mr-2" /> บันทึกข้อมูล ({checkedCount} คน)</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}