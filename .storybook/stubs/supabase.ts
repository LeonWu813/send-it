/**
 * Storybook stub for src/lib/supabase.ts. NEVER touches the network.
 *
 * Every query-builder chain (.from().select().eq()...) is awaitable and resolves
 * to `{ data, error: null }`. By default data is `[]` (or `null` after
 * .single()/.maybeSingle()). Provide fake data per table / rpc / function:
 *
 *   import { setStubData } from '../../../../.storybook/stubs/supabase';
 *   setStubData('routes', [{ id: '1', name: 'Test' }]);
 *   setStubData('rpc:get_feed', [...]);
 *   setStubData('fn:upload-video', { ok: true });
 *   setStubData('auth:session', { user: { id: 'u1', email: 'a@b.c' } });
 */

type Json = unknown;
const data = new Map<string, Json>();

/**
 * Seed a table/rpc with this to make its query never resolve (persistent Loading state):
 *   setStubData('saved_gyms', STUB_PENDING);
 */
export const STUB_PENDING = Symbol('storybook-stub-pending');

export function setStubData(key: string, value: Json): void {
  data.set(key, value);
}
export function resetStubData(): void {
  data.clear();
}

function builder(key: string): unknown {
  let single = false;
  const proxy: unknown = new Proxy(function noop() {}, {
    get(_t, prop) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
          if (data.get(key) === STUB_PENDING) return new Promise(() => {}).then(resolve, reject);
          const raw = data.has(key) ? data.get(key) : single ? null : [];
          const value = single && Array.isArray(raw) ? (raw[0] ?? null) : raw;
          if (value && typeof value === 'object' && '__stubError' in value) {
            return Promise.resolve({ data: null, error: { message: String((value as { __stubError: unknown }).__stubError) }, count: null }).then(resolve, reject);
          }
          return Promise.resolve({ data: value, error: null, count: Array.isArray(raw) ? raw.length : null }).then(
            resolve,
            reject,
          );
        };
      }
      if (prop === 'single' || prop === 'maybeSingle') {
        return () => {
          single = true;
          return proxy;
        };
      }
      return () => proxy;
    },
  });
  return proxy;
}

const noopChannel: Record<string, unknown> = {
  on: () => noopChannel,
  subscribe: () => noopChannel,
  unsubscribe: async () => 'ok',
};

export const supabase = {
  from: (table: string) => builder(table),
  rpc: (fn: string) => builder(`rpc:${fn}`),
  functions: { invoke: async (fn: string) => ({ data: data.get(`fn:${fn}`) ?? null, error: null }) },
  channel: () => noopChannel,
  removeChannel: async () => 'ok',
  storage: {
    from: () => ({
      upload: async () => ({ data: { path: 'stub/path' }, error: null }),
      remove: async () => ({ data: [], error: null }),
      createSignedUrl: async () => ({ data: { signedUrl: 'about:blank' }, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: 'about:blank' } }),
    }),
  },
  auth: {
    getSession: async () => ({ data: { session: data.get('auth:session') ?? null }, error: null }),
    getUser: async () => ({ data: { user: (data.get('auth:session') as { user?: unknown } | undefined)?.user ?? null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signOut: async () => ({ error: null }),
    signInWithIdToken: async () => ({ data: { session: null, user: null }, error: null }),
    signInWithOAuth: async () => ({ data: { provider: '', url: null }, error: null }),
    setSession: async () => ({ data: { session: null, user: null }, error: null }),
    refreshSession: async () => ({ data: { session: null, user: null }, error: null }),
  },
};
