import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, Building2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { DEFAULT_DEPARTMENTS } from '@/lib/departments';
import { useUserPermissions } from '@/lib/access-control';

export default function Departments() {
  const { user } = useOutletContext();
  const permissions = useUserPermissions(user);
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [addingDefaults, setAddingDefaults] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list('-created_date', 100),
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => base44.entities.Student.list('-created_date', 10000),
  });

  if (!permissions.canEditData) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          คุณไม่มีสิทธิ์แก้ไขข้อมูลแผนก
        </CardContent>
      </Card>
    );
  }

  const handleAdd = async () => {
    await base44.entities.Department.create({ name, code });
    queryClient.invalidateQueries({ queryKey: ['departments'] });
    setShowAdd(false);
    setName('');
    setCode('');
    toast({ title: 'เพิ่มแผนกสำเร็จ' });
  };

  const handleDelete = async (id) => {
    if (confirm('ยืนยันการลบแผนกนี้?')) {
      await base44.entities.Department.delete(id);
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast({ title: 'ลบแผนกสำเร็จ' });
    }
  };

  const handleAddDefaults = async () => {
    const existing = new Set(departments.map((d) => (d.name || '').trim()));
    const toCreate = DEFAULT_DEPARTMENTS.filter((d) => !existing.has(d));

    if (toCreate.length === 0) {
      toast({ title: 'มีแผนกชุดนี้ครบแล้ว' });
      return;
    }

    setAddingDefaults(true);
    try {
      await Promise.all(toCreate.map((deptName) => base44.entities.Department.create({ name: deptName })));
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast({ title: 'เพิ่มแผนกสำเร็จ', description: `เพิ่มแล้ว ${toCreate.length} แผนก` });
    } finally {
      setAddingDefaults(false);
    }
  };

  const openDepartmentDetail = (dept) => {
    const deptStudents = students.filter((s) => s.department === dept.name);
    const roomMap = {};

    deptStudents.forEach((s) => {
      const level = s.level || '-';
      const year = s.year || '-';
      const group = s.group || '-';
      const key = `${level}|${year}|${group}`;

      if (!roomMap[key]) {
        roomMap[key] = {
          level,
          year,
          group,
          count: 0,
        };
      }

      roomMap[key].count += 1;
    });

    const rooms = Object.values(roomMap).sort((a, b) => {
      const levelCompare = String(a.level).localeCompare(String(b.level));
      if (levelCompare !== 0) return levelCompare;
      const yearCompare = String(a.year).localeCompare(String(b.year));
      if (yearCompare !== 0) return yearCompare;
      return String(a.group).localeCompare(String(b.group));
    });

    setSelectedDepartment({
      name: dept.name,
      code: dept.code,
      totalStudents: deptStudents.length,
      rooms,
    });
    setShowDetail(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">แผนกวิชา</h1>
          <p className="text-muted-foreground">จัดการข้อมูลแผนกวิชา</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleAddDefaults} disabled={addingDefaults}>
            {addingDefaults ? 'กำลังเพิ่ม...' : 'เพิ่มแผนกชุดมาตรฐาน'}
          </Button>
          <Button className="gap-2" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4" /> เพิ่มแผนก
          </Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.map(dept => {
          const count = students.filter(s => s.department === dept.name).length;
          return (
            <Card key={dept.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openDepartmentDetail(dept)}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/10">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{dept.name}</h3>
                      {dept.code && <p className="text-xs text-muted-foreground">รหัส: {dept.code}</p>}
                      <p className="text-sm text-muted-foreground mt-1">{count} คน</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(dept.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {departments.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="p-8 text-center text-muted-foreground">
              ยังไม่มีแผนกวิชา กรุณาเพิ่มแผนก
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>เพิ่มแผนกวิชา</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>ชื่อแผนก</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="เช่น ช่างยนต์" />
            </div>
            <div>
              <Label>รหัสแผนก (ถ้ามี)</Label>
              <Input value={code} onChange={e => setCode(e.target.value)} placeholder="เช่น AUTO" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>ยกเลิก</Button>
            <Button onClick={handleAdd} disabled={!name}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedDepartment?.name || 'รายละเอียดแผนก'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {selectedDepartment?.code ? `รหัส: ${selectedDepartment.code} • ` : ''}
              รวมทั้งหมด {selectedDepartment?.totalStudents || 0} คน
            </div>

            <div className="rounded-md border overflow-hidden">
              <div className="grid grid-cols-4 bg-muted/50 px-4 py-2 text-sm font-medium">
                <div>ระดับชั้น</div>
                <div>ปี</div>
                <div>กลุ่ม</div>
                <div className="text-right">จำนวนนักศึกษา</div>
              </div>

              {selectedDepartment?.rooms?.length ? (
                selectedDepartment.rooms.map((room) => (
                  <div
                    key={`${room.level}-${room.year}-${room.group}`}
                    className="grid grid-cols-4 px-4 py-2 text-sm border-t"
                  >
                    <div>{room.level}</div>
                    <div>{room.year}</div>
                    <div>{room.group}</div>
                    <div className="text-right font-medium">{room.count} คน</div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-4 text-sm text-muted-foreground border-t text-center">
                  ยังไม่มีข้อมูลชั้นเรียนในแผนกนี้
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetail(false)}>ปิด</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}