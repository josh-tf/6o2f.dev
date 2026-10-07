import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Outlet, useLocation } from 'react-router';
import { AppSidebar } from '@/components/app-sidebar';
import { Button } from '@/components/ui/button';
import { SidebarInset, SidebarProvider, useSidebar } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, logout, toLogin } from '@/lib/api';
import { meQuery } from '@/lib/queries';

function CloseMobileOnNavigate() {
  const { pathname } = useLocation();
  const { setOpenMobile } = useSidebar();
  useEffect(() => setOpenMobile(false), [pathname, setOpenMobile]);
  return null;
}

export function AppShell() {
  const me = useQuery(meQuery);

  if (me.isPending) {
    return (
      <div className="flex h-svh" aria-busy="true" aria-label="Loading">
        <div className="hidden w-64 shrink-0 flex-col gap-3 border-r bg-sidebar p-3 md:flex">
          <Skeleton className="h-10" />
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
        <div className="flex-1 space-y-3 p-4">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </div>
    );
  }
  if (me.error) {
    if (me.error instanceof ApiError && me.error.status === 401) {
      toLogin();
      return null;
    }
    if (me.error instanceof ApiError && me.error.status === 403) {
      return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-3 p-4 text-center">
          <p role="alert" className="max-w-md text-sm">
            {me.error.message}
          </p>
          <Button variant="outline" onClick={() => void logout()}>
            Sign out
          </Button>
        </div>
      );
    }
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 p-4 text-center">
        <p className="text-sm text-muted-foreground">Couldn't reach the server.</p>
        <Button variant="outline" onClick={() => void me.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <SidebarProvider className="h-svh">
      <CloseMobileOnNavigate />
      <AppSidebar />
      <SidebarInset className="min-w-0 overflow-hidden">
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
