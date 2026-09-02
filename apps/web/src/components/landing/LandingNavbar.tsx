import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { useAuth } from '@/lib/auth';
import { Logo } from '@/components/shared/Logo';

interface LandingNavbarProps {
  isScrolled: boolean;
}

export const LandingNavbar: React.FC<LandingNavbarProps> = ({ isScrolled }) => {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-200 ${
        isScrolled
          ? 'bg-[var(--bg)] py-3 border-b border-[var(--line)]'
          : 'bg-[var(--bg)] py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Brand Logo */}
        <a href="#/" className="flex items-center">
          <Logo />
        </a>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-[13px] text-ink-2 tracking-wide">
          <a href="#product" className="hover:text-ink transition-colors">Product</a>
          <a href="#how-it-works" className="hover:text-ink transition-colors">How it works</a>
          <a href="#pricing" className="hover:text-ink transition-colors">Pricing</a>
          <a href="#faq" className="hover:text-ink transition-colors">FAQ</a>
        </nav>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />

          {user ? (
            <Button asChild size="sm" className="bg-[var(--ink)] text-[var(--ink-inverse)] hover:bg-[var(--ink-2)] border-[var(--ink)] h-9 px-4 gap-1.5">
              <a href={user.role === 'PLATFORM_ADMIN' ? '#/admin' : '#/dashboard'}>
                <span>Open workspace</span>
                <ArrowRight className="size-3.5" />
              </a>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="text-[13px] h-9 px-3 text-ink-2 hover:text-ink hover:bg-[var(--surface-2)]">
                <a href="#/login">Sign in</a>
              </Button>
              <Button asChild size="sm" className="bg-[var(--ink)] text-[var(--ink-inverse)] hover:bg-[var(--ink-2)] border-[var(--ink)] h-9 px-4">
                <a href="#/login">Start free trial</a>
              </Button>
            </>
          )}
        </div>

        {/* Mobile Hamburger */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <Button
            variant="outline"
            size="icon"
            className="size-8.5 rounded-lg"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
        </div>
      </div>

      {/* Mobile Dropdown */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-b border-[var(--line)] bg-[var(--bg)] px-5 py-4 flex flex-col gap-3 overflow-hidden"
          >
            <a href="#product" onClick={() => setMobileMenuOpen(false)} className="text-sm py-1.5 text-ink-2 hover:text-ink">Product</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="text-sm py-1.5 text-ink-2 hover:text-ink">How it works</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="text-sm py-1.5 text-ink-2 hover:text-ink">Pricing</a>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="text-sm py-1.5 text-ink-2 hover:text-ink">FAQ</a>
            <div className="h-px bg-[var(--line)] my-1" />
            <div className="flex flex-col gap-2 pt-1">
              <Button asChild variant="outline" size="sm" className="w-full justify-center border-[var(--line)] h-9">
                <a href="#/login">Sign in</a>
              </Button>
              <Button asChild size="sm" className="w-full justify-center bg-[var(--ink)] text-[var(--ink-inverse)] hover:bg-[var(--ink-2)] border-[var(--ink)] h-9">
                <a href="#/login">Start free trial</a>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
