import { openDB, DBSchema } from 'idb';

interface PrayerPalDB extends DBSchema {
    quran_data: {
        key: string;
        value: unknown;
    };
    audio_cache: {
        key: string;
        value: Blob;
    };
    settings: {
        key: string;
        value: unknown;
    };
}

const DB_NAME = 'prayerpal-db';
const DB_VERSION = 1;

type StoreName = keyof PrayerPalDB;
type StoreKey<TStore extends StoreName> = PrayerPalDB[TStore]['key'];
type StoreValue<TStore extends StoreName> = PrayerPalDB[TStore]['value'];

export const dbPromise = openDB<PrayerPalDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
        if (!db.objectStoreNames.contains('quran_data')) {
            db.createObjectStore('quran_data');
        }
        if (!db.objectStoreNames.contains('audio_cache')) {
            db.createObjectStore('audio_cache');
        }
        if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings');
        }
    },
});

export const dbService = {
    async get<TStore extends StoreName>(store: TStore, key: StoreKey<TStore>): Promise<StoreValue<TStore> | undefined> {
        const db = await dbPromise;
        // @ts-expect-error type inference bug in idb for union types
        return db.get(store, key);
    },
    async put<TStore extends StoreName>(store: TStore, key: StoreKey<TStore>, val: StoreValue<TStore>): Promise<StoreKey<TStore>> {
        const db = await dbPromise;
        // @ts-expect-error type inference bug in idb for union types
        return db.put(store, val, key);
    },
    async delete<TStore extends StoreName>(store: TStore, key: StoreKey<TStore>): Promise<void> {
        const db = await dbPromise;
        // @ts-expect-error type inference bug in idb for union types
        return db.delete(store, key);
    },
    async clear<TStore extends StoreName>(store: TStore): Promise<void> {
        const db = await dbPromise;
        // @ts-expect-error type inference bug in idb for union types
        return db.clear(store);
    },
    async getAllKeys<TStore extends StoreName>(store: TStore): Promise<Array<StoreKey<TStore>>> {
        const db = await dbPromise;
        // @ts-expect-error type inference bug in idb for union types
        return db.getAllKeys(store);
    }
};
