import whichCountry from 'which-country';
import iso3ToCountry from '../data/iso3-to-country.json';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';

/**
 * City Search Service
 * Provides efficient city search using the worldcities dataset
 */

export interface City {
  city: string;
  city_local?: string;
  lat: number;
  lng: number;
  country: string;
}

export interface NearestSettlement {
  name: string;
  localName?: string;
  distanceKm: number;
}

interface CityIndex {
  version: string;
  totalCities: number;
  countries: Array<{
    name: string;
    file: string;
    count: number;
    size: number;
  }>;
}

interface CountryData {
  country: string;
  cities: Array<[string, number, number, string?]>;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

// PERFORMANCE FIX: LRU cache for loaded country data with max 10 entries
// This prevents unbounded memory growth when searching across many countries
// Optimized to use O(1) operations instead of O(n) indexOf + splice
const MAX_COUNTRY_CACHE_SIZE = 10;
const countryCache = new Map<string, CountryData>();
const countryCacheOrder = new Map<string, number>(); // Track access order for O(1) lookups
let accessCounter = 0; // Incrementing counter for access order

function cacheCountry(country: string, data: CountryData): void {
  // If already in cache, update access order
  if (countryCache.has(country)) {
    countryCacheOrder.set(country, ++accessCounter);
    countryCache.set(country, data);
    return;
  }
  
  // If cache is full, evict least recently used
  if (countryCache.size >= MAX_COUNTRY_CACHE_SIZE) {
    // Find the entry with the lowest access counter (least recently used)
    let lruCountry: string | null = null;
    let minAccess = Infinity;
    
    for (const [key, access] of countryCacheOrder.entries()) {
      if (access < minAccess) {
        minAccess = access;
        lruCountry = key;
      }
    }
    
    if (lruCountry) {
      countryCache.delete(lruCountry);
      countryCacheOrder.delete(lruCountry);
    }
  }
  
  countryCache.set(country, data);
  countryCacheOrder.set(country, ++accessCounter);
}

function getCachedCountry(country: string): CountryData | undefined {
  const data = countryCache.get(country);
  if (data) {
    // Update access order (most recently used)
    countryCacheOrder.set(country, ++accessCounter);
  }
  return data;
}

// Cache for the index
let indexCache: CityIndex | null = null;

/**
 * Load the cities index
 */
async function loadIndex(): Promise<CityIndex> {
  if (indexCache) {
    return indexCache;
  }

  try {
    const response = await fetchWithTimeout('/data/cities-index.json', {}, 8000);
    if (!response.ok) {
      throw new Error(`Failed to load cities index: ${response.status}`);
    }
    indexCache = await response.json();
    return indexCache!;
  } catch (error) {
    console.error('Error loading cities index:', error);
    throw error;
  }
}

/**
 * Load cities for a specific country
 * Uses LRU cache to limit memory usage
 */
async function loadCountry(country: string): Promise<City[]> {
  // Check LRU cache first
  const cached = getCachedCountry(country);
  if (cached) {
    return convertCountryDataToCities(cached);
  }

  try {
    const index = await loadIndex();
    const countryInfo = index.countries.find(c => c.name === country);
    
    if (!countryInfo) {
      return [];
    }

    const response = await fetchWithTimeout(`/data/${countryInfo.file}`, {}, 8000);
    if (!response.ok) {
      throw new Error(`Failed to load country data: ${response.status}`);
    }

    const countryData: CountryData = await response.json();
    
    // Cache the data with LRU eviction
    cacheCountry(country, countryData);
    
    return convertCountryDataToCities(countryData);
  } catch (error) {
    return [];
  }
}

/**
 * Convert country data format to City array
 */
function convertCountryDataToCities(countryData: CountryData): City[] {
  return countryData.cities.map(cityData => ({
    city: cityData[0],
    lat: cityData[1],
    lng: cityData[2],
    city_local: cityData[3],
    country: countryData.country,
  }));
}

/**
 * Search cities by query string
 * PERFORMANCE FIX: Early exit when we have enough exact/starts-with matches
 * @param query - Search query (city name)
 * @param limit - Maximum number of results (default: 50)
 * @param countryFilter - Optional country name to filter by
 */
export async function searchCities(
  query: string,
  limit: number = 50,
  countryFilter?: string
): Promise<City[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const searchQuery = query.toLowerCase().trim();
  const exactMatches: City[] = [];
  const startsWithMatches: City[] = [];
  const containsMatches: City[] = [];

  try {
    const index = await loadIndex();
    
    // Helper to categorize and add match
    const addMatch = (city: City): boolean => {
      const cityName = city.city.toLowerCase();
      const cityLocal = city.city_local?.toLowerCase() || '';
      
      // Exact match - highest priority
      if (cityName === searchQuery || cityLocal === searchQuery) {
        exactMatches.push(city);
        return true;
      }
      // Starts with - high priority
      if (cityName.startsWith(searchQuery) || cityLocal.startsWith(searchQuery)) {
        startsWithMatches.push(city);
        return true;
      }
      // Contains - lower priority
      if (cityName.includes(searchQuery) || cityLocal.includes(searchQuery)) {
        containsMatches.push(city);
        return true;
      }
      return false;
    };
    
    // Check if we have enough high-quality matches to exit early
    const hasEnoughMatches = () => 
      exactMatches.length + startsWithMatches.length >= limit;
    
    // If country filter is specified, search only that country
    if (countryFilter) {
      const cities = await loadCountry(countryFilter);
      for (const city of cities) {
        addMatch(city);
        if (hasEnoughMatches()) break;
      }
    } else {
      // Search across all countries - sort by size for faster early exit
      const countriesToSearch = index.countries.slice();
      countriesToSearch.sort((a, b) => a.count - b.count);

      for (const countryInfo of countriesToSearch) {
        if (hasEnoughMatches()) break;

        const cities = await loadCountry(countryInfo.name);
        
        for (const city of cities) {
          addMatch(city);
          // Early exit when we have enough high-quality matches
          if (hasEnoughMatches()) break;
        }
      }
    }

    // Combine results in priority order
    return [...exactMatches, ...startsWithMatches, ...containsMatches].slice(0, limit);
  } catch (error) {
    return [];
  }
}

/**
 * Search cities with fuzzy matching and prioritization
 * Prioritizes exact matches and matches at the start of the name
 */
export async function searchCitiesPrioritized(
  query: string,
  limit: number = 50,
  countryFilter?: string
): Promise<City[]> {
  return searchCities(query, limit, countryFilter);
}

/**
 * Get all countries in the dataset
 */
export async function getCountries(): Promise<string[]> {
  const index = await loadIndex();
  return index.countries.map(c => c.name).sort();
}

export async function findNearestSettlement(
  latitude: number,
  longitude: number,
  country?: string,
  countryCode?: string,
): Promise<NearestSettlement | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  try {
    const index = await loadIndex();

    const countryCandidates: string[] = [];
    const addCountryCandidate = (candidate?: string | null) => {
      if (!candidate) return;
      const normalized = candidate.trim().toLowerCase();
      if (!normalized) return;

      const exact = index.countries.find((item) => item.name.toLowerCase() === normalized);
      if (exact && !countryCandidates.includes(exact.name)) {
        countryCandidates.push(exact.name);
        return;
      }

      const fuzzy = index.countries.find((item) =>
        item.name.toLowerCase().includes(normalized) || normalized.includes(item.name.toLowerCase()),
      );
      if (fuzzy && !countryCandidates.includes(fuzzy.name)) {
        countryCandidates.push(fuzzy.name);
      }
    };

    if (countryCode) {
      try {
        const regionName = new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode.toUpperCase());
        addCountryCandidate(regionName);
      } catch {
        // Ignore unsupported country code formatting and continue with other fallbacks.
      }
    }

