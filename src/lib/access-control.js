import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const PROFILE_FLAGS = {
  attendance_only: {
    canTakeAttendance: false,
    canEditData: false,
    canViewReports: true,
    canManageUsers: false,
  },
  editor: {
    canTakeAttendance: true,
    canEditData: true,
    canViewReports: true,
    canManageUsers: false,
  },
};

export function getPermissionMap(permissionItems = []) {
  return permissionItems.reduce((acc, item) => {
    const key = (item?.email || '').trim();
    if (key && item?.profile) {
      acc[key] = item.profile;
    }
    return acc;
  }, {});
}

export function getUserPermissions(user, permissionItems = []) {
  if (user?.role === 'admin') {
    return {
      profile: 'admin',
      canTakeAttendance: true,
      canEditData: true,
      canViewReports: true,
      canManageUsers: true,
    };
  }

  const email = user?.email;
  const map = getPermissionMap(permissionItems);
  const profile = map[email] || 'attendance_only';
  const flags = PROFILE_FLAGS[profile] || PROFILE_FLAGS.attendance_only;

  return {
    profile,
    ...flags,
  };
}

export function useUserPermissions(user) {
  const { data: permissionItems = [], isLoading } = useQuery({
    queryKey: ['user-permissions'],
    queryFn: () => base44.entities.UserPermission.list('-created_date', 1000),
  });

  const permissions = useMemo(
    () => getUserPermissions(user, permissionItems),
    [user, permissionItems]
  );

  return {
    ...permissions,
    isLoadingPermissions: isLoading,
    permissionItems,
  };
}

export async function upsertUserProfile(email, profile, permissionItems = []) {
  if (!email || !profile) return;
  const normalizedEmail = email.trim();
  const existing = permissionItems.find((item) => (item?.email || '').trim() === normalizedEmail);

  if (existing) {
    await base44.entities.UserPermission.update(existing.id, { profile });
    return;
  }

  await base44.entities.UserPermission.create({
    email: normalizedEmail,
    profile,
  });
}

export async function resetUserProfile(email, permissionItems = []) {
  if (!email) return;
  const normalizedEmail = email.trim();
  const existing = permissionItems.find((item) => (item?.email || '').trim() === normalizedEmail);
  if (existing) {
    await base44.entities.UserPermission.delete(existing.id);
  }
}

export function getKnownUserEmails({ students = [], currentUser = null, permissionItems = [] } = {}) {
  const fromStudents = students.map((s) => (s?.advisor_email || '').trim()).filter(Boolean);
  const fromCurrent = currentUser?.email ? [currentUser.email.trim()] : [];
  const fromPolicies = permissionItems.map((item) => (item?.email || '').trim()).filter(Boolean);
  return [...new Set([...fromCurrent, ...fromStudents, ...fromPolicies])].sort((a, b) => a.localeCompare(b));
}
