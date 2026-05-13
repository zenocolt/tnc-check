import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import AttendanceCheck from './pages/AttendanceCheck';
import Reports from './pages/Reports';
import Students from './pages/Students';
import StudentByRoom from './pages/StudentByRoom';
import Departments from './pages/Departments';
import SchoolCalendar from './pages/SchoolCalendar';
import UserPermissions from './pages/UserPermissions';
import Login from './pages/Login';
import ClassLinks from './pages/Classlinks';
import ClassReport from './pages/ClassReport';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
  }

  const needsLogin = authError?.type === 'auth_required' || !isAuthenticated;

  if (needsLogin) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/class-report/:department/:level/:year/:group" element={<ClassReport />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/class-report/:department/:level/:year/:group" element={<ClassReport />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/attendance" element={<AttendanceCheck />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/students" element={<Students />} />
        <Route path="/student-rooms" element={<StudentByRoom />} />
        <Route path="/classlinks" element={<ClassLinks />} />
        <Route path="/departments" element={<Departments />} />
        <Route path="/calendar" element={<SchoolCalendar />} />
        <Route path="/user-permissions" element={<UserPermissions />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App