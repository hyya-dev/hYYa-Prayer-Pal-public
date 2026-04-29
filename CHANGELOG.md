# Changelog

All notable changes to Prayer Pal will be documented in this file.

## Documentation Archive

- Legacy, root-level release notes are archived at `docs/archive/releases/RELEASE_NOTES_ARCHIVE_v3.1.0_to_v3.2.1.md`.
- Legacy, root-level release work items are archived at `docs/archive/operations/RELEASE_WORK_ITEMS_ARCHIVE.md`.
- Legacy deployment/distribution runbooks are archived at `docs/archive/operations/DEPLOY_AND_DISTRIBUTION_ARCHIVE.md`.

## [3.3.0] - 2026-04-25

### Verification

- ✅ `npx tsc --noEmit` (zero TypeScript errors)
- ✅ `npm test` (vitest) 59/59 tests pass (14 files)
- ✅ `npm run lint` (0 errors, 0 warnings)
- ✅ `npm audit --omit=dev` (0 vulnerabilities)

### Fixed

- iOS App Review hardening: updated `UIRequiredDeviceCapabilities` to `arm64` only.
- Added `NSMotionUsageDescription` to support Qibla compass permission UX/compliance.
- Hardened weather/widget/city fetch paths by introducing shared timeouts (prevents indefinite hangs on flaky networks).
- Privacy hardening: removed IP-based geolocation fallbacks (no calls to `ipwho.is` / `ipapi.co`).

### Changed

- PWA assets: added properly sized icons (`192x192`, `512x512`) and updated manifest references.

## [3.2.1] - 2026-03-09

### Fixed

- Fixed DST handling flow by propagating resolved location IANA timezone into Home prayer card rendering.
- Hardened notification scheduling dedupe logic to reschedule when timezone/DST offset signatures change.
- Fixed KSA Ramadan Isha duplicate notification behavior by suppressing conflicting pre-prayer path during regional exception windows.
- Improved Android/iOS watch-companion temperature/prayer sync reconciliation from cached state.
- Fixed Liquid Glass widget app-name casing to preserve `hYYa Prayer Pal` branding.

### Security

- Completed v3.2.1 repository key-exposure audit across source and `origin/main` with high-confidence token patterns.
- Confirmed no hardcoded live API keys in committed v3.2.1 files.
- Confirmed translation scripts continue to require environment variables (`TRANSLATION_API_KEY`, `GOOGLE_TRANSLATE_API_KEY`) instead of committed keys.

### Versioning

- `package.json`: `3.2.1`
- Android app: `versionName 3.2.1`, `versionCode 49`
- Android Wear app: `versionName 3.2.1`, `versionCode 32009`
- iOS app/widget/watch targets: `MARKETING_VERSION 3.2.1`, `CURRENT_PROJECT_VERSION 7`

## [3.2.0] - 2026-02-26

### Release finalization (2026-03-01)

#### Changed

- Wear OS branding/title placement updated to text-only header on both watch pages (main + counter) with shared top-band positioning.
- Wear OS title localization now uses synced app UI language payload (`settings.payload.strings.appName`) instead of watch system-locale resource fallback.

#### Removed

- Wear OS Tiles feature for this release:
  - Removed tile provider service declaration from `android/wearApp/src/main/AndroidManifest.xml`.
  - Deleted `android/wearApp/src/main/java/com/hyya/prayerpal/wear/tile/PrayerPalTileService.kt`.
  - Removed tile/protolayout dependencies from `android/wearApp/build.gradle`.

#### Versioning

- Android app: `versionName 3.2.0`, `versionCode 48`
- Android Wear app: `versionName 3.2.0`, `versionCode 32008`

#### Build Artifacts

- Generated signed release bundles:
  - `android/All Releases/app-release.aab`
  - `android/All Releases/wearApp-release.aab`

### Post-tag stabilization (2026-02-28)

#### Added

- Added `searchSurahs` service coverage in `src/services/__tests__/quranSearchService.test.ts` (blank-query guard, Arabic/transliteration/translated-name matching, error fallback).
- Added `removeBookmark` service coverage in `src/services/__tests__/quranBookmarkService.test.ts` (successful removal persistence path and no-op path).
- Added `src/js/shared.js` and `src/js/__tests__/shared.test.js` with deterministic DOM cache tests for `SharedUI.getDOMElement`.

#### Security

- Hardened secret handling by ignoring Jules local env secrets via `.gitignore` entries: `jules_config.env` and `jules_config.env.*`.

#### Code Health

- Removed verified-unused imports in:
  - `src/hooks/usePrayerTimes.ts`
  - `src/pages/Index.tsx`
  - `src/hooks/__tests__/usePrayerTimes.test.ts`
  - `src/hooks/useIsIpad.ts`
  - `src/pages/Library.tsx`
  - `src/hooks/library/useLibraryData.ts`

#### Fixed

- Android weather temperature unit now respects device C/F on first install; manual user toggle remains persistent override.
- Wear OS tile discoverability improved by adding broader tile provider binding compatibility in `android/wearApp/src/main/AndroidManifest.xml`.
- Wear data sync listener registration corrected to ensure phone→watch data callbacks are bound reliably.
- Android notification fallback handling hardened to avoid silent pre-prayer-minute drift from missing legacy payload fields.

#### Validation

