import React from 'react';
import { AppShell } from './AppShell';

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

  const headerActions = actions ? <>{actions}</> : null;

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

