import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';
import { Users, Printer } from 'lucide-react';

function StatCard({ icon, label, value, detail, iconBg, iconColor, borderColor }) {
  return (
    <div className={`bg-white rounded-xl border-2 ${borderColor} p-4 flex items-center gap-4`}>
      <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
        {React.cloneElement(icon, { className: `w-6 h-6 ${iconColor}`, strokeWidth: 2.5 })}
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-800 leading-tight mt-0.5">{value}</p>
        {detail && <p className="text-xs text-gray-500 mt-1">{detail}</p>}
      </div>
    </div>
  );
}

export default function ClassReport() {
  const [logoError, setLogoError] = useState(false);
  const [dateMode, setDateMode] = useState('cumulative');
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [showAtRiskOnly, setShowAtRiskOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState('attendance-asc');
  const params = useParams();
  const department = decodeURIComponent(params.department || '');
  const level = decodeURIComponent(params.level || '');
  const year = String(params.year || '');
  const group = String(params.group || '');
  const roomPath = `${encodeURIComponent(department)}/${encodeURIComponent(level)}/${encodeURIComponent(year)}/${encodeURIComponent(group)}`;
  const today = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  })();
  const reportDate = dateMode === 'today' ? today : selectedDate;

  const { data: roomData, isLoading } = useQuery({
    queryKey: ['class-room-report', roomPath, reportDate],
    queryFn: async () => {
      const apiBaseUrl = import.meta.env.VITE_MONGO_API_URL || 'https://tnc-check.onrender.com/mongo-api';
      const response = await fetch(`${apiBaseUrl}/class-report/${roomPath}?date=${reportDate}`);
      if (!response.ok) throw new Error('โหลดรายงานห้องเรียนไม่สำเร็จ');
      return response.json();
    },
  });

  const roomStudents = roomData?.students || [];
  const roomSummary = roomData?.summary || {};
  const dailySummary = roomData?.daily_summary || {};
  const mandatoryActivities = roomData?.mandatory_activities || { total_days: 0, by_date: [] };

  const advisorNames = useMemo(() => {
    return [...new Set(
      roomStudents
        .map((s) => String(s.advisor_email || '').trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));
  }, [roomStudents]);

  const advisorLabel = advisorNames.length > 0 ? advisorNames.join(', ') : '-';

  const totalDays = roomSummary.total_days || 0;
  const totalPlannedDays = roomSummary.total_planned_days || totalDays;
  const daysRemaining = roomSummary.days_remaining || 0;

  const summary = useMemo(
    () => roomStudents.map((student) => {
      const studentSummary = student.attendance_summary || {};
      const present = studentSummary.present || 0;
      const late = studentSummary.late || 0;
      const absent = studentSummary.absent || 0;
      const leave = studentSummary.leave || 0;
      const attended = present + late;
      const attendancePct = studentSummary.attendancePct || 0;
      const requiredToPass = Math.max(0, Math.ceil(totalPlannedDays * 0.6) - attended);
      const hasAttendanceData = totalDays > 0;
      const atRisk = hasAttendanceData && attendancePct < 60;
      let attendanceStatus = 'ยังไม่มีข้อมูล';
      if (hasAttendanceData) {
        if (!atRisk) attendanceStatus = 'ผ่านเกณฑ์ ณ วันที่';
        else if (daysRemaining > 0 && requiredToPass <= daysRemaining) {
          attendanceStatus = `ต้องเข้าอีก ${requiredToPass} จาก ${daysRemaining} วันที่เหลือ`;
        } else attendanceStatus = 'เสี่ยงไม่ผ่าน';
      }
      return {
        ...student,
        present,
        late,
        absent,
        leave,
        attended,
        total: totalDays,
        attendancePct,
        requiredToPass,
        attendanceStatus,
        atRisk,
      };
    }),
    [roomStudents, totalDays, totalPlannedDays, daysRemaining]
  );

  const visibleSummary = useMemo(() => {
    const filtered = showAtRiskOnly ? summary.filter((student) => student.atRisk) : summary;
    return [...filtered].sort((a, b) => {
      if (sortOrder === 'attendance-desc') return b.attendancePct - a.attendancePct;
      if (sortOrder === 'name-asc') return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, 'th');
      return a.attendancePct - b.attendancePct;
    });
  }, [summary, showAtRiskOnly, sortOrder]);

  const averageAttendance = summary.length > 0
    ? Math.round(summary.reduce((total, student) => total + student.attendancePct, 0) / summary.length)
    : 0;
  const dateLabel = reportDate ? format(parseISO(reportDate), 'd MMMM yyyy', { locale: th }) : '-';
  const dailyPresent = dailySummary.present || 0;
  const dailyLateLeave = (dailySummary.late || 0) + (dailySummary.leave || 0);
  const dailyAbsent = dailySummary.absent || 0;
  const mandatoryTotalDays = mandatoryActivities.total_days || 0;
  const mandatoryByDate = mandatoryActivities.by_date || [];

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
              <p className="text-xs text-gray-600 mt-1">ข้อมูล ณ วันที่ {dateLabel}</p>
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
            <p className="text-sm font-medium text-teal-700 mt-1">ข้อมูล ณ วันที่ {dateLabel}</p>
          </div>
          <div className="flex flex-wrap gap-2 flex-shrink-0">
            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setDateMode('selected')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium ${dateMode === 'selected' ? 'bg-teal-700 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                วันที่เลือก
              </button>
              <button
                type="button"
                onClick={() => setDateMode('today')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium ${dateMode === 'today' ? 'bg-teal-700 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                สะสมถึงวันนี้
              </button>
            </div>
            {dateMode === 'selected' && (
              <input
                type="date"
                value={selectedDate}
                max={today}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
                aria-label="เลือกวันที่รายงาน"
              />
            )}
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
        <div className="print-stat-grid grid grid-cols-1 sm:grid-cols-2 gap-3">
          <StatCard
            icon={<Users />}
            label={`${reportDate === today ? 'วันนี้' : 'วันที่เลือก'} · ${dateLabel}`}
            value={`มา ${dailyPresent} / ขาด ${dailyAbsent} / สาย-ลา ${dailyLateLeave}`}
            detail={`จาก ${roomStudents.length} คน`}
            iconBg="bg-blue-100"
            iconColor="text-blue-600"
            borderColor="border-blue-200"
          />
          <StatCard
            icon={<Users />}
            label="เฉลี่ยสะสม"
            value={`${averageAttendance}%`}
            detail={`เข้าร่วมเฉลี่ยถึงวันที่ ${dateLabel} · ${totalDays} วันเรียน`}
            iconBg="bg-green-100"
            iconColor="text-green-600"
            borderColor="border-green-200"
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
              <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-gray-700">สรุปรายบุคคล</h2>
                  <span className="text-xs text-gray-400">เกณฑ์ผ่าน ≥ 60% · วันเรียน {totalDays} วัน</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={showAtRiskOnly}
                      onChange={(event) => setShowAtRiskOnly(event.target.checked)}
                      className="h-4 w-4 accent-red-600"
                    />
                    เฉพาะคนเสี่ยง
                  </label>
                  <select
                    value={sortOrder}
                    onChange={(event) => setSortOrder(event.target.value)}
                    className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700"
                    aria-label="เรียงรายชื่อนักเรียน"
                  >
                    <option value="attendance-asc">เข้าร่วมน้อยไปมาก</option>
                    <option value="attendance-desc">เข้าร่วมมากไปน้อย</option>
                    <option value="name-asc">เรียงตามชื่อ</option>
                  </select>
                  <span className="text-xs text-gray-400">{visibleSummary.length} คน</span>
                </div>
              </div>
              <div className="max-h-[560px] overflow-y-auto divide-y divide-gray-100">
                {visibleSummary.map((s, idx) => {
                  const hasAttendanceData = totalDays > 0;
                  const activitySummary = s.activity_summary || {};
                  const activityAttended = (activitySummary.present || 0) + (activitySummary.late || 0);
                  const barColor = s.attendancePct >= 80
                    ? 'bg-green-500'
                    : s.attendancePct >= 60
                    ? 'bg-yellow-400'
                    : 'bg-red-500';
                  const statusStyle = s.atRisk
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : hasAttendanceData
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-gray-50 text-gray-500 border-gray-200';
                  return (
                    <div
                      key={s.id}
                      className={`print-row flex items-center gap-3 px-4 py-2.5 ${s.atRisk ? 'bg-red-50/60' : 'hover:bg-gray-50'}`}
                    >
                      <span className="w-6 text-right text-xs text-gray-400 flex-shrink-0">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                          <span className="text-sm font-medium text-gray-800">
                            {(s.title || '') + s.first_name} {s.last_name}
                            <span className="ml-1.5 text-xs font-normal text-gray-400">{s.student_id}</span>
                          </span>
                          <span className={`text-[11px] leading-4 border rounded px-1.5 py-0.5 ${statusStyle}`}>
                            {s.attendanceStatus}
                          </span>
                        </div>
                        {mandatoryTotalDays > 0 && (
                          <span className="inline-flex text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 mb-1">
                            กิจกรรมบังคับ {activityAttended}/{mandatoryTotalDays} วัน
                          </span>
                        )}
                        <p className="text-xs text-gray-600 mb-1">
                          เข้าร่วม {s.attended} จาก {s.total} วันที่จัดไปแล้ว ({hasAttendanceData ? `${s.attendancePct}%` : '-'})
                        </p>
                        <div className="print-bar w-full bg-gray-100 rounded-full h-2">
                          <div
                            className={`print-bar h-2 rounded-full transition-all ${barColor}`}
                            style={{ width: `${hasAttendanceData ? Math.min(s.attendancePct, 100) : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {visibleSummary.length === 0 && (
                  <p className="px-5 py-8 text-center text-sm text-gray-500">ไม่พบรายชื่อตามตัวกรอง</p>
                )}
              </div>
            </div>

            {/* Mandatory Activity Dates */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-700">กิจกรรมบังคับตามปฏิทิน</h2>
                <span className="text-xs text-gray-400">ทั้งหมด {mandatoryTotalDays} วัน</span>
              </div>
              {mandatoryByDate.length === 0 ? (
                <div className="px-5 py-6 text-sm text-gray-400">ยังไม่พบรายการกิจกรรมบังคับในปฏิทิน</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">วันที่</th>
                        <th className="text-left px-4 py-2 font-medium">รายละเอียด</th>
                        <th className="text-center px-3 py-2 font-medium">มา</th>
                        <th className="text-center px-3 py-2 font-medium">สาย</th>
                        <th className="text-center px-3 py-2 font-medium">ขาด</th>
                        <th className="text-center px-3 py-2 font-medium">ลา</th>
                        <th className="text-center px-3 py-2 font-medium">ยังไม่เช็ค</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {mandatoryByDate.map((item) => (
                        <tr key={item.date} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-700">{item.date}</td>
                          <td className="px-4 py-2 text-gray-500">{item.description || '-'}</td>
                          <td className="px-3 py-2 text-center text-green-700 font-medium">{item.present || 0}</td>
                          <td className="px-3 py-2 text-center text-orange-700 font-medium">{item.late || 0}</td>
                          <td className="px-3 py-2 text-center text-red-700 font-medium">{item.absent || 0}</td>
                          <td className="px-3 py-2 text-center text-yellow-700 font-medium">{item.leave || 0}</td>
                          <td className="px-3 py-2 text-center text-gray-600 font-medium">{item.unrecorded || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </>
        )}
      </div>

    </div>
  );
}