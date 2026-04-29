import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { MapPin } from "lucide-react";
import { SettingsCategory } from "../../settings/SettingsCategory";
import { SettingsToggle } from "../../settings/SettingsToggle";
import { SettingsSubScreen } from "../../settings/SettingsSubScreen";
import { AppSettings } from "@/hooks/useAppSettings";
import { searchCitiesPrioritized, City } from "@/services/citySearchService";
import { searchPlaces } from "@/services/geocodingService";
import { resolveEasternProvinceToNearestCity } from "@/hooks/usePrayerTimes";
import { logger } from "@/utils/logger";

interface LocationSettingsPanelProps {
  settings: AppSettings;
  onUpdateLocation: (location: Partial<AppSettings["location"]>) => void;
  onBack: () => void;
}

interface GeocodeResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    country_code?: string;
    locality?: string;
    place?: string;
    region?: string;
  };
  type?: string;
  class?: string;
  importance?: number;
}

function cityToGeocodeResult(city: City): GeocodeResult {
  return {
    lat: city.lat.toString(),
    lon: city.lng.toString(),
    display_name: city.city_local || city.city,
    address: {
      city: city.city,
      country: city.country,
    },
    type: "city",
    class: "place",
    importance: 0.5,
  };
}

export function LocationSettingsPanel({
  settings,
  onUpdateLocation,
  onBack,
}: LocationSettingsPanelProps) {
  const { t } = useTranslation();
  const geocodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  useEffect(() => {
    if (showResults && searchInputRef.current) {
      const rect = searchInputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [showResults]);

  useEffect(() => {
    return () => {
      if (geocodeTimeoutRef.current) {
        clearTimeout(geocodeTimeoutRef.current);
      }
    };
  }, []);

  const getUserCountryCode = (): string | null => {
    try {
      const locale = Intl.DateTimeFormat().resolvedOptions();
      const region = new Intl.Locale(locale.locale || "en-US").region;
      return region || null;
    } catch {
      const lang = navigator.language || "en-US";
      const parts = lang.split("-");
      return parts.length > 1 ? parts[1].toUpperCase() : null;
    }
  };

  const prioritizeResults = (
    results: GeocodeResult[],
    userCountryCode: string | null,
  ): GeocodeResult[] => {
    return [...results].sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      const aIsCity =
        a.type?.includes("city") ||
        a.type?.includes("town") ||
        a.class === "place";
      const bIsCity =
        b.type?.includes("city") ||
        b.type?.includes("town") ||
        b.class === "place";

      if (aIsCity && !bIsCity) scoreA += 100;
      if (bIsCity && !aIsCity) scoreB += 100;

      if (userCountryCode) {
        const aCountry = a.address?.country_code?.toUpperCase();
        const bCountry = b.address?.country_code?.toUpperCase();

        if (aCountry === userCountryCode && bCountry !== userCountryCode)
          scoreA += 50;
        if (bCountry === userCountryCode && aCountry !== userCountryCode)
          scoreB += 50;
      }

      if (a.importance && b.importance) {
        scoreA += a.importance * 10;
        scoreB += b.importance * 10;
      }

      return scoreB - scoreA;
    });
  };

  const formatResultName = (result: GeocodeResult): string => {
    const addr = result.address;
    if (!addr) return result.display_name;

    const parts: string[] = [];
    if (addr.city) parts.push(addr.city);
    else if (addr.town) parts.push(addr.town);
    else if (addr.village) parts.push(addr.village);

    if (addr.state) parts.push(addr.state);
    if (addr.country) parts.push(addr.country);

    return parts.length > 0 ? parts.join(", ") : result.display_name;
  };

  const handleSelectResult = (result: GeocodeResult) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);

    if (
      !isNaN(lat) &&
      !isNaN(lon) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180
    ) {
      let resultCity =
        result.address?.city ||
        result.address?.town ||
        result.address?.village ||
        result.address?.locality ||
        result.address?.place ||
        (result.display_name ? result.display_name.split(",")[0].trim() : "") ||
        "";
        
      if (!resultCity && (result.address?.state || result.address?.region)) {
        const stateOrRegion = result.address?.state || result.address?.region;
        if (
          stateOrRegion &&
          /eastern province|ash sharqiyah|eastern region|الشرقية/i.test(
            stateOrRegion,
          )
        ) {
          const resolved = resolveEasternProvinceToNearestCity(lat, lon);
          resultCity =
            resolved !== "" ? resolved : stateOrRegion;
        } else {
          resultCity = stateOrRegion || "";
        }
      }
      resultCity = resultCity || settings.location.manualCity;

      if (!resultCity) {
        logger.warn("Invalid city name from result:", result);
        return;
      }

      onUpdateLocation({
        manualLatitude: lat,
        manualLongitude: lon,
        manualCity: resultCity,
      });

      setShowResults(false);
      setSearchResults([]);
    } else {
      logger.warn("Invalid coordinates from result:", {
        lat,
        lon,
        result,
      });
    }
  };

  return (
    <SettingsSubScreen
      title={t("settings.location.title")}
      onBack={onBack}
      className="animate-fade-in"
    >
      <SettingsCategory title={t("settings.location.services")} className="bg-pp-card-soft rounded-2xl overflow-hidden mb-6">
        <SettingsToggle
          icon={<MapPin className="w-5 h-5" />}
          label={t("settings.location.autoDetect")}
          description={t("settings.location.autoDetectDesc")}
          enabled={settings.location.autoDetect}
          onToggle={(enabled) => onUpdateLocation({ autoDetect: enabled })}
          isLast={settings.location.autoDetect}
        />

        {!settings.location.autoDetect && (
          <div className="px-4 py-3 relative border-t border-white/5">
            <label className="text-xs text-white/50 block mb-1">
              {t("settings.location.cityName")}
            </label>
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                value={settings.location.manualCity}
                onChange={(e) => {
                  const cityName = e.target.value;
                  onUpdateLocation({ manualCity: cityName });

                  if (geocodeTimeoutRef.current) {
                    clearTimeout(geocodeTimeoutRef.current);
                  }

                  setShowResults(false);
                  setSearchResults([]);

                  if (cityName.trim().length >= 2) {
                    setIsSearching(true);
                    geocodeTimeoutRef.current = setTimeout(async () => {
                      try {
                        const userCountryCode = getUserCountryCode();

                        try {
                          const localCities = await searchCitiesPrioritized(
                            cityName,
                            10,
                            userCountryCode === "US"
                              ? "United States"
                              : undefined,
                          );

                          if (localCities.length > 0) {
                            const localResults = localCities.map(cityToGeocodeResult);
                            const prioritizedResults = prioritizeResults(
                              localResults,
                              userCountryCode,
                            );
                            setSearchResults(prioritizedResults);
                            setShowResults(true);
                            setIsSearching(false);
                            return;
                          }
                        } catch (localError) {
                          logger.warn("Local city search error:", localError);
                        }

                        const data = await searchPlaces(
                          cityName,
                          settings.language,
                          userCountryCode === "US" ? "US" : undefined,
                        );

                        if (data && data.length > 0) {
                          const prioritizedResults = prioritizeResults(
                            data as GeocodeResult[],
                            userCountryCode,
                          );
                          setSearchResults(prioritizedResults);
                          setShowResults(true);
                        } else {
                          setSearchResults([]);
                          setShowResults(false);
                        }
                      } catch (error) {
                        logger.warn("Geocoding error:", error);
                        setSearchResults([]);
                        setShowResults(false);
                      } finally {
                        setIsSearching(false);
                      }
                    }, 500);
                  } else if (cityName.trim().length === 0) {
                    setShowResults(false);
                    setSearchResults([]);
                    onUpdateLocation({
                      manualLatitude: 0,
                      manualLongitude: 0,
                    });
                  } else {
                    setIsSearching(false);
                  }
                }}
                onFocus={() => {
                  if (searchResults.length > 0) setShowResults(true);
                }}
                onBlur={() => {
                  setTimeout(() => setShowResults(false), 300);
                }}
                placeholder={t("settings.location.enterCity")}
                className="w-full bg-pp-button-soft rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30 border border-white/5 focus:border-white/20 transition-colors"
                style={{ backgroundColor: 'var(--pp-button-bg-soft)' }}
              />

              {showResults &&
                searchResults.length > 0 &&
                dropdownPosition &&
                createPortal(
                  <div
                    className="fixed rounded-xl border-2 border-white/20 max-h-64 overflow-y-auto backdrop-blur-md"
                    style={{
                      top: dropdownPosition.top,
                      left: dropdownPosition.left,
                      width: dropdownPosition.width,
                      zIndex: 99999,
                      backgroundColor: 'var(--pp-card-bg)',
                      boxShadow: "0 10px 40px rgba(0,0,0,0.8), 0 4px 20px rgba(0,0,0,0.6)",
                    }}
                  >
                    {searchResults.map((result, index) => {
                      const formattedName = formatResultName(result);
                      return (
                        <button
                          key={index}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectResult(result);
                          }}
                          className="w-full text-start px-4 py-3 transition-colors border-b border-white/10 last:border-b-0 hover:bg-white/5 active:bg-white/10"
                        >
                          <div className="text-sm text-white font-medium">
                            {formattedName}
                          </div>
                          {result.address?.country && (
                            <div className="text-xs text-white/50 mt-0.5">
                              {result.address.country}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>,
                  document.body,
                )}

              {isSearching && (
                <div className="absolute end-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                </div>
              )}
            </div>
          </div>
        )}
      </SettingsCategory>
    </SettingsSubScreen>
  );
}
