import { isDebugEnabled } from '../debugAccess';

const ORIGINAL_BUILD_PROFILE = process.env.EXPO_PUBLIC_BUILD_PROFILE;

afterEach(() => {
  process.env.EXPO_PUBLIC_BUILD_PROFILE = ORIGINAL_BUILD_PROFILE;
});

describe('isDebugEnabled', () => {
  it('returns false in production builds', () => {
    process.env.EXPO_PUBLIC_BUILD_PROFILE = 'production';
    // __DEV__ is false in jest by default
    expect(isDebugEnabled()).toBe(false);
  });

  it('returns true in preview builds', () => {
    process.env.EXPO_PUBLIC_BUILD_PROFILE = 'preview';
    expect(isDebugEnabled()).toBe(true);
  });

  it('returns true in development builds', () => {
    process.env.EXPO_PUBLIC_BUILD_PROFILE = 'development';
    expect(isDebugEnabled()).toBe(true);
  });
});
