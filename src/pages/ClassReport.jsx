import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, CheckCircle2, XCircle, Clock, Printer } from 'lucide-react';

const STATUS_BADGE = {
  มา: 'bg-green-100 text-green-700 border border-green-200',
  ขาด: 'bg-red-100 text-red-700 border border-red-200',
  ลา: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  สาย: 'bg-orange-100 text-orange-700 border border-orange-200',
};

function StatCard({ icon, label, value, iconBg, iconColor, borderColor }) {
  return (
    <div className={`bg-white rounded-xl border-2 ${borderColor} p-4 flex items-center gap-4`}>
      <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
        {React.cloneElement(icon, { className: `w-6 h-6 ${iconColor}`, strokeWidth: 2.5 })}
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-3xl font-bold text-gray-800 leading-none mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function CountBadge({ value, colorClass }) {
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-semibold ${colorClass}`}>
      {value}
    </span>
  );
}

export default function ClassReport() {
  const [filterDate, setFilterDate] = useState('ทั้งหมด');
  const [filterStatus, setFilterStatus] = useState('ทั้งหมด');
  const [logoError, setLogoError] = useState(false);
  const params = useParams();
  const department = decodeURIComponent(params.department || '');
  const level = decodeURIComponent(params.level || '');
  const year = String(params.year || '');
  const group = String(params.group || '');
  const roomPath = `${encodeURIComponent(department)}/${encodeURIComponent(level)}/${encodeURIComponent(year)}/${encodeURIComponent(group)}`;

  const { data: roomData, isLoading } = useQuery({
    queryKey: ['class-room-report', roomPath],
    queryFn: async () => {
      const apiBaseUrl = import.meta.env.VITE_MONGO_API_URL || 'https://tnc-check.onrender.com/mongo-api';
      const response = await fetch(`${apiBaseUrl}/class-report/${roomPath}`);
      if (!response.ok) throw new Error('โหลดรายงานห้องเรียนไม่สำเร็จ');
      return response.json();
    },
  });

  const roomStudents = roomData?.students || [];
  const roomAttendance = roomData?.attendance || [];

  const advisorNames = useMemo(() => {
    return [...new Set(
      roomStudents
        .map((s) => String(s.advisor_email || '').trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));
  }, [roomStudents]);

  const advisorLabel = advisorNames.length > 0 ? advisorNames.join(', ') : '-';

  // จำนวนวันเข้าแถวทั้งหมดของห้อง (unique dates) ใช้เป็นตัวหาร
  const totalDays = useMemo(
    () => new Set(roomAttendance.map((a) => a.date)).size,
    [roomAttendance]
  );

  const summary = useMemo(
    () => roomStudents.map((student) => {
      const records = roomAttendance.filter((a) => a.student_id === student.student_id);
      const present = records.filter((a) => a.status === 'มา').length;
      const late = records.filter((a) => a.status === 'สาย').length;
      const absent = records.filter((a) => a.status === 'ขาด').length;
      const leave = records.filter((a) => a.status === 'ลา').length;
      // ใช้ totalDays (วันเข้าแถวจริงของห้อง) เป็นตัวหาร ไม่ใช่ records.length
      const attendancePct = totalDays > 0 ? Math.round(((present + late) / totalDays) * 100) : 0;
      return { ...student, present, late, absent, leave, total: totalDays, attendancePct };
    }),
    [roomStudents, roomAttendance, totalDays]
  );

  const presentCount = roomAttendance.filter((a) => a.status === 'มา').length;
  const absentCount = roomAttendance.filter((a) => a.status === 'ขาด').length;
  const lateLeaveCount = roomAttendance.filter((a) => a.status === 'สาย' || a.status === 'ลา').length;

  const uniqueDates = useMemo(() => {
    const dates = [...new Set(roomAttendance.map((a) => a.date))].sort((a, b) => b.localeCompare(a));
    return dates;
  }, [roomAttendance]);

  const filteredAttendance = useMemo(() => {
    return roomAttendance
      .filter((a) => filterDate === 'ทั้งหมด' || a.date === filterDate)
      .filter((a) => filterStatus === 'ทั้งหมด' || a.status === filterStatus);
  }, [roomAttendance, filterDate, filterStatus]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="no-print border-b border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          {!logoError ? (
            <img
              src="https://tnc-check01.gt.tc/img/logo.png"
              alt="logo"
              className="w-10 h-10 object-contain rounded-full"
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-lg font-bold">ช</span>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-700">งานกิจกรรมนักเรียน นักศึกษา</p>
            <p className="text-xs text-gray-400">Chanthaburi Technical College</p>
            <p className="text-xs text-gray-500 mt-0.5">ครูที่ปรึกษา: {advisorLabel}</p>
          </div>
        </div>
      </div>

      <div className="print-full flex-1 max-w-5xl mx-auto w-full px-4 py-6 space-y-5">
        {/* Print-only header */}
        <div className="hidden print:block mb-4 pb-3 border-b-2 border-gray-800">
          <div className="flex items-center gap-3">
            {!logoError ? (
              <img
                src="https://tnc-check01.gt.tc/img/logo.png"
                alt="logo"
                className="w-12 h-12 object-contain rounded-full"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-amber-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xl font-bold">ช</span>
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-gray-700">วิทยาลัยเทคนิคจันทบุรี — งานกิจกรรมนักเรียน นักศึกษา</p>
              <p className="text-xs text-gray-600 mt-0.5">ครูที่ปรึกษา: {advisorLabel}</p>
              <h1 className="text-base font-bold text-gray-900">
                รายงานผลการเช็คชื่อกิจกรรมหน้าเสาธง: {department} | {level} ปี {year} กลุ่ม {group}
              </h1>
            </div>
          </div>
        </div>

        {/* Screen header */}
        <div className="print:hidden flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-800">
              รายงานผลการเช็คชื่อกิจกรรมหน้าเสาธง: {department} | {level} ปี {year} กลุ่ม {group}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">🧑‍💼 งานกิจกรรมนักเรียน นักศึกษา</p>
            <p className="text-sm text-gray-500">ครูที่ปรึกษา: {advisorLabel}</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors"
            >
              <Printer className="w-4 h-4" />
              พิมพ์รายงาน
            </button>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="print-stat-grid grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={<Users />}
            label="นักเรียนทั้งหมด"
            value={roomStudents.length}
            iconBg="bg-blue-100"
            iconColor="text-blue-600"
            borderColor="border-blue-200"
          />
          <StatCard
            icon={<CheckCircle2 />}
            label="มาเรียน"
            value={presentCount}
            iconBg="bg-green-100"
            iconColor="text-green-600"
            borderColor="border-green-200"
          />
          <StatCard
            icon={<XCircle />}
            label="ขาดเรียน"
            value={absentCount}
            iconBg="bg-red-100"
            iconColor="text-red-500"
            borderColor="border-red-200"
          />
          <StatCard
            icon={<Clock />}
            label="สาย/ลา"
            value={lateLeaveCount}
            iconBg="bg-orange-100"
            iconColor="text-orange-500"
            borderColor="border-orange-200"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : roomStudents.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
            ไม่พบนักเรียนในห้องที่ระบุ
          </div>
        ) : (
          <>
            {/* Individual Summary */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-700">สรุปรายบุคคล</h2>
                <span className="text-xs text-gray-400">เกณฑ์ผ่าน ≥ 60% ({totalDays} วัน)</span>
              </div>
              <div className="divide-y divide-gray-100">
                {summary.map((s, idx) => {
                  const failed = s.attendancePct < 60;
                  const barColor = s.attendancePct >= 80
                    ? 'bg-green-500'
                    : s.attendancePct >= 60
                    ? 'bg-yellow-400'
                    : 'bg-red-500';
                  return (
                    <div
                      key={s.id}
                      className={`print-row flex items-center gap-3 px-4 py-2.5 ${failed ? 'bg-red-50' : 'hover:bg-gray-50'}`}
                    >
                      <span className="w-6 text-right text-xs text-gray-400 flex-shrink-0">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1 gap-2">
                          <span className={`text-sm font-medium truncate ${failed ? 'text-red-700' : 'text-gray-800'}`}>
                            {(s.title || '') + s.first_name} {s.last_name}
                            <span className="ml-1.5 text-xs font-normal text-gray-400">{s.student_id}</span>
                          </span>
                          <span className={`text-sm font-bold flex-shrink-0 ${failed ? 'text-red-600' : 'text-gray-700'}`}>
                            {s.attendancePct}%
                          </span>
                        </div>
                        <div className="print-bar w-full bg-gray-100 rounded-full h-2">
                          <div
                            className={`print-bar h-2 rounded-full transition-all ${barColor}`}
                            style={{ width: `${Math.min(s.attendancePct, 100)}%` }}
                          />
                        </div>
                      </div>
                      {failed && (
                        <span className="flex-shrink-0 text-xs font-semibold text-red-500 border border-red-300 rounded px-1.5 py-0.5 bg-red-50">
                          ตก
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Attendance Log */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold text-gray-700">
                  รายการเช็คชื่อ
                  <span className="ml-2 text-sm font-normal text-gray-400">({filteredAttendance.length} รายการ)</span>
                </h2>
                <div className="no-print flex flex-wrap gap-2">
                  {/* Date filter */}
                  <select
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <option value="ทั้งหมด">วันที่: ทั้งหมด</option>
                    {uniqueDates.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  {/* Status filter */}
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <option value="ทั้งหมด">สถานะ: ทั้งหมด</option>
                    <option value="มา">มา</option>
                    <option value="ขาด">ขาด</option>
                    <option value="สาย">สาย</option>
                    <option value="ลา">ลา</option>
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-gray-600 font-medium">วันที่</TableHead>
                      <TableHead className="text-gray-600 font-medium">รหัส</TableHead>
                      <TableHead className="text-gray-600 font-medium">ชื่อ</TableHead>
                      <TableHead className="text-gray-600 font-medium">สถานะ</TableHead>
                      <TableHead className="text-gray-600 font-medium">หมายเหตุ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAttendance.slice(0, 100).map((row) => (
                      <TableRow key={row.id} className="hover:bg-gray-50">
                        <TableCell className="font-mono text-sm text-gray-700">{row.date}</TableCell>
                        <TableCell className="font-mono text-sm text-gray-700">{row.student_id}</TableCell>
                        <TableCell className="text-gray-800">{row.student_name || '-'}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[row.status] || 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                            {row.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-400">{row.note || '–'}</TableCell>
                      </TableRow>
                    ))}
                    {filteredAttendance.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10 text-gray-400">
                          {roomAttendance.length === 0 ? 'ยังไม่มีข้อมูลเช็คชื่อ' : 'ไม่พบรายการที่ตรงกับตัวกรอง'}
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredAttendance.length > 100 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-3 text-sm text-gray-400">
                          แสดง 100 รายการแรก จากทั้งหมด {filteredAttendance.length} รายการ — กรองตามวันที่เพื่อดูรายการเพิ่มเติม
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        )}
      </div>

    </div>
  );
}