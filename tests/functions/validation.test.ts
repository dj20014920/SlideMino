import { describe, it, expect } from 'vitest';

describe('validateJsonContentType', () => {
  it('returns true for application/json', async () => {
    const { validateJsonContentType } = await import('../../functions/utils/validation');
    const req = new Request('https://example.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(validateJsonContentType(req)).toBe(true);
  });

  it('returns true for application/json; charset=utf-8', async () => {
    const { validateJsonContentType } = await import('../../functions/utils/validation');
    const req = new Request('https://example.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
    expect(validateJsonContentType(req)).toBe(true);
  });

  it('returns false for text/plain', async () => {
    const { validateJsonContentType } = await import('../../functions/utils/validation');
    const req = new Request('https://example.com', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
    });
    expect(validateJsonContentType(req)).toBe(false);
  });

  it('returns false when Content-Type is missing', async () => {
    const { validateJsonContentType } = await import('../../functions/utils/validation');
    const req = new Request('https://example.com', { method: 'POST' });
    expect(validateJsonContentType(req)).toBe(false);
  });

  it('returns false for application/x-www-form-urlencoded', async () => {
    const { validateJsonContentType } = await import('../../functions/utils/validation');
    const req = new Request('https://example.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    expect(validateJsonContentType(req)).toBe(false);
  });

  it('returns false for application/jsonp (security)', async () => {
    const { validateJsonContentType } = await import('../../functions/utils/validation');
    const req = new Request('https://example.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/jsonp' },
    });
    expect(validateJsonContentType(req)).toBe(false);
  });

  it('returns true for Application/JSON; Charset=UTF-8 (case-insensitive)', async () => {
    const { validateJsonContentType } = await import('../../functions/utils/validation');
    const req = new Request('https://example.com', {
      method: 'POST',
      headers: { 'Content-Type': 'Application/JSON; Charset=UTF-8' },
    });
    expect(validateJsonContentType(req)).toBe(true);
  });
});

describe('validateRequestBodySize', () => {
  it('returns true when Content-Length is under the limit', async () => {
    const { validateRequestBodySize } = await import('../../functions/utils/validation');
    const req = new Request('https://example.com', {
      method: 'POST',
      headers: { 'Content-Length': '500', 'Content-Type': 'application/json' },
    });
    expect(validateRequestBodySize(req, 1024)).toBe(true);
  });

  it('returns false when Content-Length exceeds the limit', async () => {
    const { validateRequestBodySize } = await import('../../functions/utils/validation');
    const req = new Request('https://example.com', {
      method: 'POST',
      headers: { 'Content-Length': '2000', 'Content-Type': 'application/json' },
    });
    expect(validateRequestBodySize(req, 1024)).toBe(false);
  });

  it('returns true when Content-Length is missing (allow unknown size)', async () => {
    const { validateRequestBodySize } = await import('../../functions/utils/validation');
    const req = new Request('https://example.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(validateRequestBodySize(req, 1024)).toBe(true);
  });

  it('returns false when Content-Length is 0', async () => {
    const { validateRequestBodySize } = await import('../../functions/utils/validation');
    const req = new Request('https://example.com', {
      method: 'POST',
      headers: { 'Content-Length': '0', 'Content-Type': 'application/json' },
    });
    expect(validateRequestBodySize(req, 1024)).toBe(false);
  });
});

describe('validateComboCount', () => {
  it('throws ValidationError for negative number', async () => {
    const { validateComboCount } = await import('../../functions/utils/validation');
    expect(() => validateComboCount(-1)).toThrow('Invalid combo count: -1');
  });

  it('throws ValidationError for NaN', async () => {
    const { validateComboCount } = await import('../../functions/utils/validation');
    expect(() => validateComboCount(NaN)).toThrow('Invalid combo count: NaN');
  });

  it('throws ValidationError for Infinity', async () => {
    const { validateComboCount } = await import('../../functions/utils/validation');
    expect(() => validateComboCount(Infinity)).toThrow('Invalid combo count: Infinity');
  });

  it('throws ValidationError for non-number type (string)', async () => {
    const { validateComboCount } = await import('../../functions/utils/validation');
    expect(() => validateComboCount('abc')).toThrow('Invalid combo count: abc');
  });

  it('throws ValidationError for value exceeding 1000', async () => {
    const { validateComboCount } = await import('../../functions/utils/validation');
    expect(() => validateComboCount(1001)).toThrow('Combo count too large: 1001');
  });

  it('returns valid number for 0', async () => {
    const { validateComboCount } = await import('../../functions/utils/validation');
    expect(validateComboCount(0)).toBe(0);
  });

  it('returns valid number for 500', async () => {
    const { validateComboCount } = await import('../../functions/utils/validation');
    expect(validateComboCount(500)).toBe(500);
  });

  it('returns valid number for 1000 (boundary)', async () => {
    const { validateComboCount } = await import('../../functions/utils/validation');
    expect(validateComboCount(1000)).toBe(1000);
  });

  it('rounds float to nearest integer', async () => {
    const { validateComboCount } = await import('../../functions/utils/validation');
    expect(validateComboCount(3.7)).toBe(4);
  });
});