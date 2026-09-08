import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { useAuth } from '@/lib/auth';
import { Logo } from '@/components/shared/Logo';

interface LandingNavbarProps {
  isScrolled: boolean;
  activeSection?: string;
}

export const LandingNavbar: React.FC<LandingNavbarProps> = ({ isScrolled, activeSection }) => {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-200 ${
        isScrolled
          ? 'bg-background/90 backdrop-blur-md py-3 border-b border-border'
          : 'bg-transparent py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center">
          <Logo />
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-[13px] text-muted-foreground tracking-wide font-medium">
          {[
            { id: 'product', label: 'Product' },
            { id: 'how-it-works', label: 'How it works' },
            { id: 'pricing', label: 'Pricing' },
            { id: 'faq', label: 'FAQ' },
          ].map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              className={`transition-colors ${
                activeSection === id ? 'text-primary font-semibold' : 'hover:text-foreground'
              }`}
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />

          {user ? (
            <Button asChild size="sm" className="h-9 px-4 gap-1.5 font-semibold text-xs">
              <Link to={user.role === 'PLATFORM_ADMIN' ? '/admin' : '/dashboard'}>
                <span>Open workspace</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="text-xs h-9 px-3 text-muted-foreground hover:text-foreground">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="h-9 px-4 text-xs font-semibold">
                <Link to="/login">Start free trial</Link>
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
            className="size-8.5 rounded-lg border-border"
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
            className="md:hidden border-b border-border bg-background px-5 py-4 flex flex-col gap-3 overflow-hidden shadow-lg"
          >
            <a href="#product" onClick={() => setMobileMenuOpen(false)} className="text-sm py-1.5 text-muted-foreground hover:text-foreground">Product</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="text-sm py-1.5 text-muted-foreground hover:text-foreground">How it works</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="text-sm py-1.5 text-muted-foreground hover:text-foreground">Pricing</a>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="text-sm py-1.5 text-muted-foreground hover:text-foreground">FAQ</a>
            <div className="h-px bg-border my-1" />
            <div className="flex flex-col gap-2 pt-1">
              {user ? (
                <Button asChild size="sm" className="w-full justify-center h-9">
                  <Link to={user.role === 'PLATFORM_ADMIN' ? '/admin' : '/dashboard'}>Open workspace</Link>
                </Button>
              ) : (
                <>
                  <Button asChild variant="outline" size="sm" className="w-full justify-center border-border h-9">
                    <Link to="/login">Sign in</Link>
                  </Button>
                  <Button asChild size="sm" className="w-full justify-center h-9">
                    <Link to="/login">Start free trial</Link>
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
