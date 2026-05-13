import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, ClipboardCheck, FileText, Users, Calendar, 
  Building2, Menu, X, LogOut, ChevronRight, Link2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useUserPermissions } from '@/lib/access-control';
import { useAuth } from '@/lib/AuthContext';

const navItems = [
  { path: '/', label: 'แดชบอร์ด', icon: LayoutDashboard },
  { path: '/attendance', label: 'บันทึกการเข้าแถว', icon: ClipboardCheck },
  { path: '/reports', label: 'รายงานผล', icon: FileText, requireReports: true },
  { path: '/students', label: 'จัดการนักศึกษา', icon: Users, requireEditData: true },
  { path: '/student-rooms', label: 'ระบบนักเรียน', icon: Users, requireEditData: true },
  { path: '/classlinks', label: 'ลิงก์ห้องเรียน', icon: Link2, requireEditData: true },
  { path: '/departments', label: 'แผนกวิชา', icon: Building2, requireEditData: true },
  { path: '/calendar', label: 'ปฏิทินการศึกษา', icon: Calendar, requireEditData: true },
  { path: '/user-permissions', label: 'ผู้ใช้และสิทธิ', icon: Users, requireManageUsers: true },
];

export default function Sidebar({ user }) {
  const [open, setOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const location = useLocation();
  const isAdmin = user?.role === 'admin';
  const permissions = useUserPermissions(user);
  const { logout } = useAuth();

  const filteredNav = navItems.filter((item) => {
    if (item.requireReports && !permissions.canViewReports) return false;
    if (item.requireEditData && !permissions.canEditData) return false;
    if (item.requireManageUsers && !permissions.canManageUsers) return false;
    return true;
  });

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-primary text-primary-foreground p-2 rounded-lg shadow-lg"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Overlay */}
      {open && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 lg:hidden" 
          onClick={() => setOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 h-full w-64 bg-sidebar text-sidebar-foreground z-50 flex flex-col transition-transform duration-300",
        "lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Header */}
        <div className="p-5 border-b border-sidebar-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {!logoError ? (
                <img 
                  src="https://tnc-check01.gt.tc/img/logo.png" 
                  alt="logo" 
                  className="w-10 h-10 object-contain rounded-xl"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                  <span className="text-secondary-foreground font-bold text-lg">จ</span>
                </div>
              )}
              <div>
                <h1 className="font-bold text-sm leading-tight">วิทยาลัยเทคนิคจันทบุรี</h1>
                <p className="text-xs opacity-80">งานกิจกรรมนักเรียน นักศึกษา</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="lg:hidden">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {filteredNav.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  active 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {active && <ChevronRight className="w-4 h-4 opacity-60" />}
              </Link>
            );
          })}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
              <span className="text-xs font-bold">{user?.full_name?.[0] || 'U'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.full_name || 'ผู้ใช้'}</p>
              <p className="text-xs opacity-70">{isAdmin ? 'ผู้ช่วยงาน' : 'ครูที่ปรึกษา'}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
            onClick={() => logout(true)}
          >
            <LogOut className="w-4 h-4 mr-2" />
            ออกจากระบบ
          </Button>
        </div>
      </aside>
    </>
  );
}