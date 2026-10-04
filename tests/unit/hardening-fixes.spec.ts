import { describe, it, expect } from 'vitest';
import { createSessionToken, verifySessionToken } from '../../apps/api/src/lib/session';
import { parseDateToUnixSeconds } from '../../apps/api/src/routes/helpers';
import { escapeHtml, generateReceiptHTML } from '../../apps/api/src/lib/receipt-generator';

describe('Hardening fixes — regression protection', () => {
  const secret = 'test-secret-key-12345678901234567890';

  it('creates and verifies session tokens with non-ASCII names/emails', async () => {
    const user = {
      id: 7,
      email: 'vikram.rathore+हिन्दी@gym.com',
      name: 'Vikram Rाठore 💪',
      role: 'OWNER' as const,
      gymId: 1,
      isOwner: true,
      permissions: ['dashboard'],
      roleId: null,
    };
    const { token } = await createSessionToken(user, secret, { expiresInSeconds: 3600 });
    const verified = await verifySessionToken(token, secret);
    expect(verified).not.toBeNull();
    expect(verified?.name).toBe(user.name);
    expect(verified?.email).toBe(user.email);
  });

  it('parseDateToUnixSeconds rejects unparseable dates instead of NaN', () => {
    expect(parseDateToUnixSeconds(undefined)).toBeUndefined();
    expect(parseDateToUnixSeconds('')).toBeUndefined();
    expect(parseDateToUnixSeconds('not-a-date')).toBeNull();
    const valid = parseDateToUnixSeconds('2026-01-15');
    expect(typeof valid).toBe('number');
    expect(Number.isFinite(valid as number)).toBe(true);
  });

  it('escapeHtml neutralizes markup in all five special chars', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'
    );
    expect(escapeHtml(`a&b'c`)).toBe('a&amp;b&#39;c');
  });

  it('generateReceiptHTML escapes staff-controlled fields (stored XSS)', () => {
    const html = generateReceiptHTML({
      receiptNumber: 'RCP-2026-0001',
      paymentDate: 1789933628,
      memberName: '<img src=x onerror=alert(1)>',
      memberCode: 'MEM-1001',
      phone: '9876543210',
      amountPaise: 150000,
      paymentMode: 'UPI',
      notes: '</strong><script>alert(2)</script>',
      gymName: 'GymTech',
      gymPhone: '9876543210',
    });
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<script>alert(2)</script>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;script&gt;alert(2)&lt;/script&gt;');
  });
});
