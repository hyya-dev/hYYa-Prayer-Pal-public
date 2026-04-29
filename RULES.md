# hYYa Prayer Pal - Important Rules & Guidelines

> [!CAUTION]
> **REDLINE: FORBIDDEN TO BE VIOLATED**
> The following rules and resources are strictly enforced for the hYYa Prayer Pal project. Any AI assistant, developer, or contributor MUST adhere to these guidelines without exception.

## 1. General Rules

- Do not edit file extensions. If any is missing or required, ask the project owner first.
- **Always Enforce Western Arabic numerals** (0, 1, 2, 3...) for all numbers in any language, **no exceptions.**
- The App’s title is **“hYYa Prayer Pal”**. There should be no reference to it simply as “Prayer Pal”. Any translation or branding attempt should strictly follow the positioning and alignment of the existing text “hYYa Prayer Pal”.
- The Arabic translation of the App's title is **"هيّا رفيق الصلاة"**. When displaying or referencing this title alongside **"hYYa Prayer Pal"**, the following formatting and alignment rules apply:
  - **Text direction:** The Arabic string is RTL; wrap it in a `dir="rtl"` element or equivalent so it renders correctly.
  - **Placement:** In LTR layouts, display the Arabic title **to the right of** the English title (e.g., `hYYa Prayer Pal — هيّا رفيق الصلاة`). In stacked/RTL layouts, place it on its own dedicated RTL line beneath or above the English title.
  - **Vertical alignment:** When both titles appear inline on the same line, use **baseline alignment** (`align-items: baseline` or `vertical-align: baseline`).
  - **Font size:** Match the Arabic title font-size exactly to the English title font-size (100% / `1em`); do not scale it up or down.
  - **Padding/mirroring:** Add a small separator (e.g., `0.25em` gap or an em-dash `—`) between the English and Arabic titles. Do **not** mirror or flip the Arabic glyphs.
  - **Inline example:** `<span lang="en">hYYa Prayer Pal</span> — <span lang="ar" dir="rtl">هيّا رفيق الصلاة</span>`
  - **Stacked example:**

    ```html
    <div style="display:flex; flex-direction:column; gap:0.25em;">
      <span lang="en" style="font-size:1em;">hYYa Prayer Pal</span>
      <span lang="ar" dir="rtl" style="font-size:1em;">هيّا رفيق الصلاة</span>
    </div>
    ```

    No separator between lines in a stacked layout; each title is on its own line with matching `font-size:1em` and the Arabic span uses `dir="rtl"`.
  - **Contributor requirement:** Any contributor adding or modifying title translations MUST follow these rules.

## 2. Content & References

- **All references and materials cited on this App MUST BE verified and drawn exclusively from authentic Sunni sources.**
- Machine translation for Quran, Tafseer and Hisn Muslim contents and titles is **strictly forbidden**. Only use the provided/downloaded authenticated (approved by the owner) sources.
  - *Exception:* Only in the case of non-available Surah titles, you may use **NameTransLiterated** as a display fallback.

## 3. Localization

- Machine translation for the App UI is acceptable **by default** for non-proprietary, non-legal, and non-user-generated UI strings (e.g., labels, button text, navigation items) to support all App-supported languages.
- **Owner's consent and an API Key** are required before translating strings that will be shipped/published, contain proprietary or legal content, affect brand messaging, or involve user-generated content. Do not translate, commit, or publish such strings without first obtaining the owner's approval and the provisioned API Key. **String classification rule:** any string containing a brand name, product name, or legal/regulatory term must be treated as requiring consent regardless of context.

### 3.1 Do-not-machine-translate glossary (UI translation pipeline)

