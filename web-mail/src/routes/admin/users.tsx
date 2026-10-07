import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LockIcon, UsersIcon } from 'lucide-react';
import { CopyButton } from '@/components/copy-button';
import { IconTip } from '@/components/page-header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, type UserFlags } from '@/lib/api';
import { fullDate, initials, relativeTime } from '@/lib/format';
import { adminUsersQuery, useMe } from '@/lib/queries';
import { AdminPage } from './page';

const FLAGS: { key: keyof UserFlags; label: string; help: string }[] = [
  { key: 'isAdmin', label: 'Admin', help: 'Full access, including this admin area' },
  { key: 'canCreate', label: 'Create', help: 'Can create aliases and delete their own' },
  { key: 'seeAll', label: 'See all', help: 'Can read every alias and message' },
];

const ADMIN_PANEL = `https://admin.${location.hostname.split('.').slice(-2).join('.')}`;

export default function Users() {
  const me = useMe();
  const qc = useQueryClient();
  const users = useQuery(adminUsersQuery);

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<UserFlags> }) => api.admin.updateUser(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: adminUsersQuery.queryKey });
      qc.setQueryData(adminUsersQuery.queryKey, (d) => d && { users: d.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: adminUsersQuery.queryKey });
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
  return (
    <AdminPage
      title="Users"
      subtitle="What each person can do in Mail. To add or remove people, use the admin panel."
      actions={
        <Button size="sm" asChild>
          <a href={ADMIN_PANEL}>
            <UsersIcon />
            <span className="hidden sm:inline">Manage users</span>
            <span className="sr-only sm:hidden">Manage users in the admin panel</span>
          </a>
        </Button>
      }
    >
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-3 sm:pl-4">User</TableHead>
              {FLAGS.map((f) => (
                <TableHead key={f.key} className="px-1 text-center sm:px-2">
                  <IconTip label={f.help}>
                    <button
                      type="button"
                      className="cursor-help rounded-sm underline decoration-dotted underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {f.label}
                    </button>
                  </IconTip>
                  <span id={`flag-help-${f.key}`} className="sr-only">
                    {f.help}
                  </span>
                </TableHead>
              ))}
              <TableHead className="hidden text-right md:table-cell">Aliases</TableHead>
              <TableHead className="hidden md:table-cell">Last login</TableHead>
              <TableHead className="w-10 pr-2 sm:pr-4">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.isPending &&
              Array.from({ length: 3 }, (_, i) => (
                <TableRow key={i}>
                  <TableCell className="pl-4" colSpan={7}>
                    <Skeleton className="h-8" />
                  </TableCell>
                </TableRow>
              ))}
            {users.isError && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-destructive">
                  Couldn't load users: {users.error.message}
                </TableCell>
              </TableRow>
            )}
            {users.data?.map((u) => {
              const name = u.name ?? 'Unnamed';
              const self = u.id === me.id;
              return (
                <TableRow key={u.id}>
                  <TableCell className="pl-3 sm:pl-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="hidden sm:flex">
                        {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt="" />}
                        <AvatarFallback>{initials(name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-medium">
                          <span className="max-w-28 truncate sm:max-w-44">{name}</span>
                          {self && <Badge variant="secondary">You</Badge>}
                          {u.permanentAdmin && (
                            <IconTip label="Permanent admin (set in ADMIN_IDS)">
                              <LockIcon className="size-3.5 text-muted-foreground" aria-label="Permanent admin" />
                            </IconTip>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 font-mono text-xs text-muted-foreground">
                          {u.id}
                          <span className="hidden sm:contents">
                            <CopyButton value={u.id} label="Copy Discord ID" size="icon-sm" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  {FLAGS.map((f) => {
                    const locked = f.key === 'isAdmin' && (u.permanentAdmin || self);
                    // Admin implies create + see all; show that rather than the dormant stored flag.
                    const implied = f.key !== 'isAdmin' && u.isAdmin;
                    return (
                      <TableCell key={f.key} className="px-1 text-center sm:px-2">
                        <Switch
                          checked={implied || u[f.key]}
                          disabled={locked || implied}
                          onCheckedChange={(v) => update.mutate({ id: u.id, patch: { [f.key]: v } })}
                          aria-label={`${f.label} for ${name}`}
                          aria-describedby={`flag-help-${f.key}`}
                          title={
                            implied
                              ? 'Included with admin'
                              : locked
                                ? u.permanentAdmin
                                  ? 'Permanent admin'
                                  : "You can't remove your own admin access"
                                : undefined
                          }
                        />
                      </TableCell>
                    );
                  })}
                  <TableCell className="hidden text-right tabular-nums md:table-cell">{u.aliasCount}</TableCell>
                  <TableCell className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                    {u.lastLoginAt ? (
                      <time dateTime={new Date(u.lastLoginAt).toISOString()} title={fullDate(u.lastLoginAt)}>
                        {relativeTime(u.lastLoginAt)}
                      </time>
                    ) : (
                      'Never'
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </AdminPage>
  );
}