- ✅ `./gradlew :wearApp:assembleDebug`
- ✅ Type-check diagnostics clean for updated weather temperature unit flow
- ✅ `npx vitest run` (29 tests, 9 files, all passing)

### Changed

- Replaced iPad/tablet Qibla background assets with the new files provided from the designated source folder:
  - `src/assets/ipad/Qibla Sunrise Theme.jpg`
  - `src/assets/ipad/Qibla Afternoon Theme.jpg`
  - `src/assets/ipad/Qibla Sunset Theme.jpg`
- Quran verse search UI now follows Quran content language for search controls (placeholder, clear label, cancel button), independent of UI language.
- Confirmed Quran search matching logic continues to use Quran display language for verse lookup.

### Versioning

- package version: `3.2.0`
- Android app: `versionName 3.2.0`, `versionCode 46`
- Android Wear app: `versionName 3.2.0`, `versionCode 32006`
- iOS app targets: `MARKETING_VERSION 3.2.0`, `CURRENT_PROJECT_VERSION 6`

### Jules Audit Remediation (2026-02-26)

#### Fixed

- **Privacy:** Removed raw latitude/longitude values from console logs in `src/lib/locationHelpers.ts`; replaced with safe region-name-only logging.
- **Code hygiene:** Corrected misleading API-fallback comments in `src/lib/quranAttribution.ts` to reflect the local-only content policy. Removed unused `apiBaseUrl` field.
- **Dead code removal:** Deleted `src/services/quranUpdateService.ts` (299-line unused update-check service that was always disabled via `isApiAvailable() === false`) and its startup call in `src/pages/Index.tsx`.
- **Dead code removal:** Removed `loadLocalWordData()` from `src/services/quranApiService.ts` which attempted to load from a non-existent `public/data/quran/words/` directory.
- **Search optimization:** Simplified `searchCitiesPrioritized()` in `src/services/citySearchService.ts` to delegate directly to `searchCities()`, removing a redundant scoring pass.
- **Reverted:** Incorrect `ms` (Malay) locale fallback in `scripts/download-quran.js` — the Malay Quran translation (Abdullah Muhammad Basmeih) is already curated and bundled.
- **Documentation:** Added provenance comment to `scripts/download-quran.js` noting the `quran-json` package source.

#### Added

- New test file `src/services/__tests__/quranReadingProgressService.test.ts` with 7 tests covering mark/unmark, deduplication, streaks, and corrupted localStorage resilience.

#### Verification

- ✅ `npx tsc --noEmit` (zero errors)
- ✅ `npx vitest run` (21 tests, 6 files, all passing)
- ✅ `npx eslint` on all modified files (clean)

### CodeRabbit Audit Remediation (2026-02-26)

#### Fixed

- Enforced Quran local-only data policy in `src/services/quranApiService.ts`:
  - Removed remote Quran text fallback behavior from runtime fetch paths.
  - Kept Quran retrieval strictly on bundled local files (`/data/quran/**`).
- Added strict Quran bundle guards to reject invalid verse/word payloads instead of silently coercing missing fields to `0`/empty strings.
- Updated `src/components/Quran/PageView.tsx` to always attempt enhanced local word-by-word/page layout loading (no remote availability gate).
- Removed all `react-hooks/exhaustive-deps` suppression comments from `src/hooks/usePrayerTimes.ts` and replaced them with explicit stable dependencies/refs.

#### Compliance Notes

- Quran remote content fallback is intentionally disabled by policy.
- Existing Android build warnings (`wearApp` deprecation + `flatDir`) are unchanged and tracked as non-blocking technical debt for future AGP migration.

#### Verification

- ✅ `npm run lint` passes
- ✅ `npm run test -- --run` passes
- ✅ `npm run build` passes

## [3.1.2] - 2026-02-21

Note: this section includes post-release addenda and is ordered newest-first by implementation date.

### CodeRabbit Remediation Closure (2026-02-25)

#### Fixed

- Closed remaining widget/watch reliability review items across web, iOS, watchOS, and Android.
- Hardened weather sync metrics typing/defaults and separated cache-write failures from sync failures in `widgetService.ts`.
- Eliminated watch weather polling/timer edge cases and improved stale/unknown freshness behavior.
- Updated Android widget broadcast strategy for API 26+ by removing `DATE_CHANGED` manifest reliance and keeping `TIME_SET`/`TIMEZONE_CHANGED` refresh triggers.

#### Documentation

- Reconciled and completed the CodeRabbit execution checklist in `TODO_CodeRabbit_Fixes_v3.1.2.md`.
- Clarified release-note timing wording and normalized verification heading style in changelog sections.

#### Verification

- ✅ TypeScript compile passes (`npx tsc --noEmit`)
- ✅ Production build passes (`npm run build`)
- ✅ Targeted diagnostics show no errors in changed files

### Code Audit Fixes — Security, Performance & Architecture (2026-02-23)

#### Security

- **[P0] Android backup hardening** — Set `android:allowBackup="false"` in `AndroidManifest.xml` to prevent ADB backup extraction of user data (prayer settings, location, bookmarks)
- **[P0] iOS release xcconfig** — Created `ios/release.xcconfig` with `CAPACITOR_DEBUG = false` and wired it into both Release build configurations in `project.pbxproj`, ensuring debug mode is explicitly disabled in production builds

#### Performance

