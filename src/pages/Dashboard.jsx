import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Users, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import StatCard from '../components/dashboard/StatCard';
import DailyChart from '../components/dashboard/DailyChart';
import DepartmentChart from '../components/dashboard/DepartmentChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function Dashboard() {
  const { user } = useOutletContext();
  const today = format(new Date(), 'yyyy-MM-dd');
  const isAdmin = user?.role === 'admin';

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => base44.entities.Student.list('-created_date', 10000),
  });

  const { data: todayAttendance = [] } = useQuery({
    queryKey: ['attendance-today', today],
    queryFn: () => base44.entities.Attendance.filter({ date: today }, '-created_date', 10000),
  });

  const { data: allAttendance = [] } = useQuery({
    queryKey: ['all-attendance'],
    queryFn: () => base44.entities.Attendance.list('-date', 10000),
  });

  const { data: schoolDays = [] } = useQuery({
    queryKey: ['school-calendar'],
    queryFn: () => base44.entities.SchoolCalendar.list('-date', 10000),
  });

  // Filter by teacher's class if not admin
  const myStudents = isAdmin 
    ? students 
    : students.filter(s => s.advisor_email === user?.email);

  const studentIdSet = new Set(myStudents.map((s) => s.student_id));

  const filteredTodayAttendance = todayAttendance.filter((a) => studentIdSet.has(a.student_id));
  const filteredAllAttendance = allAttendance.filter((a) => studentIdSet.has(a.student_id));

  const myTodayAttendance = isAdmin 
    ? filteredTodayAttendance
    : todayAttendance.filter(a => myStudents.some(s => s.student_id === a.student_id));

  const myAllAttendance = isAdmin
    ? filteredAllAttendance
    : allAttendance.filter(a => myStudents.some(s => s.student_id === a.student_id));

  // Today's summary
  const todayStats = {
    'มา': myTodayAttendance.filter(a => a.status === 'มา').length,
    'ขาด': myTodayAttendance.filter(a => a.status === 'ขาด').length,
    'ลา': myTodayAttendance.filter(a => a.status === 'ลา').length,
    'สาย': myTodayAttendance.filter(a => a.status === 'สาย').length,
  };

  // Department stats for admin
  const departments = [...new Set(students.map(s => s.department))].filter(Boolean);
  const deptData = departments.map(dept => {
    const deptAttendance = filteredTodayAttendance.filter(a => a.department === dept);
    return {
      name: dept,
      'มา': deptAttendance.filter(a => a.status === 'มา').length,
      'ขาด': deptAttendance.filter(a => a.status === 'ขาด').length,
      'ลา': deptAttendance.filter(a => a.status === 'ลา').length,
      'สาย': deptAttendance.filter(a => a.status === 'สาย').length,
    };
  });

  // Calculate attendance percentage per student
  const holidays = schoolDays.filter(d => d.type === 'holiday').map(d => d.date);
  const semesterStart = schoolDays.find(d => d.type === 'semester_start');
  
  const getSchoolDaysCount = () => {
    if (!semesterStart) return 0;
    const start = new Date(semesterStart.date);
    const end = new Date();
    let count = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      const dateStr = format(d, 'yyyy-MM-dd');
      if (day !== 0 && day !== 6 && !holidays.includes(dateStr)) {
        count++;
      }
    }
    return count;
  };

  const totalSchoolDays = getSchoolDaysCount();

  const studentPercentages = myStudents.map(student => {
    const attendances = myAllAttendance.filter(a => a.student_id === student.student_id);
    const presentDays = attendances.filter(a => a.status === 'มา' || a.status === 'สาย').length;
    const percentage = totalSchoolDays > 0 ? Math.round((presentDays / totalSchoolDays) * 100) : 100;
    return { ...student, percentage, presentDays };
  });

  const atRiskStudents = studentPercentages.filter(s => s.percentage < 70 && s.percentage > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">แดชบอร์ด</h1>
        <p className="text-muted-foreground">
          {format(new Date(), "'วัน'EEEE'ที่' d MMMM yyyy", { locale: th })}
          {!isAdmin && user?.department && ` • ${user.department}`}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="นักศึกษาทั้งหมด"
          value={myStudents.length}
          icon={Users}
          color="bg-primary/10 text-primary"
        />
        <StatCard
          title="มาวันนี้"
          value={todayStats['มา']}
          icon={CheckCircle}
          color="bg-green-100 text-green-600"
          subtitle={myStudents.length > 0 ? `${Math.round((todayStats['มา'] / myStudents.length) * 100)}%` : '0%'}
        />
        <StatCard
          title="ขาดวันนี้"
          value={todayStats['ขาด']}
          icon={XCircle}
          color="bg-red-100 text-red-600"
        />
        <StatCard
          title="สาย/ลา วันนี้"
          value={todayStats['สาย'] + todayStats['ลา']}
          icon={Clock}
          color="bg-yellow-100 text-yellow-600"
        />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <DailyChart data={todayStats} />
        {isAdmin && <DepartmentChart data={deptData} />}
        {!isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">เปอร์เซ็นต์การเข้าแถวห้องเรียน</CardTitle>
            </CardHeader>
            <CardContent>
              {totalSchoolDays === 0 ? (
                <p className="text-muted-foreground text-center py-8">ยังไม่ได้ตั้งค่าวันเปิดภาคเรียน</p>
              ) : (
                <div className="text-center py-4">
                  <p className="text-5xl font-bold text-primary">
                    {myStudents.length > 0 
                      ? Math.round(studentPercentages.reduce((sum, s) => sum + s.percentage, 0) / studentPercentages.length)
                      : 0}%
                  </p>
                  <p className="text-muted-foreground mt-2">อัตราการเข้าแถวเฉลี่ย</p>
                  <p className="text-sm text-muted-foreground">จากวันเข้าแถวทั้งหมด {totalSchoolDays} วัน</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* At Risk Students */}
      {atRiskStudents.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              นักศึกษาที่เสี่ยงไม่ผ่านการเข้าแถว
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {atRiskStudents.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <span className="font-medium">{s.student_id}</span>
                    <span className="ml-2">{s.first_name} {s.last_name}</span>
                    <span className="ml-2 text-sm text-muted-foreground">{s.department}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{s.percentage}%</span>
                    {s.percentage < 60 ? (
                      <Badge variant="destructive">ไม่ผ่าน</Badge>
                    ) : (
                      <Badge className="bg-orange-100 text-orange-700 border-orange-200">ใกล้ไม่ผ่าน</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}