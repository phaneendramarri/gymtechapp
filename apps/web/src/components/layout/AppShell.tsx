import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface AppShellProps {
  /** Page title (large, prominent in the header). */
  title: string;
  /** Optional breadcrumb above the title. String is treated as a single label. */
  breadcrumb?: string | BreadcrumbItem[];
  /** Optional secondary text under the title. */
  description?: string;
  /** Right-aligned actions (buttons, tabs, etc.) shown in the page header. */
  actions?: React.ReactNode;
  /** Optional full-bleed content (skips the padded container). */
  flush?: boolean;
  children: React.ReactNode;
}

/**
 * The GymTech OS shell.
 *
 * Layout:
 *  - Left rail (60px collapsed / 220px expanded) with primary nav
 *  - Top bar: search + gym switcher + user menu
 *  - Page header: eyebrow / title / description / actions
 *  - Body: max-w-7xl, generous padding
 *
 * No card-stack. Whitespace and a single hairline do the work.
 */
export const AppShell: React.FC<AppShellProps> = ({
  title,
  breadcrumb,
  description,
  actions,
  flush,
  children,
}) => {
  const location = useLocation();
  const { gym } = useAuth();
  const [collapsed, setCollapsed] = React.useState<boolean>(() => {
    return localStorage.getItem('gym_rail_collapsed') === 'true';
  });
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('gym_rail_collapsed', String(next));
  };

  // Close mobile drawer on route change.
  React.useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const crumbs: BreadcrumbItem[] = Array.isArray(breadcrumb)
    ? breadcrumb
    : breadcrumb
      ? [{ label: breadcrumb }]
      : [];

  return (
    <div className="min-h-screen flex w-full bg-bg text-ink">
      <AppSidebar
        collapsed={collapsed}
        onToggleCollapsed={toggle}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader
          gymName={gym?.name || 'GymTech'}
          onOpenMobileMenu={() => setMobileOpen(true)}
        />

        <div className="flex-1 flex flex-col min-h-0">
          {/* Page header */}
          <header className="px-6 lg:px-10 pt-8 pb-6 border-b border-(--line)">
            <div className="max-w-350 mx-auto flex flex-col gap-4">
              {crumbs.length > 0 && (
                <nav className="flex items-center gap-1.5 text-meta">
                  {crumbs.map((c, i) => (
                    <React.Fragment key={i}>
                      {c.href ? (
                        <a href={c.href} className="hover:text-ink transition-colors">
                          {c.label}
                        </a>
                      ) : (
                        <span className={cn(i === crumbs.length - 1 ? 'text-ink-2' : '')}>{c.label}</span>
                      )}
                      {i < crumbs.length - 1 && (
                        <span className="text-(--line) select-none">/</span>
                      )}
                    </React.Fragment>
                  ))}
                </nav>
              )}

              <div className="flex items-start justify-between gap-6 flex-wrap">
                <div className="min-w-0">
                  <h1 className="text-h1 text-ink leading-none">{title}</h1>
                  {description && (
                    <p className="text-meta mt-2 max-w-2xl">{description}</p>
                  )}
                </div>
                {actions && (
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>
                )}
              </div>
            </div>
          </header>

          {/* Body */}
          <main
            className={cn(
              'flex-1 min-h-0',
              flush ? 'overflow-x-auto' : ''
            )}
          >
            <div
              className={cn(
                'max-w-350 mx-auto w-full',
                flush ? '' : 'px-6 lg:px-10 py-8'
              )}
            >
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};
