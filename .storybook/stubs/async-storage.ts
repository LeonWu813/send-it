/** In-memory AsyncStorage so persisted theme/settings never leak between stories. */
const store = new Map<string, string>();

const AsyncStorage = {
  getItem: async (key: string): Promise<string | null> => store.get(key) ?? null,
  setItem: async (key: string, value: string): Promise<void> => {
    store.set(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    store.delete(key);
  },
  clear: async (): Promise<void> => store.clear(),
  getAllKeys: async (): Promise<string[]> => [...store.keys()],
  multiGet: async (keys: string[]): Promise<[string, string | null][]> =>
    keys.map((k) => [k, store.get(k) ?? null]),
};

export default AsyncStorage;
