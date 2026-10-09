import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';

export const DEMO_BLOCKED_MESSAGE = 'This action is not allowed for demo accounts.';

// Wraps a write action: demo accounts get the message the moment they click,
// everyone else runs it. The server enforces the same rule (authenticate.js),
// so this is just the friendlier, earlier half.
export function useDemoGuard() {
  const isDemo = useAuthStore((s) => Boolean(s.user?.isDemo));
  return <Args extends unknown[]>(action: (...args: Args) => void) =>
    (...args: Args) => {
      if (isDemo) {
        toast.info(DEMO_BLOCKED_MESSAGE);
        return;
      }
      action(...args);
    };
}