- Maintain an explicit **“do not machine translate”** glossary list for Islamic terms and proper nouns.
- This glossary MUST be enforced in the UI translation pipeline (e.g. `scripts/translate-missing-ui-keys.cjs`) by protecting terms before translation and restoring them after.
- Example terms that should remain unchanged (non-exhaustive): `Allah`, `Quran`, `Salah/Salat`, `Fajr`, `Dhuhr`, `Asr`, `Maghrib`, `Isha`, `Adhan`, `Iqamah`, `Qibla`, `Hijri`, `Ramadan`, and the app title `hYYa Prayer Pal` / `هيّا رفيق الصلاة`.

  **Consent & API Key workflow:**
  1. **Request consent** — Open a GitHub Issue or PR using the template below and assign the Issue/PR to the person or team designated as the `localization-owner` (project-defined role) or, if none exists, to a `repo-admin`. Apply the `localization-consent` label.
  2. **Approval is recorded** — The designated reviewer assigned in step 1 (the `localization-owner` or `repo-admin`, as project-defined roles) must respond in the Issue/PR with an approval comment and apply the `consent-granted` label. No other form of approval is valid.
  3. **Obtain the API Key**: After obtaining the user's consent, retrieve the API key from a secure channel (e.g., secrets vault, repo-admin). **WARNING:** The API key must never be committed to the repository, written to logs, or stored in plaintext; it must only be accessed via secure secret management or environment variables.
  4. **Reference:** If a separate process document exists in this repository (e.g., `docs/LOCALIZATION_PROCESS.md`), it supersedes this summary — link to it here when created.

  > **Request template (copy into Issue/PR body):**
  >
  > ```txt
  > **Localization Consent Request**
  > - Strings to translate: [list keys or describe scope]
  > - Target language(s): [list]
  > - Will be shipped/published: yes/no
  > - Contains brand/legal terms: yes/no
  > - Requested by: @[github-handle]
  > ```

## 4. Approved Islamic Resources

When integrating Islamic APIs or content, you MUST use the following approved sources. If there are limitations, ask/suggest and then stop for consent.

### Quran

- [quran-ios](https://github.com/quran/quran-ios)
- [quran_android](https://github.com/quran/quran_android)
- [quran.com-api](https://github.com/quran/quran.com-api)
- [quran.com-frontend-next](https://github.com/quran/quran.com-frontend-next)

### Library / Hisn Muslim

- [haj.gov.sa](https://haj.gov.sa)
- [nusuk.sa](https://www.nusuk.sa)
- [sunnah.com/hisn](https://sunnah.com/hisn)
- [islamhouse.com](https://islamhouse.com/)

### King Fahad Complex

- [qurancomplex.gov.sa/quran-dev/](https://qurancomplex.gov.sa/quran-dev/)

## 5. AI Collaboration & Repository Operations

### 5.1 AI Protocol (Mandatory)

Any AI assistant, tool, or automation interacting with this codebase MUST follow these protocols:

- **Ask Before Tools:** If any tool, extension, skill, or MCP is needed to implement any task, **ask first**. Do not install or configure anything without explicit confirmation.
- **Stop & Ask:** If any instruction is ambiguous, conflicts with existing code, or requires an assumption about intent, **STOP AND ASK**. Do not guess or infer.
- **Conflict Reporting:** When the codebase contains logic that contradicts the rules in this file or [UX_LOGIC.md](docs/UX_LOGIC.md), **report it** with the file name and the nature of the conflict before making any change.
- **Commit/Push:** Do not commit or push any changes unless explicitly asked to do so.

- **STRICT REDLINE:** AI assistants, bots, and automated agents are **STRICTLY FORBIDDEN** from pulling or pushing any code or commits to GitHub (or any remote repository) without the explicit, direct consent and instruction of the user in the immediate prompt.
  - Never auto-deploy, commit, or push changes under any circumstances unless unambiguously told to do so.
  - You MUST stop and ask for permission before executing `git push` or `git pull`.
  - If a Git command could change history or state (e.g., `git rebase`, `git commit --amend`, `git reset --hard`), stop and ask for permission.

## 6. UX Foundation Logic

All UI development, layout, and content sourcing must conform to the **[UX Foundation Logic](docs/UX_LOGIC.md)**.

### Core Redlines

- **Two Language Systems:** NEVER mix UI Language (Chrome) with Curated Translations (Content).
- **RTL/LTR Layout:** Layout direction is driven by UI Language and applied globally at the root level.
- **Typography:** Mandatory **Cairo** font for Arabic. All text must be **White (#FFFFFF)**.

### Category A — Religious Content

- Must be sourced exclusively from approved Sunni resources.
- Must be **bundled with the app** (except Quran audio).
- NO machine translation allowed for religious content.
- **Explicit scope:** Holy Qur'an content (Arabic text and translations), Tafsir content, and HisnMuslim content are strictly forbidden from machine translation. Only use the provided/authenticated sources approved by the owner.

### Category B — Non-Religious Content

- Must be localized using the **Google Cloud Translation API**. Use a secure, environment-defined secret (e.g., `TRANSLATE_API_KEY` or a dedicated secret manager) to provision the key securely. **NEVER** hardcode the API key in the source code or documentation.
- Must be routed through a single, centralized translation service in the codebase.