- **[P1] Extracted and memoized `TransliterationDisplay`** — Moved inline component from `VerseReader.tsx` into dedicated `src/components/Quran/TransliterationDisplay.tsx` wrapped with `React.memo` to prevent unnecessary re-renders during verse scrolling
- **[P1] Memoized `SurahList`** — Wrapped Quran surah list (114 items) with `React.memo` to avoid full re-render on parent state changes
- **[P1] Memoized `HisnChapterList`** — Wrapped Hisn Muslim chapter list with `React.memo` for the same optimization
- **[P1] Added React.lazy code splitting** — `WatchPreview` and `NotFound` pages are now lazy-loaded with `Suspense` fallback in `App.tsx`, producing separate chunks confirmed in production build output

#### Architecture

- **[P2] Decomposed `usePrayerTimes` hook** — Reduced from 1507 → 1081 lines by extracting:
  - `src/types/prayerTypes.ts` (54 lines) — shared type definitions
  - `src/lib/locationHelpers.ts` (398 lines) — location validation, IP geolocation, city resolution, storage persistence
  - `src/lib/formatTime.ts` (24 lines) — time formatting utility
  - All exports re-exported from `usePrayerTimes.ts` for full backward compatibility — zero consumer changes required

#### Verification

- ✅ TypeScript compilation: zero errors (`npx tsc --noEmit`)
- ✅ Production build passes (`npx vite build`)
- ✅ All 10 tests pass across 4 test files (`npx vitest run`)
- ✅ Code splitting confirmed: `NotFound` and `WatchPreview` output as separate chunks
- ✅ Deployed and smoke-tested on Samsung S25 Ultra

#### Files Changed

- `android/app/src/main/AndroidManifest.xml` — `allowBackup` set to `false`
- `ios/release.xcconfig` — new file, `CAPACITOR_DEBUG = false`
- `ios/App/App.xcodeproj/project.pbxproj` — added release.xcconfig file reference and wired to Release build configs
- `src/App.tsx` — React.lazy imports with Suspense wrapper
- `src/components/Quran/VerseReader.tsx` — removed inline TransliterationDisplay, imports from new module
- `src/components/Quran/TransliterationDisplay.tsx` — new file, memoized component
- `src/components/Quran/SurahList.tsx` — wrapped with React.memo
- `src/components/Library/HisnChapterList.tsx` — wrapped with React.memo
- `src/hooks/usePrayerTimes.ts` — imports from extracted modules, re-exports for backward compat
- `src/types/prayerTypes.ts` — new file, shared prayer/location types
- `src/lib/locationHelpers.ts` — new file, location utilities
- `src/lib/formatTime.ts` — new file, time formatting

### Prayer Time Calculation Fixes (2026-02-22)

#### Fixed

- **[BUG-1 / Fix A] (Critical) Removed timezone shifting mechanism** that caused a +30 minute prayer time shift worldwide when IANA timezone resolved. Root cause: `getTimezoneOffsetForZone()` returned a RELATIVE offset (~0 when device matched location) but was compared against `getDeviceTimezoneOffset()` which returned an ABSOLUTE UTC offset (e.g., +3 for Riyadh), creating a phantom 3-hour gap that triggered a spurious longitude-based shift via `adjustForLocationTimezone()`. Removed 4 functions: `getTimezoneOffsetFromLongitude()`, `getDeviceTimezoneOffset()`, `getTimezoneOffsetForZone()`, `adjustForLocationTimezone()`. The `adhan` library already returns correct UTC timestamps — per its own docs: "format the times for the correct timezone" using `Intl.DateTimeFormat`, never shift Date objects.
- **[BUG-2 / Fix A] (High) Updated `formatTime()` to support optional IANA timezone** for remote location display via `Intl.DateTimeFormat`, replacing the incorrect Date-shifting approach. Backward-compatible (existing callers continue to work without changes).
- **[BUG-3 / Fix C] (High) Added `countryCode` to widget cache key** in `widgetService.ts`. Previously the cache key was missing `countryCode`, causing Saudi Ramadan Isha exception to persist or flip inconsistently when crossing country boundaries.
- **[BUG-4 / Fix D] (Medium) Removed double `applyRegionalPrayerTimeExceptions()` call** in `usePrayerTimes.ts`. The second call (post-manual-corrections) was overwriting user's manual Isha correction during Saudi Ramadan, resetting it to Maghrib + 2h. Exceptions are now applied once before manual corrections; user corrections take final precedence.
- **[BUG-5 / Fix B] (Medium) Unified widget calculation pipeline** — `calculate365DaysPrayerTimes()` in `widgetService.ts` now receives and applies `manualCorrections`, `daylightSavingOffset`, and `highLatitudeMode` so widget prayer times match the app exactly. Previously the widget pipeline ignored these settings entirely.
- **[BUG-6 / Fix E] (Low) Widget cache key now includes all settings** (`manualCorrections`, `daylightSavingOffset`, `highLatitudeMode`, `countryCode`) — any settings change automatically invalidates the cache and triggers a widget recalculation, eliminating up to 24-hour stale data.

#### Root Cause

- Bug introduced in commit `8b5c3e1` (v3.1.2, "Refactor location badge system") which added `getTimezoneOffsetForZone()`, `locationTimeZone` state, and `resolveIanaTimezone()` async effect. In v3.1.1, only a longitude-based comparison existed (|3.5−3|=0.5 < 1 threshold → no shift → correct). The "correct times flash for 1 second then shift" symptom was caused by the first render using `locationTimeZone=null` (longitude-only fallback, correct), then async IANA resolution completing and triggering the broken IANA code path.

