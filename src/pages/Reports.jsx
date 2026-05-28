import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
  const pageSize = 50;
  
  const [dateFrom, setDateFrom] = useState(format(new Date(new Date().setDate(1)), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchDept, setSearchDept] = useState('all');
  const [searchYear, setSearchYear] = useState('all');
  const [searchId, setSearchId] = useState('');
  const [viewMode, setViewMode] = useState('summary');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo, searchDept, searchYear, searchId, viewMode]);

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['reports-attendance-server', dateFrom, dateTo, searchDept, searchYear, searchId, page, pageSize, isAdmin, user?.email],
    queryFn: async () => {
      const apiBaseUrl = import.meta.env.VITE_MONGO_API_URL || 'https://tnc-check.onrender.com/mongo-api';
      const params = new URLSearchParams({
        dateFrom,
        dateTo,
        department: searchDept,
        year: searchYear,
        search: searchId,
        page: String(page),
        pageSize: String(pageSize),
        isAdmin: String(isAdmin),
        advisorEmail: user?.email || '',
      });
      const response = await fetch(`${apiBaseUrl}/reports/attendance?${params.toString()}`);
      if (!response.ok) throw new Error('โหลดรายงานไม่สำเร็จ');
      return response.json();
    },
  });

  const summary = reportData?.summary || { items: [], totalDaysInRange: 0 };
  const detail = reportData?.detail || { items: [], total: 0, page: 1, pageSize, totalPages: 0 };
  const departments = reportData?.departments || [];
  const years = reportData?.years || [];

  const exportToExcel = () => {
    const run = async () => {
      const apiBaseUrl = import.meta.env.VITE_MONGO_API_URL || 'https://tnc-check.onrender.com/mongo-api';
      const params = new URLSearchParams({
        dateFrom,
        dateTo,
        department: searchDept,
        year: searchYear,
        search: searchId,
        page: '1',
        pageSize: '10000',
        isAdmin: String(isAdmin),
        advisorEmail: user?.email || '',
      });
      const response = await fetch(`${apiBaseUrl}/reports/attendance?${params.toString()}`);
      if (!response.ok) throw new Error('export ไม่สำเร็จ');
      const data = await response.json();
      const rows = (data?.detail?.items || []).map((a) => ({
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

    run().catch(() => {
      // ignore export error toast to keep existing UX behavior
    });
  };

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
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
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
              <label className="text-xs font-medium text-muted-foreground mb-1 block">ชั้นปี</label>
              <Select value={searchYear} onValueChange={setSearchYear}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {years.map(y => <SelectItem key={y} value={String(y)}>{`ปี ${y}`}</SelectItem>)}
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
                  {summary.items.map((s, idx) => (
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
                  {summary.items.length === 0 && (
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
                  {detail.items.map((a) => (
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
                  {detail.items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">ไม่พบข้อมูล</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between p-3 text-sm text-muted-foreground">
              <span>ทั้งหมด {detail.total} รายการ</span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={detail.page <= 1}
                  onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                >
                  ก่อนหน้า
                </Button>
                <span>หน้า {detail.page} / {detail.totalPages || 1}</span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={detail.totalPages === 0 || detail.page >= detail.totalPages}
                  onClick={() => setPage((prev) => prev + 1)}
                >
                  ถัดไป
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}