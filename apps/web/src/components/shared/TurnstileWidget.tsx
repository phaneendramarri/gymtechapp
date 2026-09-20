import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';

export interface TurnstileWidgetRef {
  reset: () => void;
}

interface TurnstileWidgetProps {
  siteKey?: string;
  action?: string;
  onVerify: (token: string) => void;
  onError?: (error?: any) => void;
  onExpire?: () => void;
  className?: string;
}

export const TurnstileWidget = forwardRef<TurnstileWidgetRef, TurnstileWidgetProps>(
  ({ siteKey, action = 'login', onVerify, onError, onExpire, className }, ref) => {
    const turnstileRef = useRef<TurnstileInstance>(null);
    // No fallback key: a hardcoded production site key silently rendered the
    // real widget in every environment, so local builds shipped a challenge the
    // local secret could not verify. The key must come from the environment
    // (`VITE_TURNSTILE_SITE_KEY` in .env.production / .env.development.local).
    const activeSiteKey = siteKey || (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined);

    useImperativeHandle(ref, () => ({
      reset: () => {
        turnstileRef.current?.reset();
      },
    }));

    if (!activeSiteKey) {
      if (import.meta.env.DEV) {
        console.warn(
          '[turnstile] VITE_TURNSTILE_SITE_KEY is not set — the bot check is disabled in this build.'
        );
      }
      return null;
    }

    return (
      <div className={className ?? 'flex justify-center my-3 min-h-[65px]'}>
        <Turnstile
          ref={turnstileRef}
          siteKey={activeSiteKey}
          onSuccess={onVerify}
          onError={onError}
          onExpire={onExpire}
          options={{
            action,
            theme: 'auto',
          }}
        />
      </div>
    );
  }
);

TurnstileWidget.displayName = 'TurnstileWidget';