#### Files Changed

- `src/hooks/usePrayerTimes.ts` — Removed timezone shifting functions and decision logic; removed double exception call; updated `formatTime()` signature; updated widget sync to pass all settings; removed `locationTimeZone` from useMemo deps
- `src/services/widgetService.ts` — Added `ManualCorrections` import and `HighLatitudeRule` import; updated `generateCacheKey()`, `needsRecalculation()`, `updateCacheMarkers()` signatures; updated `calculate365DaysPrayerTimes()` to apply manual corrections, DST, and high latitude rules; updated `syncPrayerTimesToWidget()` and `forceSyncPrayerTimesToWidget()` signatures

#### Verification

- ✅ TypeScript compilation: zero errors (`npx tsc --noEmit`)
- ✅ Production build passes (`npm run build`, 2.04s)
- ✅ No lint errors in changed files
- ✅ Shared web layer changes apply to iOS/Android, smartphones/tablets

### Post-Release Visual Edits (2026-02-22)

#### Changed

- Home pull-to-refresh now includes a visible **page-pulling effect** (content moves with finger pull) without spinner animation
- Library chapter-list bookmark/search alignment now follows **Hisn content language direction**:
  - Arabic content: bookmark on the left of search
  - English content: bookmark on the right of search
- Quran chapter-list bookmark/search alignment now follows **Quran content direction**:
  - RTL Quran language: bookmark on the left of search
  - LTR Quran language: bookmark on the right of search
- Replaced `Counter Sunset Theme.jpg` app backgrounds from designated GI template sources:
  - Phone source updated at `src/assets/Counter Sunset Theme.jpg`
  - Tablet/iPad source updated at `src/assets/ipad/Counter Sunset Theme.jpg`

#### Fixed

- Runtime crash on Home introduced during pull-refresh visual implementation (`ReferenceError: Can't find variable: t`) by restoring correct `useTranslation()` destructuring in `HomeView`
- Corrected prior opposite-side bookmark placement regression in both Library and Quran chapter list layouts

#### Verification

- ✅ Shared web layer behavior verified for iOS/Android smartphones/tablets
- ✅ `npm run build` passes
- ✅ `npm run sync:ios` and `npm run sync:android` completed successfully

### Added

- Quran Sajdah indicators across all supported Quran languages, including localized Sajdah labels in verse and page views
- Saudi Arabia Ramadan exception rule for prayer times: Isha is set to Maghrib + 2 hours during Ramadan
- Hijri month localization mapping for 60+ languages to support consistent weather calendar rendering
- **Location badge system** with industry-standard UX: Shows subtle badge ONLY when location quality is imperfect (poor GPS accuracy >100m, network/IP location, cached/manual/offline)
  - 4 simplified localization keys across 60 languages: `location.source.gps`, `location.source.gpsWeak`, `location.source.network`, `location.source.offline`
  - Localhost badge preview available via `?badgePreview=1` query parameter for all 60 language variants
  - Single smart component (`LocationBadge`) replaces redundant duplicate badge displays
- **Weather page Hijri calendar icon** for improved visual recognition
- **New homepage backgrounds** replacing template placeholders:
  - HisnMuslim background (Library page)
  - Quran background (Quran page)
  - Settings background (Settings page)
  - iPad-optimized variants for all backgrounds
- **Widget visual redesign** (iOS & Android, phone & tablet):
  - Replaced all widget background/preview images from PNG to JPG format
  - Enhanced text shadows with layered 3D depth effect for improved readability
  - Updated medium widget layout with optimized container bounds and 22sp/pt text size
  - Space-between distribution for prayer list items

### Changed

- Weather Hijri line now uses locale-native Islamic calendar formatting with RTL-safe rendering and Hijri date correction support
- Weather card now includes calendar icon with RTL/LTR-aware positioning
- Home header location formatting now balances multi-word city names across two lines for better readability
- Settings label clarified to "Date Corrections (Hijri Days)"
- **Removed redundant location confidence label from Header component** – unified into single `LocationBadge` component for consistent UX
- **Theme background mappings** updated to use new backgrounds (removed Template placeholders)
- **Widget assets** converted from PNG to JPG across iOS and Android for optimized file size
- **Medium widget right-container font size** increased by 25% (22sp/pt → 27.5sp/pt iOS/Android) for improved text legibility while maintaining all boundary constraints

### Fixed

