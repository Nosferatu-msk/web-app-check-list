import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { Spin } from 'antd';
import SyncBanner from './components/SyncBanner';
import PWAUpdateBanner from './components/PWAUpdateBanner';
import SpecializationGate from './components/SpecializationGate';
import BottomNav from './components/BottomNav';
import { useIsMobile } from './hooks/useIsMobile';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VisitListPage from './pages/VisitListPage';
import VisitPage from './pages/VisitPage';
import TaskPage from './pages/TaskPage';
import GroupTaskPage from './pages/GroupTaskPage';
import PhotoPage from './pages/PhotoPage';
import ItemPhotoPage from './pages/ItemPhotoPage';
import ReportPage from './pages/ReportPage';
import SummaryReportPage from './pages/SummaryReportPage';
import ProfilePage from './pages/ProfilePage';
import RequestsPage from './pages/RequestsPage';
import MyRequestsPage from './pages/MyRequestsPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminAddresses from './pages/admin/AdminAddresses';
import AdminEquipment from './pages/admin/AdminEquipment';
import AdminManufacturers from './pages/admin/AdminManufacturers';
import AdminModels from './pages/admin/AdminModels';
import AdminRoomTypes from './pages/admin/AdminRoomTypes';
import AdminRecommendations from './pages/admin/AdminRecommendations';
import AdminUsers from './pages/admin/AdminUsers';
import AdminTmAssignments from './pages/admin/AdminTmAssignments';
import AdminImport from './pages/admin/AdminImport';
import AdminObjectEquipment from './pages/admin/AdminObjectEquipment';
import AdminProposals from './pages/admin/AdminProposals';
import AdminSystemNotifications from './pages/admin/AdminSystemNotifications';
import AdminAuditLog from './pages/admin/AdminAuditLog';
import MtrVisitListPage from './pages/mtr/MtrVisitListPage';
import MtrVisitPage from './pages/mtr/MtrVisitPage';
import MtrTmVisitListPage from './pages/mtr/MtrTmVisitListPage';
import MtrAdminWorkTypes from './pages/mtr/MtrAdminWorkTypes';
import MtrAdminAssignments from './pages/mtr/MtrAdminAssignments';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" />;
  return <><SyncBanner /><PWAUpdateBanner />{children}</>;
}

function EngineerMobileLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  return (
    <>
      {children}
      {isMobile && <BottomNav />}
    </>
  );
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

function EngineerRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>;
  if (user?.role !== 'engineer') return <>{children}</>;
  return <SpecializationGate><EngineerMobileLayout>{children}</EngineerMobileLayout></SpecializationGate>;
}

function EngineerMtrRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  const isMobile = useIsMobile();
  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>;
  if (user?.role !== 'engineer_mtr') return <Navigate to="/" />;
  return <>{children}{isMobile && <BottomNav />}</>;
}

function TmMtrRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>;
  if (user?.role !== 'tm_mtr' && user?.role !== 'admin') return <Navigate to="/" />;
  return <>{children}</>;
}

function SmartRedirect() {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>;
  if (user?.role === 'engineer_mtr') return <Navigate to="/mtr/visits" />;
  if (user?.role === 'tm_mtr') return <Navigate to="/mtr/tm/visits" />;
  return <Navigate to="/" />;
}

export default function App() {
  const { checkAuth } = useAuthStore();

  useEffect(() => { checkAuth(); }, []);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/" element={<ProtectedRoute><EngineerRoute><VisitListPage /></EngineerRoute></ProtectedRoute>} />
      <Route path="/my-requests" element={<ProtectedRoute><EngineerRoute><MyRequestsPage /></EngineerRoute></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/visit/new" element={<ProtectedRoute><EngineerRoute><VisitPage /></EngineerRoute></ProtectedRoute>} />
      <Route path="/visit/:id" element={<ProtectedRoute><EngineerRoute><VisitPage /></EngineerRoute></ProtectedRoute>} />
      <Route path="/visit/:visitId/task/:taskId" element={<ProtectedRoute><EngineerRoute><TaskPage /></EngineerRoute></ProtectedRoute>} />
      <Route path="/visit/:visitId/task/:taskId/group" element={<ProtectedRoute><EngineerRoute><GroupTaskPage /></EngineerRoute></ProtectedRoute>} />
      <Route path="/visit/:visitId/task/:taskId/photos" element={<ProtectedRoute><EngineerRoute><PhotoPage /></EngineerRoute></ProtectedRoute>} />
      <Route path="/visit/:visitId/task/:taskId/item/:itemId/photos" element={<ProtectedRoute><EngineerRoute><ItemPhotoPage /></EngineerRoute></ProtectedRoute>} />
      <Route path="/visit/:id/report" element={<ProtectedRoute><EngineerRoute><ReportPage /></EngineerRoute></ProtectedRoute>} />
      <Route path="/reports/summary" element={<TmAdminRoute><ProtectedRoute><SummaryReportPage /></ProtectedRoute></TmAdminRoute>} />
      <Route path="/requests" element={<TmAdminRoute><ProtectedRoute><RequestsPage /></ProtectedRoute></TmAdminRoute>} />
      <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route index element={<Navigate to="/admin/addresses" />} />
        <Route path="addresses" element={<AdminAddresses />} />
        <Route path="equipment" element={<AdminEquipment />} />
        <Route path="manufacturers" element={<AdminManufacturers />} />
        <Route path="models" element={<AdminModels />} />
        <Route path="rooms" element={<AdminRoomTypes />} />
        <Route path="recommendations" element={<AdminRecommendations />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="tm-assignments" element={<AdminTmAssignments />} />
        <Route path="import" element={<AdminImport />} />
        <Route path="object-equipment" element={<AdminObjectEquipment />} />
        <Route path="proposals" element={<AdminProposals />} />
        <Route path="system-notifications" element={<AdminSystemNotifications />} />
        <Route path="audit" element={<AdminAuditLog />} />
        <Route path="mtr-work-types" element={<MtrAdminWorkTypes />} />
        <Route path="mtr-assignments" element={<MtrAdminAssignments />} />
      </Route>
      {/* MTR routes */}
      <Route path="/mtr/visits" element={<ProtectedRoute><EngineerMtrRoute><MtrVisitListPage /></EngineerMtrRoute></ProtectedRoute>} />
      <Route path="/mtr/visits/new" element={<ProtectedRoute><EngineerMtrRoute><MtrVisitPage /></EngineerMtrRoute></ProtectedRoute>} />
      <Route path="/mtr/visits/:id" element={<ProtectedRoute><EngineerMtrRoute><MtrVisitPage /></EngineerMtrRoute></ProtectedRoute>} />
      <Route path="/mtr/tm/visits" element={<ProtectedRoute><TmMtrRoute><MtrTmVisitListPage /></TmMtrRoute></ProtectedRoute>} />
      <Route path="*" element={<ProtectedRoute><SmartRedirect /></ProtectedRoute>} />
    </Routes>
  );
}
