import { useEffect } from 'react';
import { API_BASE_URL } from '@/lib/api';

// The interactive Swagger UI is served by the API itself (at /api-docs on the
// backend's domain). This route means /api-docs works on the frontend's
// domain too — same address people remember, forwarded to where the docs live.
export function ApiDocsRedirect() {
  useEffect(() => {
    window.location.replace(`${API_BASE_URL}/api-docs/`);
  }, []);

  return <p className="p-6 text-sm text-muted-foreground">Opening the API docs…</p>;
}