- Removed coordinate-only fallback for Saudi prayer exception matching to prevent misclassification in neighboring countries
- Improved Hijri month-name replacement resilience for locale variants with punctuation/diacritics
- **Fixed THREE-BADGE redundancy bug**: Removed duplicate location quality indicators that were appearing simultaneously in Header, error banner, and badge component
- **Audit corrective action**: Repaired corrupted Hijri month entries for Amharic (`am`), Tigrinya (`ti`), and Divehi (`dv`) in `src/lib/hijriTranslations.ts`
- **Widget consistency fixes across all platforms and OS versions**:
  - iOS 17+ medium widget: Fixed temperature positioning (now centered horizontally) and right container boundaries (proper 20pt margin accounting)
  - iOS 16 medium widget: Fixed prayer list positioning to properly account for left margin offset
  - iOS 16/17+ medium widget: Expanded temperature container width to support 6+ characters without truncation across screen sizes
  - iOS 16/17+ medium widget: Reduced drop-shadow intensity for Next Prayer name/time and Temperature for a cleaner visual balance
  - iOS 16/17+ medium widget: Reduced right-side prayer table inter-line gaps by ~10% and shifted the table further downward for clearer visual effect
  - iOS 16/17+ medium widget: Reduced temperature font size by one additional step in medium layout
  - iOS 17+ small widget: Added missing layered shadow effects (dual-shadow for 3D depth)
  - Android medium widget preview: Complete rebuild from corrupted XML state, removed unnecessary IDs
  - Android small widget preview: Updated text sizes to match live widget (22sp/36sp)
  - Android medium widget (live + preview): Expanded temperature container from fixed width to full-width centered bounds with side margins for 6+ character support
  - Android medium widget (live + preview): Reduced drop-shadow intensity for Next Prayer name/time and Temperature to match iOS visual tuning
  - Android medium widget (live + preview): Reduced right-side prayer table inter-line gaps by ~10% and shifted the table further downward
  - Android medium widget (live + preview): Reduced temperature font size by one additional step in medium layout
  - All widgets now render identically across iOS 16/17+, Android, smartphones/tablets
  - Final medium-widget parity pass: mirrored iOS 16/17+ medium behavior and Android medium live spacing + typography updates for consistent rendering on phones and tablets

### Hotfix — Locale-Agnostic Location Pipeline (2026-02-21)

#### Added

- **ISO country code field** (`countryCode`) propagated through the entire location pipeline: `Location`, `ExceptionLocation`, `NearestSettlement` interfaces all carry the ISO 3166-1 alpha-2 code extracted from Nominatim/BigDataCloud geocoding response (`address.country_code`)
- **`hasCountrySignal` guard** in `Index.tsx` — prevents GPS coordinate bounding-box fallback from overriding a known country (ISO code match or English name match take priority)
- **`countryCodeMethodMap`** in `Index.tsx` — maps 16 ISO country codes directly to prayer calculation methods, evaluated before any coordinate-based guess
- **Locale parity telemetry** (`trackLocationLocaleParity`) — stores divergence events to `localStorage` and emits `console.warn` when switching languages causes a different proximity mode for the same coordinates
- **Locale parity regression tests** (`src/i18n/__tests__/locationLocaleParity.test.ts`) — validates all 60 locale JSON files contain the full `locationConfidence.*` key set and a `manual` label
- **Weak-GPS accuracy label** now shows `locationConfidence.gpsWithAccuracy` with meter value when GPS fix has >100 m accuracy

#### Fixed

- **Saudi Ramadan Isha exception** now triggers on `countryCode === 'SA'` first, independent of the user's display language — previously failed silently for Arabic/non-English UI locales
- **Bidi rendering bug** in `Header.tsx`: location text now always falls back through `defaultValue` to `locationConfidence.*` keys, eliminating raw key strings appearing in UI for unsupported locales
- Removed unused `t` import from `Header.tsx`

### Versioning

- package.json: `3.1.1` → `3.1.2`
- Android: `versionName 3.1.2`, `versionCode 38`
- iOS: `MARKETING_VERSION 3.1.2`, `CURRENT_PROJECT_VERSION 4`

## [3.1.1] - 2026-02-19

### Security Fixes (P0)

#### XSS in Quran Search Results

- **Fixed** `dangerouslySetInnerHTML` vulnerability in search result highlighting
- Replaced HTML-string concatenation (`highlightSearchTerm`) with type-safe React component rendering (`getHighlightParts`)
- New `<HighlightedText>` component prevents injection of arbitrary code via search terms
- **Files:** `src/components/Quran/SearchResults.tsx`, `src/services/quranSearchService.ts`, `src/services/hisnSearchService.ts`

#### Hardcoded Quran API Secret

- **Fixed** fallback from hardcoded `'secret'` string to empty string for safer demo mode
- **File:** `src/services/quranApiService.ts`

### Stability Fixes (P1)

#### Unprotected JSON.parse in Prayer Settings

- **Added** try-catch wrapper around `localStorage.getItem()` + `JSON.parse()` in prayer settings initialization
- **Graceful fallback** to `DEFAULT_SETTINGS` if storage data is corrupted or malformed
- Prevents crashes on devices with low storage or corrupted localStorage state
- **File:** `src/hooks/usePrayerTimes.ts`

#### Coordinate Validation in Weather API

- **Added** numeric validation and range clamping for latitude/longitude before weather API URL interpolation
- Latitude: `[-90, 90]`, Longitude: `[-180, 180]`
- Checks `isFinite()` to detect invalid values (NaN, Infinity, undefined)
- Prevents malformed API requests and silent failures
- **File:** `src/hooks/useWeatherSync.ts`

#### Removed Hardcoded Google Translate Keys

- **Removed** hardcoded Google Translate API key from all build scripts
- Scripts now run in bundled-data-only mode with no remote translation fallback
- **Files:** `scripts/generate-all-translations.cjs`, `scripts/translate-widget-descriptions.cjs`, `scripts/translate-prayer-names.cjs`, `scripts/translate-weather-notifications.cjs`, `scripts/verify-surah-names.cjs`

#### Verification

