import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { LucideIcon, Inbox } from 'lucide-react';
import { OnboardingHints, type OnboardingStep } from './illustrations';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Optional React node (e.g. an SVG illustration). Takes precedence over `icon`. */
  illustration?: React.ReactNode;
  /** Optional 3-step micro-onboarding rendered under the CTA. */
  onboardingSteps?: OnboardingStep[];
  /** "Bordered" mode renders with a hairline border and a soft surface tint.
   *  Default is borderless (better inside dense tables / list areas). */
  bordered?: boolean;
  className?: string;
}

/**
 * EmptyState — a calm, on-brand "nothing here yet" moment.
 *
 * The default mode is borderless so it sits naturally inside a list region.
 * Use `bordered` when it needs to occupy a card slot (e.g. inside a tab
 * panel). Always pairs a single icon with a one-line title, a one-line
 * description, and an optional action.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  description,
  action,
  illustration,
  onboardingSteps,
  bordered = false,
  className = '',
}) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className={
        'flex flex-col items-center justify-center text-center ' +
        (bordered
          ? 'rounded-lg border border-dashed border-[var(--line)] px-6 py-10 sm:py-12 bg-[var(--surface)] '
          : 'px-2 py-10 ') +
        className
      }
    >
      {illustration ? (
        <div className="mb-4 w-40 sm:w-48">{illustration}</div>
      ) : (
        <div className="size-12 rounded-full bg-[var(--surface-2)] text-ink-3 flex items-center justify-center mb-4">
          <Icon className="size-5" strokeWidth={1.5} />
        </div>
      )}
      <h3 className="text-h3 text-ink tracking-tight max-w-md">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-ink-3 mt-2 max-w-md leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-5 flex items-center gap-2">{action}</div>}
      {onboardingSteps && onboardingSteps.length > 0 && (
        <OnboardingHints steps={onboardingSteps} className="mt-5" />
      )}
    </motion.div>
  );
};
