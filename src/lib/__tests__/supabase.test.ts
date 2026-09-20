/**
 * Tests for src/lib/supabase.ts
 *
 * Verifies that:
 * - The singleton is exported correctly
 * - Missing environment variables cause a clear startup error before any
 *   network connection is attempted
 */

// Mock native modules used by supabase.ts
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Mock createClient so the test doesn't need a real WebSocket runtime
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({
    auth: { getSession: jest.fn(), onAuthStateChange: jest.fn() },
  }),
}));

const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const originalKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

describe('supabase singleton', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalKey;
  });

  it('exports a supabase client object when env vars are present', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../supabase') as { supabase: { auth: object } };
    expect(mod.supabase).toBeDefined();
    expect(mod.supabase.auth).toBeDefined();
  });

  it('throws when EXPO_PUBLIC_SUPABASE_URL is missing', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = '';
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../supabase');
    }).toThrow('Missing required environment variables');
  });

  it('throws when EXPO_PUBLIC_SUPABASE_ANON_KEY is missing', () => {
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = '';
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../supabase');
    }).toThrow('Missing required environment variables');
  });
});
