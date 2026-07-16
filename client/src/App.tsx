import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { Spin } from 'antd';
import SyncBanner from './components/SyncBanner';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VisitListPage from './pages/VisitListPage';
import VisitPage from './pages/VisitPage';
import TaskPage from './pages/TaskPage';
import PhotoPage from './pages/PhotoPage';
import ReportPage from './pages/ReportPage';
import SummaryReportPage from './pages/SummaryReportPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminAddresses from './pages/admin/AdminAddresses';
import AdminEquipment from './pages/admin/AdminEquipment';
import AdminRoomTypes from './pages/admin/AdminRoomTypes';
import AdminRecommendations from './pages/admin/AdminRecommendations';
import AdminUsers from './pages/admin/AdminUsers';
import AdminTmAssignments from './pages/admin/AdminTmAssignments';
import AdminImport from './pages/admin/AdminImport';
import AdminObjectEquipment from './pages/admin/AdminObjectEquipment';
import AdminProposals from './pages/admin/AdminProposals';
import AdminAuditLog from './pages/admin/AdminAuditLog';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" />;
  return <><SyncBanner />{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>;
  if (user?.role !== 'admin') return <Navigate to="/" />;
  return <>{children}</>;
}

function TmAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>;
  if (user?.role !== 'admin' && user?.role !== 'tm') return <Navigate to="/" />;
  return <>{children}</>;
}

export default function App() {
  const { checkAuth } = useAuthStore();

  useEffect(() => { checkAuth(); }, []);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/" element={<ProtectedRoute><VisitListPage /></ProtectedRoute>} />
      <Route path="/visit/new" element={<ProtectedRoute><VisitPage /></ProtectedRoute>} />
      <Route path="/visit/:id" element={<ProtectedRoute><VisitPage /></ProtectedRoute>} />
      <Route path="/visit/:visitId/task/:taskId" element={<ProtectedRoute><TaskPage /></ProtectedRoute>} />
      <Route path="/visit/:visitId/task/:taskId/photos" element={<ProtectedRoute><PhotoPage /></ProtectedRoute>} />
      <Route path="/visit/:id/report" element={<ProtectedRoute><ReportPage /></ProtectedRoute>} />
      <Route path="/reports/summary" element={<TmAdminRoute><ProtectedRoute><SummaryReportPage /></ProtectedRoute></TmAdminRoute>} />
      <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route index element={<Navigate to="/admin/addresses" />} />
        <Route path="addresses" element={<AdminAddresses />} />
        <Route path="equipment" element={<AdminEquipment />} />
        <Route path="rooms" element={<AdminRoomTypes />} />
        <Route path="recommendations" element={<AdminRecommendations />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="tm-assignments" element={<AdminTmAssignments />} />
        <Route path="import" element={<AdminImport />} />
        <Route path="object-equipment" element={<AdminObjectEquipment />} />
        <Route path="proposals" element={<AdminProposals />} />
        <Route path="audit" element={<AdminAuditLog />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
