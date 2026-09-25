import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { CardSkeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/state';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore, type Theme } from '@/store/themeStore';
import { toast } from '@/store/toastStore';
import { useMe, useUpdateMe } from '@/api/users';
import { cn, errorMessage } from '@/lib/utils';

const THEMES: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function SettingsPage() {
  const me = useMe();
  const updateMe = useUpdateMe();
  const setSession = useAuthStore((s) => s.setSession);
  const accessToken = useAuthStore((s) => s.accessToken);
  const { theme, setTheme } = useThemeStore();

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (me.data) setName(me.data.name);
  }, [me.data]);

  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: { name?: string; password?: string } = {};
    if (name && name !== me.data?.name) payload.name = name;
    if (password) payload.password = password;
    if (Object.keys(payload).length === 0) {
      toast.info('Nothing to save — no changes yet.');
      return;
    }

    updateMe.mutate(payload, {
      onSuccess: (res) => {
        setPassword('');
        toast.success('Profile saved');
        if (accessToken) setSession({ ...res.data, id: (res.data as { _id?: string })._id ?? res.data.id }, accessToken);
        me.refetch();
      },
      onError: (err) => toast.error(errorMessage(err)),
    });
  };

  const weeklyReport = me.data?.preferences?.weeklyReport ?? false;
  const toggleReport = () => {
    updateMe.mutate(
      { weeklyReport: !weeklyReport },
      {
        onSuccess: () => {
          toast.success(!weeklyReport ? 'Weekly report turned on' : 'Weekly report turned off');
          me.refetch();
        },
        onError: (err) => toast.error(errorMessage(err)),
      }
    );
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageHeader title="Settings" description="Your profile, appearance, and notifications." />

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme">
            {THEMES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                role="radio"
                aria-checked={theme === value}
                onClick={() => setTheme(value)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-lg border border-border p-3 text-sm font-medium transition-colors hover:bg-muted',
                  theme === value && 'border-primary bg-muted'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          {me.isLoading && <CardSkeleton lines={4} />}
          {me.isError && <ErrorState message="Couldn't load your profile." onRetry={() => me.refetch()} />}
          {me.data && (
            <form onSubmit={saveProfile} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={me.data.email} disabled />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="role">Role</Label>
                  <Input id="role" value={me.data.role} disabled className="capitalize" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Leave blank to keep your current password"
                />
                <p className="text-xs text-muted-foreground">At least 8 characters, with upper and lower case letters and a number.</p>
              </div>
              <Button type="submit" disabled={updateMe.isPending} className="w-full sm:w-auto sm:self-end">
                {updateMe.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          {me.data && (
            <div className="flex items-start justify-between gap-4">
              <div className="text-sm">
                <p className="font-medium">Weekly email report</p>
                <p className="mt-0.5 text-muted-foreground">
                  A short summary every Sunday morning: income, expenses, savings, your top category, and budget status. Contains totals only — never transaction details.
                </p>
              </div>
              <button
                role="switch"
                aria-checked={weeklyReport}
                aria-label="Weekly email report"
                onClick={toggleReport}
                disabled={updateMe.isPending}
                className={cn(
                  'relative mt-0.5 h-6 w-11 shrink-0 rounded-full border border-border transition-colors disabled:opacity-60',
                  weeklyReport ? 'bg-success' : 'bg-muted'
                )}
              >
                <span className={cn('absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-all', weeklyReport ? 'left-[22px]' : 'left-0.5')} />
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
