# hYYa Prayer Pal (Source)

[![GitHub stars](https://img.shields.io/github/stars/hyya-dev/hYYa-Prayer-Pal-public?style=social)](https://github.com/hyya-dev/hYYa-Prayer-Pal-public/stargazers)

## Sadaqah Jariyah Intent 🤲

This repository is provided as **Sadaqah Jariyah** (continuous charity). The architecture, religious logic, and knowledge contained herein are shared with the global community to foster learning and charitable adaptations.

**Strictly Non-Commercial:** Commercial cloning, repackaging, or utilizing this codebase for monetary profit is strictly prohibited. Please refer to the `LICENSE` file for full CC BY-NC-SA 4.0 terms and the `ASSETS_NOTICE.txt` regarding proprietary branding restrictions.

---

## ⭐ Support the Mission

If you find this architecture or the religious resources helpful, please consider giving this repository a **Star** (⭐). Your support functions as social proof and helps increase the project's visibility in GitHub's search algorithms, allowing more developers to discover, learn from, and benefit from this *Sadaqah Jariyah* initiative.

---

## 📱 Supported Devices & Testing

The application UI/UX has been thoroughly vetted, tested, and optimized for modern flagship displays. Primary testing environments include:

- **iPhone 17 Pro Max**
- **iPad Pro M4 11"**
- **Samsung Galaxy S25 Ultra**

### ⚡ Call for Performance Benchmarks

We invite the community to share real-world performance benchmarks using the flagship devices listed above. Given our usage of `react-virtuoso` for 120Hz scrolling and `sql.js`/IndexedDB for complex offline-first queries, your technical metrics (e.g., frame drop rates during heavy list scrolling, database search query speeds, and memory profiling) are highly valuable.

If you have technical benchmark data to share, please open an issue with the `[BENCHMARK]` tag to help us continually refine the architecture.

---

## 🏗 Architecture

This application utilizes a modern web-to-native stack powered by **React**, **Vite**, and **Capacitor v8**. The codebase follows a strict **Clean Architecture / MVVM (Model-View-ViewModel)** pattern:

- **View (`src/components`, `src/pages`):** Stateless and styled heavily with Tailwind CSS, reacting directly to the ViewModel.
- **ViewModel (`src/hooks`):** Custom React hooks orchestrate the state, bridge the UI to the underlying services, and manage the component lifecycle.
- **Model / Services (`src/services`, `src/lib`):** The core business logic resides here. This includes local database transactions, API fetching, geolocation tracking, and complex religious calculations (utilizing `@quranjs/api` and `adhan`).
- **Data Persistence:** Offline-first capability is prioritized using local instances of `IndexedDB` (`idb`), `SQLite` via `sql.js`, and Capacitor Preferences.

---

## 🛠 Setup & Installation

### Prerequisites

- Node.js (v18+)
- npm or yarn
- Capacitor CLI
- iOS: Xcode (for iOS builds)
- Android: Android Studio (for Android builds)

### 1. Install Dependencies

Clone the repository and install the NPM packages:

```bash
npm install
```

### 2. Environment Configuration

Create a `.env` file at the root of the project to add your own API configurations.

**Google Cloud Translation API:**
The backend proxy (located in `api/translate.ts`) requires a Google Cloud API key to operate correctly. You must supply your own API key:

```env
GOOGLE_TRANSLATE_API_KEY=your_google_translate_api_key_here
```

*(Note: There are no Firebase configurations required for this open-source variant, as they have been intentionally excluded).*

### 3. Run Development Server

To run the web instance locally:

```bash
npm run dev
```

### 4. Build and Sync for Native (iOS/Android)

To build the application and sync your web assets into the native Capacitor project:

```bash
npm run build
npx cap sync
```

You can then open the respective native IDEs to compile and run on physical devices or emulators:

```bash
npx cap open ios
npx cap open android
```
