import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, ShieldCheck, Plus, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import {
  getKnownUserEmails,
  getPermissionMap,
  resetUserProfile,
  upsertUserProfile,
  useUserPermissions,
} from '@/lib/access-control';

const PROFILE_LABEL = {
  attendance_only: 'ดูรายงานได้เท่านั้น',
  editor: 'แก้ไขข้อมูลได้ + บันทึกเช็คชื่อ',
};

export default function UserPermissions() {
  const { user } = useOutletContext();
  const permissions = useUserPermissions(user);
  const queryClient = useQueryClient();
  const [newEmail, setNewEmail] = useState('');
  const [newProfile, setNewProfile] = useState('attendance_only');

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => base44.entities.Student.list('-created_date', 10000),
  });

  const { data: permissionItems = [] } = useQuery({
    queryKey: ['user-permissions'],
    queryFn: () => base44.entities.UserPermission.list('-created_date', 1000),
  });

  const emails = useMemo(
    () => getKnownUserEmails({ students, currentUser: user, permissionItems }),
    [students, user, permissionItems]
  );

  if (!permissions.canManageUsers) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          คุณไม่มีสิทธิ์เข้าหน้านี้
        </CardContent>
      </Card>
    );
  }

  const map = getPermissionMap(permissionItems);

  const handleChange = async (email, profile) => {
    await upsertUserProfile(email, profile, permissionItems);
    queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
    toast({ title: 'บันทึกสิทธิ์สำเร็จ', description: `${email} => ${PROFILE_LABEL[profile]}` });
  };

  const handleReset = async (email) => {
    await resetUserProfile(email, permissionItems);
    queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
    toast({ title: 'ล้างสิทธิ์พิเศษแล้ว', description: `${email} จะใช้สิทธิ์เริ่มต้น` });
  };

  const handleAddUser = async () => {
    if (!newEmail.trim()) {
      toast({ title: 'ข้อผิดพลาด', description: 'กรุณาใส่อีเมล', variant: 'destructive' });
      return;
    }

    try {
      await upsertUserProfile(newEmail.trim(), newProfile, permissionItems);
      queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
      setNewEmail('');
      setNewProfile('attendance_only');
      toast({ title: 'เพิ่มผู้ใช้สำเร็จ', description: `${newEmail.trim()} => ${PROFILE_LABEL[newProfile]}` });
    } catch (error) {
      toast({ title: 'ข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteUser = async (email) => {
    try {
      await resetUserProfile(email, permissionItems);
      queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
      toast({ title: 'ลบผู้ใช้สำเร็จ', description: `${email} ถูกลบออกจากระบบ` });
    } catch (error) {
      toast({ title: 'ข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">ผู้ใช้และสิทธิ</h1>
        <p className="text-muted-foreground">กำหนดสิทธิ์ว่าใครแก้ไขข้อมูลได้ หรือดูรายงานได้อย่างเดียว</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ระดับสิทธิ์</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2"><Shield className="w-4 h-4" /> attendance_only = ดูรายงานได้เท่านั้น</div>
          <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> editor = เข้า/แก้ข้อมูลนักเรียน แผนก ปฏิทิน และระบบนักเรียน</div>
          <div className="text-muted-foreground">หมายเหตุ: ผู้ใช้ role admin จากระบบ มีสิทธิ์เต็มเสมอ</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">เพิ่มผู้ใช้ใหม่</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-2">
            <Input
              placeholder="อีเมล"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleAddUser()}
            />
            <Select value={newProfile} onValueChange={setNewProfile}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="attendance_only">{PROFILE_LABEL.attendance_only}</SelectItem>
                <SelectItem value="editor">{PROFILE_LABEL.editor}</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAddUser} className="gap-2">
              <Plus className="w-4 h-4" /> เพิ่ม
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">รายการผู้ใช้</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {emails.map((email) => {
              const current = map[email] || 'attendance_only';
              const isSelf = email === user?.email;
              const isAdminUser = isSelf && user?.role === 'admin';

              return (
                <div key={email} className="flex flex-col md:flex-row md:items-center gap-2 p-3 rounded-lg border">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{email}</p>
                    {isAdminUser ? (
                      <Badge variant="secondary" className="mt-1">admin (สิทธิ์เต็ม)</Badge>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">{PROFILE_LABEL[current]}</p>
                    )}
                  </div>

                  {!isAdminUser && (
                    <div className="flex gap-2">
                      <Select value={current} onValueChange={(value) => handleChange(email, value)}>
                        <SelectTrigger className="w-64">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="attendance_only">{PROFILE_LABEL.attendance_only}</SelectItem>
                          <SelectItem value="editor">{PROFILE_LABEL.editor}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="outline" onClick={() => handleReset(email)}>รีเซ็ต</Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDeleteUser(email)}
                        title="ลบผู้ใช้"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}

            {emails.length === 0 && (
              <p className="text-center text-muted-foreground py-6">ยังไม่พบผู้ใช้ในระบบ</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
