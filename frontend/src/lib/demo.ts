import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';

export function useIsDemo() {
  return useAuthStore((s) => Boolean(s.user?.isDemo));
}

// Wraps an action that is restricted on demo accounts: demo users get a clear
// "restricted feature" message the moment they click, everyone else runs it.
// The server enforces the same rule (config/demoRestrictions.js), so this is
// just the friendlier, earlier half.
export function useDemoGuard() {
  const isDemo = useIsDemo();
  return <Args extends unknown[]>(feature: string, action: (...args: Args) => void) =>
    (...args: Args) => {
      if (isDemo) {
        toast.info(`${feature} is a restricted feature on demo accounts.`);
        return;
      }
      action(...args);
    };
}
