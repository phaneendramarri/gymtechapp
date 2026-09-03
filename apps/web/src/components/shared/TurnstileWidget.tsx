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
    const activeSiteKey =
      siteKey || (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || '0x4AAAAAAEmPXeBClO_3_EVH';

    useImperativeHandle(ref, () => ({
      reset: () => {
        turnstileRef.current?.reset();
      },
    }));

    if (!activeSiteKey) {
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
