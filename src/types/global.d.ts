export {};

declare global {
  /**
   * iOS Safari / iOS WebView extensions for DeviceOrientationEvent.
   * These exist at runtime but are not present in lib.dom.d.ts.
   */
  interface DeviceOrientationEvent {
    webkitCompassHeading?: number;
    webkitCompassAccuracy?: number;
  }

  interface DeviceOrientationEventConstructor {
    prototype: DeviceOrientationEvent;
    new (type: string, eventInitDict?: DeviceOrientationEventInit): DeviceOrientationEvent;
    requestPermission?: () => Promise<'granted' | 'denied'>;
  }

  var DeviceOrientationEvent: DeviceOrientationEventConstructor;

  /**
   * Legacy IE/Edge language property occasionally present in WebViews.
   */
  interface Navigator {
    userLanguage?: string;
  }

  /**
   * Global bridges injected by native wrappers (Capacitor/WebKit messageHandlers).
   * Keep these typed as optional to avoid runtime assumptions.
   */
  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
    };
    _widgetHandlerReady?: boolean;
    syncWidgetPrayers?: (data: unknown) => Promise<unknown> | unknown;
  }
}

