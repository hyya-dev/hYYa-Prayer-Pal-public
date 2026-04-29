import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Capacitor plugins (must include registerPlugin for widgetService / usePrayerTimes)
vi.mock('@capacitor/core', () => {
    const mockPlugin = () => ({
        syncPrayerData: vi.fn().mockResolvedValue({ success: true }),
        saveWeather: vi.fn().mockResolvedValue({ success: true }),
        scheduleNativeAlarms: vi.fn().mockResolvedValue({ success: true, scheduledCount: 0 }),
        cancelNativeAlarms: vi.fn().mockResolvedValue({ success: true }),
        saveNotificationSettings: vi.fn().mockResolvedValue({ success: true }),
        shareApp: vi.fn().mockResolvedValue({ success: true }),
    });
    return {
        Capacitor: {
            isNativePlatform: () => false,
            getPlatform: () => 'web',
        },
        registerPlugin: vi.fn(() => mockPlugin()),
    };
});

vi.mock('@capacitor/geolocation', () => ({
    Geolocation: {
        getCurrentPosition: vi.fn(),
        checkPermissions: vi.fn(),
        requestPermissions: vi.fn(),
    },
}));

vi.mock('@capacitor/local-notifications', () => ({
    LocalNotifications: {
        schedule: vi.fn(),
        checkPermissions: vi.fn(),
        requestPermissions: vi.fn(),
    },
}));

// Mock IntersectionObserver
const IntersectionObserverMock = vi.fn(() => ({
    disconnect: vi.fn(),
    observe: vi.fn(),
    takeRecords: vi.fn(),
    unobserve: vi.fn(),
}));

vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);

// Mock matchMedia
Object.defineProperty(globalThis, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});
