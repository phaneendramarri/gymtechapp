import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { fadeRiseVariants } from '@/lib/motion';

import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

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
 *  - Left rail (64px collapsed / 224px expanded) with primary nav
 *  - Top bar: search + gym switcher + user menu
 *  - Page header: breadcrumb / title / description / actions
 *  - Body: max-w-7xl, consistent padding
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
  // Bump this to re-trigger title animation on route change
  const [titleKey, setTitleKey] = React.useState(location.pathname);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('gym_rail_collapsed', String(next));
  };

  // Close mobile drawer on route change.
  React.useEffect(() => {
    setMobileOpen(false);
    setTitleKey(location.pathname);
  }, [location.pathname]);

  const crumbs: BreadcrumbItem[] = Array.isArray(breadcrumb)
    ? breadcrumb
    : breadcrumb
      ? [{ label: breadcrumb }]
      : [];

  return (
    <div className="min-h-screen flex w-full bg-background text-foreground selection:bg-primary/20">
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
          {/* Page header — clean, horizontal layout */}
          <header className="px-4 sm:px-6 lg:px-8 pt-6 pb-5 border-b border-border bg-card/30">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
              <div className="min-w-0 flex-1">
                {/* Breadcrumb */}
                {crumbs.length > 0 && (
                  <Breadcrumb className="mb-2">
                    <BreadcrumbList>
                      {crumbs.map((c, i) => {
                        const isLast = i === crumbs.length - 1;
                        return (
                          <React.Fragment key={i}>
                            <BreadcrumbItem>
                              {c.href && !isLast ? (
                                <BreadcrumbLink asChild>
                                  <Link to={c.href}>{c.label}</Link>
                                </BreadcrumbLink>
                              ) : (
                                <BreadcrumbPage>{c.label}</BreadcrumbPage>
                              )}
                            </BreadcrumbItem>
                            {!isLast && <BreadcrumbSeparator />}
                          </React.Fragment>
                        );
                      })}
                    </BreadcrumbList>
                  </Breadcrumb>
                )}
                {/* Title row */}
                <div className="flex items-center gap-4">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.h1
                      key={titleKey}
                      variants={fadeRiseVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                      className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight truncate"
                    >
                      {title}
                    </motion.h1>
                  </AnimatePresence>
                  {actions && (
                    <div className="flex items-center gap-2 shrink-0">{actions}</div>
                  )}
                </div>
                {/* Description */}
                {description && (
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl truncate leading-relaxed">
                    {description}
                  </p>
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
                'max-w-7xl mx-auto w-full',
                flush ? '' : 'px-4 sm:px-6 lg:px-8 py-6 sm:py-8'
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

