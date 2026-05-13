import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, differenceInWeeks } from 'date-fns';
import { th } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Trash2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useUserPermissions } from '@/lib/access-control';

const TYPE_LABELS = {
  holiday: 'วันหยุด',
  school_day: 'วันเรียน',
  semester_start: 'เปิดภาคเรียน',
  semester_end: 'ปิดภาคเรียน',
};

const TYPE_COLORS = {
  holiday: 'bg-red-100 text-red-700',
  school_day: 'bg-green-100 text-green-700',
  semester_start: 'bg-blue-100 text-blue-700',
  semester_end: 'bg-purple-100 text-purple-700',
};

const DAY_NAMES = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

export default function SchoolCalendar() {
  const { user } = useOutletContext();
  const permissions = useUserPermissions(user);
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showAdd, setShowAdd] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [addType, setAddType] = useState('holiday');
  const [addDesc, setAddDesc] = useState('');

  const { data: calendarData = [] } = useQuery({
    queryKey: ['school-calendar'],
    queryFn: () => base44.entities.SchoolCalendar.list('-date', 10000),
  });

  if (!permissions.canEditData) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          คุณไม่มีสิทธิ์แก้ไขปฏิทินการศึกษา
        </CardContent>
      </Card>
    );
  }

  const semesterStart = calendarData.find(d => d.type === 'semester_start');
  const holidays = calendarData.filter(d => d.type === 'holiday').map(d => d.date);

  // Calculate week number from semester start
  const getWeekNumber = (dateStr) => {
    if (!semesterStart) return null;
    const start = new Date(semesterStart.date);
    const date = new Date(dateStr);
    if (date < start) return null;
    return Math.floor(differenceInWeeks(date, start)) + 1;
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = getDay(monthStart);

  const handleAdd = async () => {
    let weekNum = null;
    if (addType === 'school_day' || addType === 'semester_start') {
      weekNum = getWeekNumber(selectedDate);
    }
    await base44.entities.SchoolCalendar.create({
      date: selectedDate,
      type: addType,
      description: addDesc,
      week_number: weekNum,
    });
    queryClient.invalidateQueries({ queryKey: ['school-calendar'] });
    setShowAdd(false);
    setAddDesc('');
    toast({ title: 'บันทึกสำเร็จ' });
  };

  const handleDelete = async (id) => {
    await base44.entities.SchoolCalendar.delete(id);
    queryClient.invalidateQueries({ queryKey: ['school-calendar'] });
    toast({ title: 'ลบสำเร็จ' });
  };

  const getDateEvents = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return calendarData.filter(d => d.date === dateStr);
  };

  const today = format(new Date(), 'yyyy-MM-dd');

  // Count school days
  const countSchoolDays = () => {
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
  };

  const currentWeek = getWeekNumber(today);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">ปฏิทินการศึกษา</h1>
          <p className="text-muted-foreground">กำหนดวันหยุด วันเปิด-ปิดภาคเรียน</p>
        </div>
        <Button className="gap-2" onClick={() => { setShowAdd(true); setSelectedDate(format(new Date(), 'yyyy-MM-dd')); }}>
          <Plus className="w-4 h-4" /> เพิ่มรายการ
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">เปิดภาคเรียน</p>
            <p className="font-bold mt-1">{semesterStart ? format(new Date(semesterStart.date), 'd MMM yy', { locale: th }) : 'ยังไม่กำหนด'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">สัปดาห์ที่</p>
            <p className="font-bold text-2xl mt-1">{currentWeek || '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">วันเข้าแถวทั้งหมด</p>
            <p className="font-bold text-2xl mt-1">{countSchoolDays()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">วันหยุดที่กำหนด</p>
            <p className="font-bold text-2xl mt-1">{holidays.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Calendar */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <CardTitle className="text-lg">
              {format(currentMonth, 'MMMM yyyy', { locale: th })}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1">
            {DAY_NAMES.map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
            {Array(startPadding).fill(null).map((_, i) => <div key={`pad-${i}`} />)}
            {daysInMonth.map(date => {
              const dateStr = format(date, 'yyyy-MM-dd');
              const events = getDateEvents(date);
              const isToday = dateStr === today;
              const isWeekend = getDay(date) === 0 || getDay(date) === 6;
              const isHoliday = events.some(e => e.type === 'holiday');
              const isSemesterStart = events.some(e => e.type === 'semester_start');
              const weekNum = getWeekNumber(dateStr);

              return (
                <button
                  key={dateStr}
                  onClick={() => { setSelectedDate(dateStr); setShowAdd(true); }}
                  className={`relative p-1.5 rounded-lg text-sm transition-all min-h-[44px] ${
                    isToday ? 'bg-primary text-primary-foreground font-bold' :
                    isHoliday ? 'bg-red-50 text-red-600' :
                    isSemesterStart ? 'bg-blue-50 text-blue-600' :
                    isWeekend ? 'text-muted-foreground bg-muted/30' :
                    'hover:bg-muted'
                  }`}
                >
                  <span className="block">{format(date, 'd')}</span>
                  {weekNum && !isWeekend && !isHoliday && (
                    <span className="text-[9px] text-muted-foreground block">ส.{weekNum}</span>
                  )}
                  {events.length > 0 && (
                    <div className="flex gap-0.5 justify-center mt-0.5">
                      {events.map((e, i) => (
                        <div key={i} className={`w-1.5 h-1.5 rounded-full ${
                          e.type === 'holiday' ? 'bg-red-500' :
                          e.type === 'semester_start' ? 'bg-blue-500' :
                          e.type === 'semester_end' ? 'bg-purple-500' :
                          'bg-green-500'
                        }`} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Events List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">รายการที่กำหนดไว้</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {calendarData.sort((a, b) => a.date.localeCompare(b.date)).map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <span className="font-medium text-sm">{format(new Date(item.date), 'd MMM yy', { locale: th })}</span>
                    <span className="mx-2">-</span>
                    <span className="text-sm">{item.description || TYPE_LABELS[item.type]}</span>
                  </div>
                  <Badge className={TYPE_COLORS[item.type]}>{TYPE_LABELS[item.type]}</Badge>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
            {calendarData.length === 0 && (
              <p className="text-center text-muted-foreground py-4">ยังไม่มีรายการ</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>เพิ่มรายการปฏิทิน</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>วันที่</Label>
              <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
            </div>
            <div>
              <Label>ประเภท</Label>
              <Select value={addType} onValueChange={setAddType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="holiday">วันหยุด</SelectItem>
                  <SelectItem value="school_day">วันเรียนพิเศษ</SelectItem>
                  <SelectItem value="semester_start">เปิดภาคเรียน</SelectItem>
                  <SelectItem value="semester_end">ปิดภาคเรียน</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>รายละเอียด</Label>
              <Input value={addDesc} onChange={e => setAddDesc(e.target.value)} placeholder="เช่น วันมาฆบูชา" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>ยกเลิก</Button>
            <Button onClick={handleAdd} disabled={!selectedDate}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}