- ✅ Build: `npm run build` passes without TypeScript errors
- ✅ Bundle: Web and native assets created successfully
- ✅ Production dependencies: `npm audit --omit=dev` = 0 vulnerabilities
- ✅ Backward compatible: All UX identical, fixes are internal improvements only

## [3.1.0] - 2026-02-18

### Android Release (Build 34)

#### Fixed

- **Android Widget RTL Layout**
  - Added `android:gravity="left"` + `android:textAlignment="gravity"` to all 6 prayer name TextViews in medium widget and medium preview
  - Added programmatic `setLayoutDirection(View.LAYOUT_DIRECTION_LTR)` in Kotlin for both `updateSmallWidget()` and `updateMediumWidget()`
  - Fixes Arabic prayer names "welding" against times (e.g. "04:56الفجر")

- **Qibla Compass Vertical Centering (iPad/Tablet)**
  - Removed manual compass Y-offset and restored full-height flex centering in iPad/tablet layout
  - Ensures compass is vertically centered on Qibla page for larger screens

#### Changed

- versionCode bumped to 34 for Play Store upload
- Verified store URL identifiers across app flows:
  - iOS App Store ID: `6757415305`
  - Android Package ID: `com.hyya.prayerpal.open`

### iOS & Android (Shared Web Layer)

#### Fixed

- **Quran Font: Oversized Combining Marks**
  - Patched Uthmanic Hafs v20 font to fix oversized white circles (U+06DF, U+06E3, U+06EB, U+06E5, U+06E6)
  - Phase 1: Reclassified glyphs from GDEF "Base" (class 1) to "Mark" (class 3) and set advance width to 0
  - Phase 2: Scaled glyph contours of U+06DF, U+06E3, U+06EB to 35% of original size (1255→440 units)
  - No Quran text data was modified — only the font's internal metadata and outlines
  - Font backup preserved at `public/fonts/uthmanic_hafs_v20.ttf.bak`

- **Settings RTL: hYYa Apps Emoji Position**
  - ✨ emoji now appears to the left of "hYYa Apps" in RTL languages, to the right in LTR

- **Removed Invalid Languages**
  - Removed Chechen (ce), Kannada (kn), and Luganda (lg) from all surfaces: i18n locales, Quran translations, Android strings

#### Changed

- **UI Surface Opacity Increase**
  - Global `--pp-surface-gradient` increased from 60% → 75% opacity (`rgba(20,40,70,0.75)`)
  - `--pp-surface-gradient-strong` increased from 75% → 85%
  - `--pp-surface-gradient-soft` increased from 50% → 60%
  - Affects all blue glass cards across Settings, Library, Quran, and Weather pages

- **Weather Page Button/Card Redesign**
  - Forecast cards: Dark navy glass (`rgba(20,40,70,0.82)`) replacing washed-out gray (`rgba(180,180,180,0.5)`)
  - NowTemp button: Dark frosted navy glass with amber accent text (`text-amber-400`)
  - Day names in `text-amber-100`, conditions in `text-amber-200/70`, temps in bright white
  - Borders: Subtle `border-white/15` frost edge, `backdrop-blur-md`

- **Quran & Library Button Redesign**
  - "Curated Translations" button (Quran) and "English / عربي" button (HisnMuslim): Dark frosted navy glass matching Settings cards
  - Background: `rgba(20,40,70,0.85)` → `rgba(15,30,55,0.92)` gradient
  - Text: Bright `text-amber-400` for high contrast
  - Border: `border-white/15` with `backdrop-blur-md`

- **Settings Translated Strings**
  - Split Settings into 2 sections with new i18n keys translated to 60 languages
  - New keys: `settings.links.quickLinksTitle`, `settings.links.infoSupportTitle`

#### Added

- `scripts/patch-quran-font.py` — Phase 1 font patching (GDEF reclassification + width=0)
- `scripts/patch-quran-font-phase2.py` — Phase 2 font patching (glyph outline scaling)

### iOS Native

- Medium widget: VStack→HStack layout change
- Weather button resize/reposition
- Settings RTL icon/chevron fix
- `.environment(\.layoutDirection, .leftToRight)` on HStack/VStack for widget RTL

### Files Modified

- android/app/build.gradle (versionCode 33→34)
- android/app/src/main/java/com/hyya/prayerpal/PrayerWidgetProvider.kt
- android/app/src/main/res/layout/widget_prayer_medium.xml
- android/app/src/main/res/layout/widget_prayer_medium_preview.xml
- android/app/src/main/res/layout/widget_prayer_small.xml
- android/app/src/main/res/layout/widget_prayer_small_preview.xml
- ios/App/PrayerPalWatch Watch App/Localizable.xcstrings
- ios/App/PrayerPalWidget/Localizable.xcstrings
- ios/App/PrayerPalWidget/PrayerPalWidget.swift
- public/fonts/uthmanic_hafs_v20.ttf (patched font)
- scripts/patch-quran-font.py (new)
- scripts/patch-quran-font-phase2.py (new)
- src/components/Quran/TranslationSelector.tsx
- src/components/SettingsScreen.tsx
- src/components/QiblaCompass.tsx
- src/components/settings/SettingsRow.tsx
- src/index.css
- src/pages/Library.tsx
- src/pages/Weather.tsx
- 60 locale JSON files (new Settings section keys)
- 3 locale files deleted (ce, kn, lg)
- 3 Android strings.xml deleted (ce, kn, lg)
- 3 Quran translation files deleted (ce, kn, lg)

