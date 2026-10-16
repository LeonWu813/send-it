import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/react-native-web-vite';
import type { Plugin } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const stub = (name: string): string => path.resolve(here, 'stubs', name);

/**
 * Redirects every import of src/lib/supabase (relative, "@/" or absolute) to a
 * no-network stub. Matching is done on the RESOLVED file path so it works no
 * matter how the module is imported.
 */
function supabaseStubPlugin(): Plugin {
  const real = path.resolve(root, 'src/lib/supabase');
  return {
    name: 'storybook-supabase-stub',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer || (!source.startsWith('.') && !source.startsWith('/') && !source.startsWith('@/'))) {
        return null;
      }
      const cleaned = source.startsWith('@/') ? path.resolve(root, 'src', source.slice(2)) : path.resolve(path.dirname(importer), source);
      if (cleaned === real || cleaned === `${real}.ts`) {
        return stub('supabase.ts');
      }
      return null;
    },
  };
}

/** expo-modules-core's ts-declarations/*.ts are type-only files whose imports Vite cannot elide. */
function expoTypeDeclarationsPlugin(): Plugin {
  return {
    name: 'storybook-expo-ts-declarations',
    enforce: 'pre',
    load(id) {
      if (/expo-modules-core\/src\/ts-declarations\/global\.ts/.test(id.split('?')[0])) return 'export {};';
      return null;
    },
  };
}

const config: StorybookConfig = {
  framework: '@storybook/react-native-web-vite',
  stories: ['../src/**/*.stories.@(ts|tsx)', '../src/**/*.mdx'],
  addons: [],
  core: { disableTelemetry: true },
  viteFinal: async (viteConfig) => {
    viteConfig.plugins = [supabaseStubPlugin(), expoTypeDeclarationsPlugin(), ...(viteConfig.plugins ?? [])];
    viteConfig.resolve ??= {};
    const existing = viteConfig.resolve.alias;
    const extra = [
      { find: /^@react-native-async-storage\/async-storage$/, replacement: stub('async-storage.ts') },
      { find: /^@\//, replacement: `${path.resolve(root, 'src')}/` },
    ];
    viteConfig.resolve.alias = [
      ...extra,
      ...(Array.isArray(existing)
        ? existing
        : Object.entries(existing ?? {}).map(([find, replacement]) => ({ find, replacement }))),
    ];
    // The dependency pre-bundler hits the same type-only file; patch it there too.
    viteConfig.optimizeDeps = {
      ...viteConfig.optimizeDeps,
      rolldownOptions: {
        ...(viteConfig.optimizeDeps as { rolldownOptions?: object } | undefined)?.rolldownOptions,
        plugins: [expoTypeDeclarationsPlugin()],
      },
    } as typeof viteConfig.optimizeDeps;
    viteConfig.define = {
      ...viteConfig.define,
      'process.env.EXPO_PUBLIC_SUPABASE_URL': JSON.stringify('http://storybook.invalid'),
      'process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify('storybook-anon-key'),
    };
    return viteConfig;
  },
};

export default config;
