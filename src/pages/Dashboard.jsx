import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Users, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import StatCard from '../components/dashboard/StatCard';
import DailyChart from '../components/dashboard/DailyChart';
import DepartmentChart from '../components/dashboard/DepartmentChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useUserPermissions } from '@/lib/access-control';

export default function Dashboard() {
  const { user } = useOutletContext();
  const today = format(new Date(), 'yyyy-MM-dd');
  const isAdmin = user?.role === 'admin';
  const permissions = useUserPermissions(user);
  const canAccessAllStudentsForAttendance = isAdmin || permissions.profile === 'attendance_taker';

  const { data: dashboardData } = useQuery({
    queryKey: ['dashboard-summary', today, canAccessAllStudentsForAttendance, user?.email],
    queryFn: async () => {
      const apiBaseUrl = import.meta.env.VITE_MONGO_API_URL || 'https://tnc-check.onrender.com/mongo-api';
      const params = new URLSearchParams({
        date: today,
        isAdmin: String(canAccessAllStudentsForAttendance),
        advisorEmail: user?.email || '',
      });
      const response = await fetch(`${apiBaseUrl}/dashboard-summary?${params.toString()}`);
      if (!response.ok) throw new Error('โหลดข้อมูลแดชบอร์ดไม่สำเร็จ');
      return response.json();
    },
  });

  const studentCount = dashboardData?.studentCount || 0;
  const todayStats = dashboardData?.todayStats || { 'มา': 0, 'ขาด': 0, 'ลา': 0, 'สาย': 0 };
  const deptData = dashboardData?.deptData || [];
  const totalCheckedDays = dashboardData?.totalCheckedDays || 0;
  const averageAttendancePct = dashboardData?.averageAttendancePct || 0;
  const atRiskStudents = dashboardData?.atRiskStudents || [];

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
          value={studentCount}
          icon={Users}
          color="bg-primary/10 text-primary"
        />
        <StatCard
          title="มาวันนี้"
          value={todayStats['มา']}
          icon={CheckCircle}
          color="bg-green-100 text-green-600"
          subtitle={studentCount > 0 ? `${Math.round((todayStats['มา'] / studentCount) * 100)}%` : '0%'}
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
              {totalCheckedDays === 0 ? (
                <p className="text-muted-foreground text-center py-8">ยังไม่มีการบันทึกเช็คเข้าแถว</p>
              ) : (
                <div className="text-center py-4">
                  <p className="text-5xl font-bold text-primary">
                    {averageAttendancePct}%
                  </p>
                  <p className="text-muted-foreground mt-2">อัตราการเข้าแถวเฉลี่ย</p>
                  <p className="text-sm text-muted-foreground">จากวันที่เช็คเข้าแถวจริง {totalCheckedDays} วัน</p>
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