    if (country) {
      addCountryCandidate(country);
    }

    if (countryCandidates.length === 0) {
      // OFFLINE FALLBACK: Guess country by tiny spatial topology lookup
      try {
        const iso3 = whichCountry([longitude, latitude]);
        if (iso3) {
          const mappedCountryName = iso3ToCountry[iso3 as keyof typeof iso3ToCountry];
          if (mappedCountryName) {
            addCountryCandidate(mappedCountryName);
          } else {
            // Log if mapping fails, but at least we have the iso3
            console.warn(`ISO3 code ${iso3} not found in local mapping.`);
          }
        }
      } catch (e) {
        console.error("whichCountry fallback error", e);
      }

      if (countryCandidates.length === 0) {
        return null;
      }
    }

    let nearest: NearestSettlement | null = null;

    for (const candidateCountry of countryCandidates) {
      const cities = await loadCountry(candidateCountry);
      for (const city of cities) {
        const distanceKm = haversineKm(latitude, longitude, city.lat, city.lng);
        if (!nearest || distanceKm < nearest.distanceKm) {
          nearest = {
            name: city.city,
            localName: city.city_local,
            distanceKm,
          };
        }
      }
    }

    return nearest;
  } catch {
    return null;
  }
}

/**
 * Clear the cache (useful for testing or memory management)
 */
export function clearCache(): void {
  countryCache.clear();
  countryCacheOrder.clear();
  indexCache = null;
}