---

## [3.1.0] - 2026-02-14

### Android Release (Build 25)

#### Added

- **Android Notification Localization**
  - Notification channel names/descriptions use Android string resources (`R.string.channel_*`) for system-level translation
  - Notification title/body passed from JS layer via `notificationTitle`/`notificationBody` intent extras
  - Fallback to English defaults if localized strings unavailable
  - Added `channel_discreet_name`, `channel_takbir_name`, `channel_silent_name` + descriptions to `strings.xml`

- **Android Widget Localization (63 languages)**
  - Added localized `values-XX/strings.xml` for 62 non-English locales
  - Widget names and descriptions translated for all supported languages
  - Notification channel strings translated for all supported languages

- **Widget Staleness Compliance**
  - Prayer data staleness threshold: 30 days (was 12 months)
  - Weather temperature staleness: 3 hours — stale temps hidden from widget
  - Weather timestamp (`WEATHER_TIME_KEY`) saved alongside temperature value

- **Android WebView Scroll Fix**
  - Disabled CSS `contain: layout` on Android WebView (`:not(.is-android) #root`)
  - Added `.is-android .overflow-y-auto` compositor fix (`transform: translateZ(0)`)
  - Added `is-android` class injection in both `App.tsx` and `Index.tsx`
  - Prevents magnification bug on Samsung narrow-dp devices (S25 Ultra = 360dp) when scrolling Quran, Library, and Settings pages

- **Android Text Size Inflate Prevention**
  - Added `html { -webkit-text-size-adjust: 100% !important; text-size-adjust: 100% !important }` to prevent WebView text inflation on high-DPI devices

#### Changed

- **Settings Page**: Removed "Allow exact alarms" card (no longer needed)
- **Bottom Navigation**: Changed blur from `backdrop-blur-xl` to `backdrop-blur-2xl` (40px)
- **Share Intent**: Uses `Intent.createChooser(shareIntent, null)` (system default, no hardcoded English)
- **Version**: versionCode 30, versionName 3.1.0

#### Fixed

- **Samsung S25 Ultra Scroll Magnification**
  - Pages with `overflow-y-auto` scroll containers (Quran, Library, Settings) triggered a WebView compositing bug causing content magnification
  - Fix: Disabled `contain: layout` on `#root` for Android, added `translateZ(0)` to scroll containers to force correct compositing layers
  - Nav containment also disabled on Android (`is-android nav { contain: none !important }`)

### iOS Release

#### Fixed

- **Settings UI Language Subpage Gap**
  - Fixed ~3cm visual gap between back button and language cards on iPhone
  - Root cause: `perspective(800px) rotateX(2deg)` 3D transform on SettingsCategory displaced the top edge of the tall 63-language list
  - Added `noTransform` prop to SettingsCategory to disable perspective on tall/scrollable card lists
  - Applied `noTransform` to UI Language subpage

- **iOS Layout Fixes**
  - Fixed Home counter button clipping behind navigation bar on iOS
  - Adjusted mascot spacer height to maintain proper spacing
  - Counter button now has consistent 1cm gap from bottom navigation
- **Qibla Compass Positioning**
  - Repositioned compass to -0.5cm offset for better visual alignment on iOS
- **Quran Page Title Consistency**
  - Added Surah subtitle below "Quran" header for consistency with HisnMuslim layout
  - Removed duplicate Surah title displays from all content areas (VerseReader, PageView, ContinuousScrollView, SplitScreenView)
  - Surah name now appears only once in the header subtitle
- **Settings Sticky Headers**
  - Back button now remains sticky during scroll in Settings subpages for better UX
- **HisnMuslim Navigation**
  - Fixed blank screen toggle bug when switching between list and reader views
  - Improved navigation state management for chapter list/reader toggle
- **Content Language**
  - Removed all Indonesian content from HisnMuslim chapters (132 chapter files updated)
  - Updated HisnLanguage type to support only 'ar' and 'en'
  - All Indonesian language references removed from codebase

### Technical Details

- All Quran reading modes now have consistent header layout without title duplication
- HisnMuslim navigation logic using sessionStorage for reliable view state
- CSS variables optimized for iOS safe area handling
- Build process verified and synced to iOS

### Files Modified

- src/components/SettingsScreen.tsx
- src/components/settings/SettingsCategory.tsx
- src/components/settings/SettingsSubScreen.tsx
- src/pages/Quran.tsx
- src/pages/Library.tsx
- src/pages/Index.tsx
- src/components/HomeView.tsx
- src/components/QiblaCompass.tsx
- src/components/Quran/VerseReader.tsx
- src/components/Quran/PageView.tsx
- src/components/Quran/ContinuousScrollView.tsx
- src/components/Quran/SplitScreenView.tsx
- src/components/settings/SettingsSubScreen.tsx
- src/index.css
- src/hooks/useLibraryNavigation.ts
- src/hooks/useLibraryData.ts
- src/hooks/useAppSettings.ts
- 132 HisnMuslim chapter files (public/data/hisn/chapters/)
- Multiple type definition files

### Added

