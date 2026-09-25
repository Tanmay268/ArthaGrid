import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Spinner } from '@/components/ui/state';
import type { Role } from '@/types/api';

// Guards a whole route subtree behind a valid session, and optionally a
// minimum set of roles (e.g. Analytics is analyst/admin only, matching the
// API's own `read:analytics` permission).
export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { status, user } = useAuthStore();
  const location = useLocation();

  if (status === 'checking') {
    return <Spinner label="Checking your session…" />;
  }

  if (status === 'unauthenticated' || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="mx-auto max-w-md rounded-md border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Your role ({user.role}) doesn't have access to this page.
      </div>
    );
  }

  return <Outlet />;
}
