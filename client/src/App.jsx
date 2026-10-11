import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Logo from './components/Logo.jsx';
import { ListSkeleton, Skeleton } from './components/ui.jsx';

const Login = lazy(() => import('./pages/Login.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Expenses = lazy(() => import('./pages/Expenses.jsx'));
const Subscriptions = lazy(() => import('./pages/Subscriptions.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const Categories = lazy(() => import('./pages/Categories.jsx'));
const Friends = lazy(() => import('./pages/Friends.jsx'));
const FriendDetail = lazy(() => import('./pages/FriendDetail.jsx'));
const DataSettings = lazy(() => import('./pages/DataSettings.jsx'));

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg" role="status" aria-label="Loading Finenzo">
      <div className="flex flex-col items-center gap-6">
        <Logo size="lg" />
        <div className="w-48 space-y-2">
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-2 w-2/3" />
        </div>
      </div>
    </div>
  );
}

const PageFallback = () => (
  <div className="space-y-4 pt-6" aria-busy="true">
    <Skeleton className="h-8 w-40" />
    <Skeleton className="h-40 w-full !rounded-2xl" />
    <ListSkeleton rows={3} />
  </div>
);

export default function App() {
  const { status } = useAuth();
  if (status === 'loading') return <Splash />;

  return (
    <Suspense fallback={status === 'authed' ? <PageFallback /> : <Splash />}>
      {status === 'anon' ? (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      ) : (
        <Routes>
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="subscriptions" element={<Subscriptions />} />
            <Route path="settings" element={<Settings />} />
            <Route path="settings/categories" element={<Categories />} />
            <Route path="settings/friends" element={<Friends />} />
            <Route path="settings/friends/:id" element={<FriendDetail />} />
            <Route path="settings/data" element={<DataSettings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      )}
    </Suspense>
  );
}
