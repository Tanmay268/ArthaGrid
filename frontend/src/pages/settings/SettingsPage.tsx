import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Spinner, ErrorState } from '@/components/ui/state';
import { useAuthStore } from '@/store/authStore';
import { useMe, useUpdateMe } from '@/api/users';
import { ApiError } from '@/lib/api';

export function SettingsPage() {
  const me = useMe();
  const updateMe = useUpdateMe();
  const setSession = useAuthStore((s) => s.setSession);
  const accessToken = useAuthStore((s) => s.accessToken);

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (me.data) setName(me.data.name);
  }, [me.data]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    const payload: { name?: string; password?: string } = {};
    if (name && name !== me.data?.name) payload.name = name;
    if (password) payload.password = password;
    if (Object.keys(payload).length === 0) return;

    updateMe.mutate(payload, {
      onSuccess: (res) => {
        setPassword('');
        setSaved(true);
        if (accessToken) setSession(res.data, accessToken); // keep the store's user in sync (e.g. sidebar name)
      },
    });
  };

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Your profile</CardTitle>
        </CardHeader>
        <CardContent>
          {me.isLoading && <Spinner />}
          {me.isError && <ErrorState message="Couldn't load your profile." />}
          {me.data && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={me.data.email} disabled />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="role">Role</Label>
                <Input id="role" value={me.data.role} disabled className="capitalize" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave blank to keep your current password"
                />
              </div>

              {updateMe.isError && (
                <p className="text-sm text-destructive">
                  {updateMe.error instanceof ApiError ? updateMe.error.message : 'Something went wrong.'}
                </p>
              )}
              {saved && !updateMe.isError && <p className="text-sm text-success">Saved.</p>}

              <Button type="submit" disabled={updateMe.isPending}>
                {updateMe.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
