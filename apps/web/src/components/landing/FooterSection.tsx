import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Logo } from '@/components/shared/Logo';

const TwitterIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
)
const LinkedinIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.063 2.064 2.064 0 1 1 2.063 2.063zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
)
const YoutubeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
)
const GithubIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.111.82-.261.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
  </svg>
)

export const FooterSection: React.FC = () => {
  return (
    <footer className="border-t border-border bg-card/60 backdrop-blur-md py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 mb-12">
          {/* Col 1: Brand Info */}
          <div className="space-y-3 md:col-span-2">
            <Logo />
            <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
              The all-in-one operating system for modern gyms, fitness centers, and strength clubs. Manage members, automated attendance, GST receipts, and trainer commissions in one place.
            </p>
            <a
              href="#/status"
              className="inline-flex items-center gap-2 text-[11px] font-mono text-primary pt-1 font-semibold hover:underline"
            >
              <span className="size-2 rounded-full bg-primary animate-pulse" />
              <span>All Systems Operational</span>
              <ArrowUpRight className="size-3" />
            </a>

            {/* Social row */}
            <div className="flex items-center gap-2 pt-2">
              <SocialLink href="https://twitter.com" label="Twitter / X">
                <TwitterIcon className="size-3.5" />
              </SocialLink>
              <SocialLink href="https://linkedin.com" label="LinkedIn">
                <LinkedinIcon className="size-3.5" />
              </SocialLink>
              <SocialLink href="https://youtube.com" label="YouTube">
                <YoutubeIcon className="size-3.5" />
              </SocialLink>
              <SocialLink href="https://github.com" label="GitHub">
                <GithubIcon className="size-3.5" />
              </SocialLink>
            </div>
          </div>

          {/* Col 2: Product */}
          <div>
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground mb-3">Product</h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li><a href="#product" className="hover:text-foreground transition-colors">Product Workflow</a></li>
              <li><a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a></li>
              <li><a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
              <li><a href="#faq" className="hover:text-foreground transition-colors">FAQ</a></li>
            </ul>
          </div>

          {/* Col 3: Resources */}
          <div>
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground mb-3">Resources</h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li><a href="#/blog" className="hover:text-foreground transition-colors">Blog</a></li>
              <li><a href="#/changelog" className="hover:text-foreground transition-colors">Changelog</a></li>
              <li><a href="#/help" className="hover:text-foreground transition-colors">Help center</a></li>
              <li><a href="#/status" className="hover:text-foreground transition-colors">Status</a></li>
            </ul>
          </div>

          {/* Col 4: Company */}
          <div>
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground mb-3">Company</h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li><a href="#/about" className="hover:text-foreground transition-colors">About</a></li>
              <li><a href="#/careers" className="hover:text-foreground transition-colors">Careers</a></li>
              <li><a href="#/press" className="hover:text-foreground transition-colors">Press</a></li>
              <li><a href="#/contact" className="hover:text-foreground transition-colors">Contact</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border/60 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] font-mono text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} GymTech. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
            <a href="#/terms" className="hover:text-foreground transition-colors">Terms of Service</a>
            <a href="#/security" className="hover:text-foreground transition-colors">Security</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

const SocialLink: React.FC<{ href: string; label: string; children: React.ReactNode }> = ({ href, label, children }) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer noopener"
    aria-label={label}
    className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
  >
    {children}
  </a>
)
