export type TafsirLanguage = "arabic" | "bengali" | "english" | "russian" | "urdu";

/** BCP 47 / HTML `lang` for CSS `:lang()` font stacks (e.g. Cairo for Arabic script). */
export function tafsirCatalogLanguageToHtmlLang(language: TafsirLanguage): string {
  switch (language) {
    case "arabic":
      return "ar";
    case "urdu":
      return "ur";
    case "bengali":
      return "bn";
    case "russian":
      return "ru";
    case "english":
    default:
      return "en";
  }
}

export type TafsirCatalogItem = {
	id: string;
	name: string;
	namesByLanguage?: Partial<Record<TafsirLanguage, string>>;
	languages: TafsirLanguage[];
	sources: Array<{ language: TafsirLanguage; resourceId: number }>;
};

export type TafsirResourceRow = {
	id: number;
	sura_no: number;
	aya_no: number;
	aya_tafseer: string;
	verse_key?: string;
	resource_id?: number;
	language_id?: number;
	sura_name_en?: string;
	sura_name_ar?: string;
};

// Bundled tafsir payload currently available in this app build.
// All curated resources from Tafsir Library are now bundled in public/data/tafsir/resource-{id}.json
export const BUNDLED_TAFSIR_RESOURCE_IDS = new Set<number>([14, 15, 16, 90, 91, 93, 94, 159, 160, 164, 165, 166, 168, 169, 170, 381, 817]);

export function getTafsirDisplayName(item: TafsirCatalogItem, language: TafsirLanguage): string {
	return item.namesByLanguage?.[language] ?? item.name;
}

export function hasBundledTafsirContent(item: TafsirCatalogItem, language: TafsirLanguage): boolean {
	const source = item.sources.find((s) => s.language === language);
	return !!source && BUNDLED_TAFSIR_RESOURCE_IDS.has(source.resourceId);
}

export async function loadTafsirByResourceId<T = unknown>(resourceId: number): Promise<T> {
	try {
		const res = await fetch(`/data/tafsir/resource-${resourceId}.json`);
		if (!res.ok) throw new Error(`Failed to load resource ${resourceId} (${res.status})`);
		const data = (await res.json()) as T;
		return data;
	} catch (err) {
		console.error(`Error loading tafsir resource ${resourceId}:`, err);
		throw err;
	}
}

export const TAFSIR_LANGUAGES: Array<{ code: TafsirLanguage; label: string }> = [
	{ code: "arabic", label: "Arabic" },
	{ code: "bengali", label: "Bengali" },
	{ code: "english", label: "English" },
	{ code: "russian", label: "Russian" },
	{ code: "urdu", label: "Urdu" },
];

export const TAFSIR_CATALOG: TafsirCatalogItem[] = [
	{
		id: "ibn-kathir-abridged",
		name: "Ibn Kathir (Abridged)",
		namesByLanguage: {
			english: "Ibn Kathir (Abridged)",
		},
		languages: ["english"],
		sources: [{ language: "english", resourceId: 169 }],
	},
	{
		id: "tafsir-ibn-kathir",
		name: "Tafsir Ibn Kathir",
		namesByLanguage: {
			arabic: "تفسير ابن كثير",
			urdu: "تفسیر ابن کثیر",
		},
		languages: ["arabic", "urdu"],
		sources: [
			{ language: "arabic", resourceId: 14 },
			{ language: "urdu", resourceId: 160 },
		],
	},
	{
		id: "tafsir-ibn-kathir-bengali",
		name: "Tafsir ibn Kathir (Tawheed Publication)",
		namesByLanguage: {
			bengali: "তাফসীর ইবনে কাসীর (তাওহীদ পাবলিকেশন)",
		},
		languages: ["bengali"],
		sources: [{ language: "bengali", resourceId: 164 }],
	},
	{
		id: "tafsir-al-tabari",
		name: "Tafsir al-Tabari",
		namesByLanguage: {
			arabic: "تفسير الطبري",
		},
		languages: ["arabic"],
		sources: [{ language: "arabic", resourceId: 15 }],
	},
	{
		id: "al-qurtubi",
		name: "Al-Qurtubi",
		namesByLanguage: {
			arabic: "القرطبي",
		},
		languages: ["arabic"],
		sources: [{ language: "arabic", resourceId: 90 }],
	},
	{
		id: "tafsir-al-baghawi",
		name: "Tafsir Al-Baghawi",
		namesByLanguage: {
			arabic: "تفسير البغوي",
		},
		languages: ["arabic"],
		sources: [{ language: "arabic", resourceId: 94 }],
	},
	{
		id: "al-sadi",
		name: "Al-Sa'di",
		namesByLanguage: {
			arabic: "تفسير السعدي",
			russian: "Ас-Саади",
		},
		languages: ["arabic", "russian"],
		sources: [
			{ language: "arabic", resourceId: 91 },
			{ language: "russian", resourceId: 170 },
		],
	},
	{
		id: "tafsir-muyassar",
		name: "Tafsir Muyassar",
		namesByLanguage: {
			arabic: "التفسير الميسر",
		},
		languages: ["arabic"],
		sources: [{ language: "arabic", resourceId: 16 }],
	},
	{
		id: "maarif-al-quran",
		name: "Ma'arif al-Qur'an",
		namesByLanguage: {
			english: "Ma'arif al-Qur'an",
			urdu: "معارف القرآن",
		},
		languages: ["english"],
		sources: [{ language: "english", resourceId: 168 }],
	},
	{
		id: "al-tafsir-al-wasit",
		name: "Al-Tafsir al-Wasit (Tantawi)",
		namesByLanguage: {
			arabic: "التفسير الوسيط (طنطاوي)",
		},
		languages: ["arabic"],
		sources: [{ language: "arabic", resourceId: 93 }],
	},
	{
		id: "tafsir-fathul-majid",
		name: "Tafsir Fathul Majid",
		namesByLanguage: {
			bengali: "তাফসীর ফাতহুল মজীদ",
		},
		languages: ["bengali"],
		sources: [{ language: "bengali", resourceId: 381 }],
	},
	{
		id: "tafsir-ahsanul-bayaan",
		name: "Tafsir Ahsanul Bayaan",
		namesByLanguage: {
			bengali: "তাফসীর আহসানুল বয়ান",
		},
		languages: ["bengali"],
		sources: [{ language: "bengali", resourceId: 165 }],
	},
	{
		id: "tafsir-abu-bakr-zakaria",
		name: "Tafsir Abu Bakr Zakaria",
		namesByLanguage: {
			bengali: "তাফসীর আবু বকর যাকারিয়া",
		},
		languages: ["bengali"],
		sources: [{ language: "bengali", resourceId: 166 }],
	},
	{
		id: "bayan-ul-quran",
		name: "Bayan ul Quran",
		namesByLanguage: {
			urdu: "بیان القرآن",
		},
		languages: ["urdu"],
		sources: [{ language: "urdu", resourceId: 159 }],
	},
	{
		id: "tazkirul-quran",
		name: "Tazkirul Quran",
		namesByLanguage: {
			english: "Tazkirul Quran",
			urdu: "تذکیر القرآن",
		},
		languages: ["english"],
		sources: [{ language: "english", resourceId: 817 }],
	},
];