- **Widget + Watch Localization**
  - Added localized widget and watch strings across all 63 languages
  - Widget now reads localized app name and prompts from App Group
  - Watch now displays localized prayer names and waiting message
  - Translated prayer names with curated Islamic transliterations for 58 non-English languages
  - Translated widget gallery description (`widget.description`) for all 62 non-English locales via Google Cloud Translation API
  - App title "hYYa Prayer Pal" enforced as untranslated across all locale files, `widgetService.ts`, and `generate-xcstrings.cjs`

### Changed

- **iOS UIScene Lifecycle**
  - Adopted scene-based lifecycle for forward compatibility
- **Widget Sync Efficiency**
  - Added debounced message queue and change detection for widget sync
  - Throttled foreground weather sync and deduped repeated payloads
  - Moved dedup hash storage to after successful native sync to prevent silent failures
- **Language Detection**
  - Unified language detection with new `getInitialLanguage()` function in `i18n/index.ts`
  - Priority: appSettings.language → i18nextLng localStorage → device language
  - Removed `startTransition` from language change in `Index.tsx` to prevent race conditions
- **Language Ordering**
  - Reordered UI and Quran language lists by popularity (Arabic, English, then most common languages)
- **Widget Day Transition**
  - Uses last prayer (Isha) for day transition scheduling to avoid localization edge cases
- **Widget Decode Error Logging**
  - Replaced `try?` with `do/catch` + `print()` in `PrayerPalWidget.swift` for decode errors
- **App Store BCP47 Compliance**
  - Removed invalid BCP47 locale codes `ber` (Berber) and `yau` (Yau) from iOS native surfaces (Info.plists, project.pbxproj, xcstrings)
  - Web layer retains these locales — only excluded from native .lproj generation
  - `generate-xcstrings.cjs` now skips `SKIP_IOS_LOCALES` when building xcstrings

### TestFlight Bug Fixes (Batch 3)

- **HisnMuslim Language Toggle Redesign**
  - Replaced small GlassButton icon with QiblaButton-styled oval button (rounded-full, amber border, gradient background, glass highlights)
  - Language toggle is now horizontally centered above the bookmark button in chapter list view
  - Button text displays "English / عربي" translated into all 63 supported App UI languages
  - Added `library.hisnLanguageToggle` i18n key to all 63 locale files with proper native translations

- **Quran Translation Selector Redesign**
  - Replaced compact GlassButton icon with QiblaButton-styled oval button displaying localized "Curated Translations" text
  - Button is now horizontally centered above the surah list content
  - Dropdown menu fixed: removed conflicting `relative`/`absolute` CSS classes that caused the dropdown to push page content below the navbar
  - Dropdown now properly overlays as a floating menu centered under the button

- **Quran Full-Size Dropdown CSS Fix**
  - Fixed remaining `absolute`/`relative` conflict on the full-size translation dropdown (non-compact mode)
  - Added inner `<div className="relative">` wrapper for glass overlay positioning without conflicting with outer `absolute` positioning

### Android

- versionCode bumped to 30 for Play Store upload

### Files Modified (TestFlight Batch 3)

- src/pages/Library.tsx (language toggle redesign + repositioning)
- src/pages/Quran.tsx (translation selector repositioning)
- src/components/Quran/TranslationSelector.tsx (oval button styling + dropdown fix for both compact and full-size modes)
- android/app/build.gradle (versionCode 29 → 30)
- All 63 locale files (added `library.hisnLanguageToggle` with native translations)

### TestFlight Bug Fixes (Batch 2)

- **Weather Page Language Revert**
  - Weather conditions and day names no longer revert to English after brief correct display
  - Root cause: hardcoded `WEATHER_CONDITIONS_TRANSLATIONS` map covered only 7 of 63 languages; any other language fell through to English
  - Replaced 230 lines of hardcoded translation maps with `i18next.t()` calls for all 63 languages
  - Day names now use `i18next.t('weather.today')` / `i18next.t('weather.tomorrow')` + `Intl.DateTimeFormat` for weekday names
  - Added 28 `weather.conditions.*` keys and `weather.today` / `weather.tomorrow` to all 63 locale files

- **Notification Banners Follow UI Language**
  - Prayer time notification banners now display in the user's selected UI language on iPhone, iPad, and Apple Watch
  - Root cause: hardcoded English strings like `"${prayer.displayName} Prayer Time"` in `useNotifications.ts`
  - Notifications now use `i18next.t('prayers.${prayer.name}')` for translated prayer names
  - Added 4 `notificationBanner.*` i18n keys with `{{prayer}}`/`{{minutes}}` interpolation to all 63 locale files
  - Added `language` to notification scheduling key so notifications re-schedule automatically on language change

- **Quran Page Title RTL Alignment**
  - Quran page header title alignment now follows UI language direction, not Quran content language
  - Root cause: `titleAlign` prop was derived from `displayLanguage` (Quran content toggle), not UI language
  - Removed `titleAlign` override from `<Header>` — Header's own `i18n.language`-based RTL logic now applies correctly

### Files Modified (TestFlight Batch 2)

- src/hooks/useWeather.ts (rewritten: 366 → 136 lines)
- src/hooks/useNotifications.ts
- src/hooks/useNotificationScheduling.ts
- src/pages/Quran.tsx
- src/i18n/locales/en.json (added weather + notification keys)
- All 62 non-English locale files (weather conditions, day names, notification banners translated)
- scripts/translate-weather-notifications.cjs (new — batch translation script)

## [3.0.0] - Previous Release

[Earlier versions...]
