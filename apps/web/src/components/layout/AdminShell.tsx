import React from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';
import { AppShell } from './AppShell';
import { Button } from '@/components/ui/button';

interface AdminShellProps {
  title: string;
  description?: string;
  breadcrumb?: string | Array<{ label: string; href?: string }>;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export const AdminShell: React.FC<AdminShellProps> = ({
  title,
  description = 'Manage gym tenants, platform users, and global system configuration.',
  breadcrumb,
  actions,
  children,
}) => {
  const crumbs = breadcrumb
    ? Array.isArray(breadcrumb)
      ? breadcrumb
      : [{ label: breadcrumb }]
    : [
        { label: 'Platform Console', href: '/admin' },
        { label: title },
      ];

  const headerActions = (
    <>
      <Button
        variant="outline"
        size="sm"
        asChild
        className="hidden sm:inline-flex gap-1.5 text-xs font-medium border-border hover:bg-secondary shadow-2xs h-8"
      >
        <Link to="/dashboard">
          <LayoutDashboard className="size-3.5 text-primary" />
          <span>Gym Console</span>
        </Link>
      </Button>
      {actions}
    </>
  );

  return (
    <AppShell
      title={title}
      description={description}
      breadcrumb={crumbs}
      actions={headerActions}
    >
      {children}
    </AppShell>
  );
};

