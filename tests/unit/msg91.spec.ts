import { describe, it, expect } from 'vitest';
import {
  msg91ConfigFromEnv,
  applyPlatformOverrides,
  isMsg91Configured,
  normalizeIndianMobile,
  buildSmsFlowPayload,
  buildWhatsappPayload,
  buildEmailPayload,
  sendMsg91Sms,
  sendMsg91Email,
} from '../../apps/api/src/lib/msg91';

const BASE = {
  authKey: 'test-key',
  senderId: 'GYMTEC',
  emailFrom: 'GymTech <hello@gymtech.app>',
  waNumber: '919876543210',
  smsFlowId: 'flow123',
  whatsappTemplate: 'gym_receipt',
  whatsappLanguage: 'en',
};

describe('msg91 provider', () => {
  it('is disabled without an auth key', () => {
    expect(isMsg91Configured({ ...BASE, authKey: '' })).toBe(false);
    expect(isMsg91Configured({ ...BASE, authKey: '  ' })).toBe(false);
    expect(isMsg91Configured(BASE)).toBe(true);
  });

  it('reads config from env with sane fallbacks', () => {
    const cfg = msg91ConfigFromEnv({ MSG91_AUTH_KEY: 'k' });
    expect(cfg.authKey).toBe('k');
    expect(cfg.senderId).toBe('GYMTEC');
    expect(cfg.whatsappLanguage).toBe('en');
  });

  it('platform values override env only when non-empty', () => {
    const merged = applyPlatformOverrides(msg91ConfigFromEnv({ MSG91_AUTH_KEY: 'env' }), {
      senderId: 'MYGYM',
      authKey: '',
    } as any);
    expect(merged.authKey).toBe('env');
    expect(merged.senderId).toBe('MYGYM');
  });

  it('normalizes Indian mobiles', () => {
    expect(normalizeIndianMobile('9876543210')).toBe('919876543210');
    expect(normalizeIndianMobile('919876543210')).toBe('919876543210');
    expect(normalizeIndianMobile('+91 98765 43210')).toBe('919876543210');
    expect(normalizeIndianMobile('09876543210')).toBe('919876543210');
  });

  it('builds the SMS flow payload', () => {
    const p = buildSmsFlowPayload(BASE, '9876543210', { NAME: 'Ravi', AMOUNT: 1500 });
    expect(p).toMatchObject({
      flow_id: 'flow123',
      sender: 'GYMTEC',
      mobiles: '919876543210',
      NAME: 'Ravi',
      AMOUNT: '1500',
    });
  });

  it('builds the WhatsApp template payload', () => {
    const p = buildWhatsappPayload(BASE, '9876543210', ['Ravi', '1500']);
    expect(p.integrated_number).toBe('919876543210');
    expect(p.to).toBe('919876543210');
    expect(p.payload.template.name).toBe('gym_receipt');
    expect(p.payload.template.components[0].parameters).toHaveLength(2);
  });

  it('builds the email payload', () => {
    const p = buildEmailPayload(BASE, 'a@b.com', 'Hi', '<p>Hi</p>');
    expect(p.subject).toBe('Hi');
    expect(p.recipients[0].to[0].email).toBe('a@b.com');
  });

  it('skips network when unconfigured', async () => {
    const noKey = { ...BASE, authKey: '' };
    expect(await sendMsg91Sms(noKey, '9876543210', {})).toMatchObject({ ok: false, skipped: true });
    expect(await sendMsg91Email(noKey, 'a@b.com', 's', '<p/>')).toMatchObject({ ok: false, skipped: true });
  });

  it('rejects bad recipients without network', async () => {
    const bad = await sendMsg91Email(BASE, 'not-an-email', 's', '<p/>');
    expect(bad.ok).toBe(false);
    expect(bad.error).toMatch(/email/i);
  });
});
