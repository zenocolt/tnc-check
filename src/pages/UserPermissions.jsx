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
  attendance_taker: 'บันทึกเช็คชื่ออย่างเดียว',
  editor: 'แก้ไขข้อมูลได้ + บันทึกเช็คชื่อ',
};

export default function UserPermissions() {
  const { user } = useOutletContext();
  const permissions = useUserPermissions(user);
  const queryClient = useQueryClient();
  const [newFullName, setNewFullName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
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

  const permissionByEmail = useMemo(() => {
    return permissionItems.reduce((acc, item) => {
      const key = String(item?.email || '').trim();
      if (key) acc[key] = item;
      return acc;
    }, {});
  }, [permissionItems]);

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
    const normalizedFullName = newFullName.trim();
    const normalizedUsername = newUsername.trim().toLowerCase();
    const email = normalizedUsername ? `${normalizedUsername}@local` : '';

    if (!normalizedFullName) {
      toast({ title: 'ข้อผิดพลาด', description: 'กรุณาใส่ชื่อผู้ใช้', variant: 'destructive' });
      return;
    }

    if (!normalizedUsername) {
      toast({ title: 'ข้อผิดพลาด', description: 'กรุณาใส่รหัสผู้ใช้', variant: 'destructive' });
      return;
    }

    if (!newPassword) {
      toast({ title: 'ข้อผิดพลาด', description: 'กรุณาใส่รหัสผ่าน', variant: 'destructive' });
      return;
    }

    const duplicatedUsername = permissionItems.some(
      (item) => String(item?.username || '').trim().toLowerCase() === normalizedUsername
    );
    if (duplicatedUsername) {
      toast({ title: 'ข้อผิดพลาด', description: 'รหัสผู้ใช้นี้มีในระบบแล้ว', variant: 'destructive' });
      return;
    }

    try {
      await upsertUserProfile(email, newProfile, permissionItems, {
        full_name: normalizedFullName,
        username: normalizedUsername,
        password: newPassword,
      });
      queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
      setNewFullName('');
      setNewUsername('');
      setNewPassword('');
      setNewProfile('attendance_only');
      toast({ title: 'เพิ่มผู้ใช้สำเร็จ', description: `${normalizedUsername} => ${PROFILE_LABEL[newProfile]}` });
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
          <div className="flex items-center gap-2"><Shield className="w-4 h-4" /> attendance_taker = บันทึกเช็คชื่ออย่างเดียว</div>
          <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> editor = เข้า/แก้ข้อมูลนักเรียน แผนก ปฏิทิน และระบบนักเรียน</div>
          <div className="text-muted-foreground">หมายเหตุ: ผู้ใช้ role admin จากระบบ มีสิทธิ์เต็มเสมอ</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">เพิ่มผู้ใช้ใหม่</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <Input
              placeholder="ชื่อ-นามสกุล (แสดงผล)"
              value={newFullName}
              onChange={(e) => setNewFullName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddUser()}
            />
            <Input
              placeholder="ชื่อเข้าใช้ (Login)"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddUser()}
            />
            <Input
              type="password"
              placeholder="รหัสผ่าน"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddUser()}
            />
            <Select value={newProfile} onValueChange={setNewProfile}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="attendance_only">{PROFILE_LABEL.attendance_only}</SelectItem>
                <SelectItem value="attendance_taker">{PROFILE_LABEL.attendance_taker}</SelectItem>
                <SelectItem value="editor">{PROFILE_LABEL.editor}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-2 flex justify-end">
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
              const accountInfo = permissionByEmail[email];
              const displayName = String(accountInfo?.full_name || '').trim();
              const displayUsername = String(accountInfo?.username || '').trim();

              return (
                <div key={email} className="flex flex-col md:flex-row md:items-center gap-2 p-3 rounded-lg border">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{displayName || email}</p>
                    {displayUsername && (
                      <p className="text-xs text-muted-foreground mt-0.5">ชื่อเข้าใช้: {displayUsername}</p>
                    )}
                    {isAdminUser ? (
                      <Badge variant="secondary" className="mt-1">admin (สิทธิ์เต็ม)</Badge>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">{PROFILE_LABEL[current]} {displayUsername ? '' : `(${email})`}</p>
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
                          <SelectItem value="attendance_taker">{PROFILE_LABEL.attendance_taker}</SelectItem>
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
