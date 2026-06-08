import { isDebugUser, isDebugEnabled } from '../debugAccess';

const ORIGINAL_BUILD_PROFILE = process.env.EXPO_PUBLIC_BUILD_PROFILE;

afterEach(() => {
  process.env.EXPO_PUBLIC_BUILD_PROFILE = ORIGINAL_BUILD_PROFILE;
});

describe('isDebugUser', () => {
  it('returns true for the diagnostic email (exact)', () => {
    expect(isDebugUser('a.lotfipoor@gmail.com')).toBe(true);
  });

  it('returns true regardless of email casing', () => {
    expect(isDebugUser('A.Lotfipoor@Gmail.Com')).toBe(true);
    expect(isDebugUser('A.LOTFIPOOR@GMAIL.COM')).toBe(true);
  });

  it('returns false for unrelated emails', () => {
    expect(isDebugUser('user@example.com')).toBe(false);
    expect(isDebugUser('ashkan@cycleconfident.com')).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isDebugUser(null)).toBe(false);
    expect(isDebugUser(undefined)).toBe(false);
    expect(isDebugUser('')).toBe(false);
  });
});

describe('isDebugEnabled in simulated production', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_BUILD_PROFILE = 'production';
    // __DEV__ is false in jest by default
  });

  it('returns true for debug user email in production', () => {
    expect(isDebugEnabled('a.lotfipoor@gmail.com')).toBe(true);
  });

  it('returns true for debug user email with different casing in production', () => {
    expect(isDebugEnabled('A.Lotfipoor@Gmail.com')).toBe(true);
  });

  it('returns false for regular user email in production', () => {
    expect(isDebugEnabled('regular@example.com')).toBe(false);
  });

  it('returns false with no email in production', () => {
    expect(isDebugEnabled(null)).toBe(false);
    expect(isDebugEnabled(undefined)).toBe(false);
  });
});

describe('isDebugEnabled in non-production builds', () => {
  it('returns true for preview build regardless of email', () => {
    process.env.EXPO_PUBLIC_BUILD_PROFILE = 'preview';
    expect(isDebugEnabled('regular@example.com')).toBe(true);
    expect(isDebugEnabled(null)).toBe(true);
  });
});
