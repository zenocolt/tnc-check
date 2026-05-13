import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getDepartmentNames } from '@/lib/departments';
import { useUserPermissions } from '@/lib/access-control';

const statusColors = {
  'มา': 'bg-green-100 text-green-700 border-green-200',
  'ขาด': 'bg-red-100 text-red-700 border-red-200',
  'ลา': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'สาย': 'bg-orange-100 text-orange-700 border-orange-200',
};

export default function Reports() {
  const { user } = useOutletContext();
  const permissions = useUserPermissions(user);
  const isAdmin = user?.role === 'admin';
  
  const [dateFrom, setDateFrom] = useState(format(new Date(new Date().setDate(1)), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchDept, setSearchDept] = useState('all');
  const [searchId, setSearchId] = useState('');

  const { data: allAttendance = [], isLoading } = useQuery({
    queryKey: ['all-attendance-reports'],
    queryFn: () => base44.entities.Attendance.list('-date', 10000),
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => base44.entities.Student.list('-created_date', 10000),
  });

  const { data: departmentEntities = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list('-created_date', 100),
  });

  const { data: schoolDays = [] } = useQuery({
    queryKey: ['school-calendar'],
    queryFn: () => base44.entities.SchoolCalendar.list('-date', 10000),
  });

  const departments = getDepartmentNames({ departmentEntities, students });

  // Calculate school days
  const holidays = schoolDays.filter(d => d.type === 'holiday').map(d => d.date);
  const semesterStart = schoolDays.find(d => d.type === 'semester_start');

  const totalSchoolDays = useMemo(() => {
    if (!semesterStart) return 0;
    const start = new Date(semesterStart.date);
    const end = new Date();
    let count = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      const dateStr = format(d, 'yyyy-MM-dd');
      if (day !== 0 && day !== 6 && !holidays.includes(dateStr)) count++;
    }
    return count;
  }, [semesterStart, holidays]);

  const filtered = useMemo(() => {
    let list = allAttendance;
    if (!isAdmin) {
      const myStudentIds = students.filter(s => s.advisor_email === user?.email).map(s => s.student_id);
      list = list.filter(a => myStudentIds.includes(a.student_id));
    }
    list = list.filter(a => a.date >= dateFrom && a.date <= dateTo);
    if (searchDept !== 'all') list = list.filter(a => a.department === searchDept);
    if (searchId) list = list.filter(a => a.student_id?.includes(searchId) || a.student_name?.includes(searchId));
    return list.sort((a, b) => {
      const idCompare = (a.student_id || '').localeCompare(b.student_id || '');
      if (idCompare !== 0) return idCompare;
      return (b.date || '').localeCompare(a.date || '');
    });
  }, [allAttendance, isAdmin, students, user, dateFrom, dateTo, searchDept, searchId]);

  // Summary by student
  // จำนวนวันเข้าแถวจริงในช่วงที่เลือก (unique dates ของ attendance)
  const totalDaysInRange = useMemo(() => {
    const rangeDates = allAttendance.filter(a => a.date >= dateFrom && a.date <= dateTo);
    return new Set(rangeDates.map(a => a.date)).size;
  }, [allAttendance, dateFrom, dateTo]);

  const studentSummary = useMemo(() => {
    const myStudentList = isAdmin ? students : students.filter(s => s.advisor_email === user?.email);
    const filteredByDept = searchDept !== 'all' ? myStudentList.filter(s => s.department === searchDept) : myStudentList;
    const filteredBySearch = searchId ? filteredByDept.filter(s => s.student_id?.includes(searchId) || `${s.first_name} ${s.last_name}`.includes(searchId)) : filteredByDept;
    
    return filteredBySearch.map(s => {
      const records = allAttendance.filter(a => a.student_id === s.student_id && a.date >= dateFrom && a.date <= dateTo);
      const present = records.filter(a => a.status === 'มา' || a.status === 'สาย').length;
      const absent = records.filter(a => a.status === 'ขาด').length;
      const leave = records.filter(a => a.status === 'ลา').length;
      const late = records.filter(a => a.status === 'สาย').length;
      const pct = totalDaysInRange > 0 ? Math.round((present / totalDaysInRange) * 100) : 0;
      return {
        ...s,
        present, absent, leave, late,
        total: records.length,
        percentage: pct,
      };
    }).sort((a, b) => (a.student_id || '').localeCompare(b.student_id || ''));
  }, [students, allAttendance, isAdmin, user, dateFrom, dateTo, searchDept, searchId, totalDaysInRange]);

  const exportToExcel = () => {
    const rows = filtered.map((a) => ({
      วันที่: a.date || '',
      รหัสนักศึกษา: a.student_id || '',
      'ชื่อ-นามสกุล': a.student_name || '',
      แผนก: a.department || '',
      สถานะ: a.status || '',
      หมายเหตุ: a.note || '',
      ผู้บันทึก: a.recorded_by || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'รายงานผล');
    XLSX.writeFile(workbook, `attendance_report_${dateFrom}_to_${dateTo}.xlsx`);
  };

  const [viewMode, setViewMode] = useState('summary');

  if (!permissions.canViewReports) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          คุณไม่มีสิทธิ์ดูรายงาน
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">รายงานผล</h1>
          <p className="text-muted-foreground">ประวัติและสถิติการเข้าแถว</p>
        </div>
        <Button onClick={exportToExcel} variant="outline" className="gap-2">
          <FileSpreadsheet className="w-4 h-4" />
          Export Excel
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">จากวันที่</label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">ถึงวันที่</label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">แผนกวิชา</label>
              <Select value={searchDept} onValueChange={setSearchDept}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">ค้นหา</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="รหัสหรือชื่อ..."
                  value={searchId}
                  onChange={e => setSearchId(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Toggle */}
      <div className="flex gap-2">
        <Button size="sm" variant={viewMode === 'summary' ? 'default' : 'outline'} onClick={() => setViewMode('summary')}>สรุปรายบุคคล</Button>
        <Button size="sm" variant={viewMode === 'detail' ? 'default' : 'outline'} onClick={() => setViewMode('detail')}>รายละเอียดรายวัน</Button>
      </div>

      {/* Summary View */}
      {viewMode === 'summary' && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>รหัส</TableHead>
                    <TableHead>ชื่อ-นามสกุล</TableHead>
                    <TableHead className="hidden md:table-cell">แผนก</TableHead>
                    <TableHead className="text-center">มา</TableHead>
                    <TableHead className="text-center">ขาด</TableHead>
                    <TableHead className="text-center">ลา</TableHead>
                    <TableHead className="text-center">สาย</TableHead>
                    <TableHead className="text-center">%</TableHead>
                    <TableHead className="text-center">สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentSummary.map((s, idx) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{s.student_id}</TableCell>
                      <TableCell className="font-medium">{s.first_name} {s.last_name}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">{s.department}</TableCell>
                      <TableCell className="text-center text-green-600 font-medium">{s.present}</TableCell>
                      <TableCell className="text-center text-red-600 font-medium">{s.absent}</TableCell>
                      <TableCell className="text-center text-yellow-600 font-medium">{s.leave}</TableCell>
                      <TableCell className="text-center text-orange-600 font-medium">{s.late}</TableCell>
                      <TableCell className="text-center font-bold">{s.percentage}%</TableCell>
                      <TableCell className="text-center">
                        {s.percentage < 60 && s.total > 0 ? (
                          <Badge variant="destructive">ไม่ผ่าน</Badge>
                        ) : s.percentage < 70 && s.total > 0 ? (
                          <Badge className="bg-orange-100 text-orange-700 border-orange-200">ใกล้ไม่ผ่าน</Badge>
                        ) : s.total > 0 ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200">ผ่าน</Badge>
                        ) : (
                          <Badge variant="secondary">-</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {studentSummary.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">ไม่พบข้อมูล</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail View */}
      {viewMode === 'detail' && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>วันที่</TableHead>
                    <TableHead>รหัส</TableHead>
                    <TableHead>ชื่อ-นามสกุล</TableHead>
                    <TableHead className="hidden md:table-cell">แผนก</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="hidden md:table-cell">หมายเหตุ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 200).map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-sm">{a.date}</TableCell>
                      <TableCell className="font-mono text-xs">{a.student_id}</TableCell>
                      <TableCell className="font-medium">{a.student_name}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">{a.department}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[a.status]}>{a.status}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{a.note}</TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">ไม่พบข้อมูล</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {filtered.length > 200 && (
              <p className="text-center text-sm text-muted-foreground py-3">แสดง 200 รายการแรกจากทั้งหมด {filtered.length} รายการ</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}