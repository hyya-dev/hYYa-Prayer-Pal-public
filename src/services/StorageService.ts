import { Preferences } from '@capacitor/preferences';

const cache = new Map<string, string | null>();
let isInitialized = false;

export const StorageService = {
  /**
   * Initializes the native preferences into the high-speed synchronous memory cache.
   * Also selectively migrates any existing localStorage keys that haven't been ported yet.
   */
  async init() {
    if (isInitialized) return;

    try {
      // 1. One-time Migration from legacy window.localStorage -> Native Preferences
      if (typeof window !== 'undefined' && window.localStorage) {
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && !key.startsWith('vite') && !key.startsWith('loglevel')) {
            const legacyValue = window.localStorage.getItem(key);
            const { value: nativeValue } = await Preferences.get({ key });
            
            // If native payload is missing, but localStorage has it natively, port it.
            if (nativeValue === null && legacyValue !== null) {
              await Preferences.set({ key, value: legacyValue });
            }
          }
        }
      }

      // 2. Hydrate memory map from Native Storage completely asynchronously before DOM mount
      const tempMap = new Map<string, string | null>();
      const { keys } = await Preferences.keys();
      for (const key of keys) {
        const { value } = await Preferences.get({ key });
        tempMap.set(key, value);
      }

      // Merge native snapshot without overwriting any in-memory writes that happened meanwhile.
      for (const [key, value] of tempMap.entries()) {
        if (!cache.has(key)) {
          cache.set(key, value);
        }
      }

      // Obsolete: Wi‑Fi / auto-resume toggles were removed; cellular consent modal is the only gate.
      const obsoleteQuranAudioNetworkPolicyKey = 'quran_audio_network_policy_v1';
      if (tempMap.has(obsoleteQuranAudioNetworkPolicyKey)) {
        cache.delete(obsoleteQuranAudioNetworkPolicyKey);
        await Preferences.remove({ key: obsoleteQuranAudioNetworkPolicyKey });
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            window.localStorage.removeItem(obsoleteQuranAudioNetworkPolicyKey);
          } catch {
            // ignore private mode / quota
          }
        }
      }

      isInitialized = true;
    } catch (error) {
      console.warn('StorageService: Native Preferences sync failed, running in fallback mode.', error);
    }
  },

  /**
   * Synchronous getter ensuring 0ms blocking latency across React components arrays.
   */
  getItem(key: string): string | null {
    if (!isInitialized) {
      if (key !== 'appSettings' && key !== 'i18nextLng') {
        console.warn(`StorageService: Synchronous access for key '${key}' invoked before init(). Returning legacy fallback.`);
      }
      // setItem() always mutates `cache` first. Capacitor WebViews can lack usable
      // `localStorage`; if we only read that path before init(), we miss values that
      // were just written in-memory and never surface them back to tafsir/Quran state.
      const fromCache = cache.get(key);
      if (fromCache != null) {
        return fromCache;
      }
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return null;
    }
    return cache.get(key) ?? null;
  },

  /**
   * Transparently saves to both synchronous memory constraints AND native Capacitor bindings.
   */
  setItem(key: string, value: string) {
    // 1. Memory update
    cache.set(key, value);
    
    // 2. Async persistent native bridge overwrite
    void Preferences.set({ key, value });

    // 3. Keep localStorage payload aligned strictly for PWA or web targets as secondary fallback.
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, value);
      } catch (e) {
        // Suppress private browser mode exceptions
      }
    }
  },

  removeItem(key: string) {
    cache.delete(key);
    void Preferences.remove({ key });
    
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(key);
      } catch (e) {
        // Suppress private browser mode exceptions
      }
    }
  },

  clear() {
    const ownedKeys = new Set(cache.keys());
    const ownedPrefixes = [
      'prayerpal',
      'hisn_',
      'quran_',
      'tafsir_',
      'widget_',
      'counter',
    ];

    cache.clear();
    void Preferences.clear();
    
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (!key) continue;
          if (key.startsWith('vite') || key.startsWith('loglevel')) continue;

          if (
            ownedKeys.has(key) ||
            ownedPrefixes.some((prefix) => key.startsWith(prefix))
          ) {
            keysToRemove.push(key);
          }
        }

        keysToRemove.forEach((key) => window.localStorage.removeItem(key));
      } catch (e) {
        // Suppress private browser mode exceptions
      }
    }
  }
};
