/**
 * Hijri Month Translations
 * Localized month names for all 12 Islamic calendar months across 60+ languages.
 * This cache maps Hijri months into localized strings for calendar display.
 */

export const HIJRI_MONTHS_ENGLISH = [
  "Muharram",
  "Safar",
  "Rabi al-awwal",
  "Rabi al-thani",
  "Jumada al-awwal",
  "Jumada al-thani",
  "Rajab",
  "Sha'ban",
  "Ramadan",
  "Shawwal",
  "Dhu al-Qi'dah",
  "Dhu al-Hijjah",
];

/**
 * Localized Hijri month names.
 * Key format: "ISO639-code" or "ISO639-code-Region"
 * Values: array of 12 month names in order (Muharram → Dhu al-Hijjah)
 *
 * This object is used to localize the Hijri calendar display across all supported languages.
 * Entries with English fallback will use HIJRI_MONTHS_ENGLISH if not explicitly translated.
 */
export const HIJRI_MONTHS_LOCALIZED: Record<string, string[]> = {
  // Arabic - covering all Arabic dialects
  ar: [
    "محرم",
    "صفر",
    "ربيع الأول",
    "ربيع الثاني",
    "جمادى الأولى",
    "جمادى الثانية",
    "رجب",
    "شعبان",
    "رمضان",
    "شوال",
    "ذو القعدة",
    "ذو الحجة",
  ],

  // Urdu
  ur: [
    "محرم",
    "صفر",
    "ربیع الاول",
    "ربیع الثانی",
    "جمادی الاولیٰ",
    "جمادی الثانیہ",
    "رجب",
    "شعبان",
    "رمضان",
    "شوال",
    "ذو القعدہ",
    "ذو الحجہ",
  ],

  // Persian/Farsi
  fa: [
    "محرم",
    "صفر",
    "ربیع‌الاول",
    "ربیع‌الثانی",
    "جمادی‌الاولی",
    "جمادی‌الثانیه",
    "رجب",
    "شعبان",
    "رمضان",
    "شوال",
    "ذوالقعده",
    "ذوالحجه",
  ],

  // Turkish
  tr: [
    "Muharrem",
    "Safar",
    "Rebi'ülewnvel",
    "Rebi'üsani",
    "Cumadâ'l-ula",
    "Cumadâ'l-ahire",
    "Receb",
    "Şaban",
    "Ramazan",
    "Şevval",
    "Zi'l-ka'de",
    "Zi'l-hicce",
  ],

  // Indonesian/Malay
  id: [
    "Muharram",
    "Safar",
    "Rabi' al-awwal",
    "Rabi' al-thani",
    "Jumada al-awwal",
    "Jumada al-thani",
    "Rajab",
    "Sha'ban",
    "Ramadan",
    "Shawwal",
    "Dhul-Qi'dah",
    "Dhul-Hijjah",
  ],

  ms: [
    "Muharram",
    "Safar",
    "Rabi' al-awwal",
    "Rabi' al-thani",
    "Jumada al-awwal",
    "Jumada al-thani",
    "Rajab",
    "Sha'ban",
    "Ramadan",
    "Shawwal",
    "Dhul-Qi'dah",
    "Dhul-Hijjah",
  ],

  // Bengali
  bn: [
    "মুহাররাম",
    "সফর",
    "রবি আল-আওয়াল",
    "রবি আল-থানি",
    "জুমাদা আল-আওয়াল",
    "জুমাদা আল-থানি",
    "রজব",
    "শা'বান",
    "রমজান",
    "শাওয়াল",
    "ধু আল-কি'দাহ",
    "ধু আল-হিজ্জাহ",
  ],

  // Gujarati
  gu: [
    "મુહર્રમ",
    "સફર",
    "રબીઉલ-અવલ",
    "રબીઉસ-સાનીયો",
    "જુમાદા-અલ-અવલ",
    "જુમાદા-અલ-સાનીયો",
    "રજબ",
    "શાબાન",
    "રમજાન",
    "શવવાલ",
    "ધુલ-કિયादો",
    "ધુલ-હિજજો",
  ],

  // Hindi
  hi: [
    "मुहर्रम",
    "सफर",
    "रबी अल-अव्वल",
    "रबी अल-सानी",
    "जुमादा अल-अव्वल",
    "जुमादा अल-सानी",
    "रजब",
    "शा'बान",
    "रमजान",
    "शव्वाल",
    "धु अल-क़ि'दा",
    "धु अल-हिज्जा",
  ],

  // Tamil
  ta: [
    "முஹர்ரம்",
    "சஃபர்",
    "ரபீ அல்-அவ்வல்",
    "ரபீ அல்-தாணீ",
    "ஜுமாதா அல்-அவ்வல்",
    "ஜுமாதா அல்-தாணீ",
    "ரஜப்",
    "ஷ'பான்",
    "இராமளான்",
    "ஷவ்வால்",
    "து அல்-கிஃதா",
    "து அல்-ஹிஜ்ஜா",
  ],

  // Telugu
  te: [
    "ముహర్రం",
    "సఫర్",
    "రబీ అల్-అవ్వల్",
    "రబీ అల్-థానీ",
    "జుమాదా అల్-అవ్వల్",
    "జుమాదా అల్-థానీ",
    "రజబ్",
    "శా'బాన్",
    "రమజాన్",
    "శవ్వాల్",
    "ధు అల్-కిదా",
    "ధు అల్-హిజ్జా",
  ],

  // Marathi
  mr: [
    "मुहर्रम",
    "सफर",
    "रबी अल-अव्वल",
    "रबी अल-सानी",
    "जुमादा अल-अव्वल",
    "जुमादा अल-सानी",
    "रजब",
    "शा'बान",
    "रमजान",
    "शव्वाल",
    "धु अल-क़ि'दा",
    "धु अल-हिज्जा",
  ],

  // Assamese
  as: [
    "মুহাৰ্ৰম",
    "ছফৰ",
    "ৰবী আল-আৱ্ৱল",
    "ৰবী আল-সানী",
    "জুমাদা আল-আৱ্ৱল",
    "জুমাদা আল-সানী",
    "ৰজব",
    "শাবান",
    "ৰমজান",
    "শৱ্ৱাল",
    "ধু আল-কিদা",
    "ধু আল-হিজ্জা",
  ],

  // Pashto
  ps: [
    "محرم",
    "صفر",
    "ربيع الاول",
    "ربيع الثاني",
    "جمادى الاول",
    "جمادى الثاني",
    "رجب",
    "شعبان",
    "رمضان",
    "شوال",
    "ذو القعدة",
    "ذو الحجة",
  ],

  // Kurmanji Kurdish
  ku: [
    "Muharrem",
    "Safar",
    "Rêbîendûn",
    "Rêbîenîtevm",
    "Cumadilûwlî",
    "Cumadilthânî",
    "Receb",
    "Şebân",
    "Ramazan",
    "Şevval",
    "Zulqa'ide",
    "Zulhicce",
  ],

  // German
  de: [
    "Muharram",
    "Safar",
    "Rabi' al-awwal",
    "Rabi' al-thani",
    "Jumada al-awwal",
    "Jumada al-thani",
    "Rajab",
    "Sha'ban",
    "Ramadan",
    "Shawwal",
    "Dhu al-Qi'dah",
    "Dhu al-Hijjah",
  ],

  // French
  fr: [
    "Mouharram",
    "Safar",
    "Rabi' al-awwal",
    "Rabi' al-thani",
    "Joumada al-awwal",
    "Joumada al-thani",
    "Rajab",
    "Cha'ban",
    "Ramadan",
    "Chawwal",
    "Dhou al-Qi'dah",
    "Dhou al-Hijjah",
  ],

  // Spanish
  es: [
    "Muharram",
    "Safar",
    "Rabi' al-awwal",
    "Rabi' al-thani",
    "Jumada al-awwal",
    "Jumada al-thani",
    "Rajab",
    "Sha'ban",
    "Ramadán",
    "Shawwal",
    "Dhu al-Qi'dah",
    "Dhu al-Hijjah",
  ],

  // Portuguese
  pt: [
    "Muharram",
    "Safar",
    "Rabi' al-awwal",
    "Rabi' al-thani",
    "Jumada al-awwal",
    "Jumada al-thani",
    "Rajab",
    "Sha'ban",
    "Ramadã",
    "Shawwal",
    "Dhu al-Qi'dah",
    "Dhu al-Hijjah",
  ],

  // Italian
  it: [
    "Muharram",
    "Safar",
    "Rabi' al-awwal",
    "Rabi' al-thani",
    "Jumada al-awwal",
    "Jumada al-thani",
    "Rajab",
    "Sha'ban",
    "Ramadan",
    "Shawwal",
    "Dhu al-Qi'dah",
    "Dhu al-Hijjah",
  ],

  // Dutch
  nl: [
    "Muharram",
    "Safar",
    "Rabi' al-awwal",
    "Rabi' al-thani",
    "Jumada al-awwal",
    "Jumada al-thani",
    "Rajab",
    "Sha'ban",
    "Ramadan",
    "Shawwal",
    "Dhu al-Qi'dah",
    "Dhu al-Hijjah",
  ],

  // Polish
  pl: [
    "Muharram",
    "Safar",
    "Rabi' al-awwal",
    "Rabi' al-thani",
    "Jumada al-awwal",
    "Jumada al-thani",
    "Rajab",
    "Sha'ban",
    "Ramadan",
    "Shawwal",
    "Dhu al-Qi'dah",
    "Dhu al-Hijjah",
  ],

  // Russian
  ru: [
    "Мухаррам",
    "Сафар",
    "Раби аль-авваль",
    "Раби аль-тани",
    "Джумада аль-авваль",
    "Джумада аль-тани",
    "Раджаб",
    "Шаабан",
    "Рамадан",
    "Шавваль",
    "Зу аль-Ка'да",
    "Зу аль-Хиджжа",
  ],

  // Ukrainian
  uk: [
    "Мухаррам",
    "Сафар",
    "Рабі аль-авваль",
    "Рабі аль-тані",
    "Джумада аль-авваль",
    "Джумада аль-тані",
    "Раджаб",
    "Шаабан",
    "Рамадан",
    "Шавваль",
    "Зу аль-Ка'да",
    "Зу аль-Хиджжа",
  ],

  // Bulgarian
  bg: [
    "Мухаррам",
    "Сафар",
    "Раби ал-авал",
    "Раби ас-сани",
    "Джумада ал-авал",
    "Джумада ас-сани",
    "Раджаб",
    "Шабан",
    "Рамадан",
    "Шавал",
    "Ду ал-Кида",
    "Ду ал-Хиджа",
  ],

  // Romanian
  ro: [
    "Muharram",
    "Safar",
    "Rabi' al-awwal",
    "Rabi' al-thani",
    "Jumada al-awwal",
    "Jumada al-thani",
    "Rajab",
    "Sha'ban",
    "Ramadan",
    "Shawwal",
    "Dhu al-Qi'dah",
    "Dhu al-Hijjah",
  ],

  // Hungarian - not in language list but including for robustness
  // hu: [HIJRI_MONTHS_ENGLISH (fallback)]

  // Czech - not in language list but including for robustness
  // cs: [HIJRI_MONTHS_ENGLISH (fallback)]

  // Swedish
  sv: [
    "Muharram",
    "Safar",
    "Rabi' al-awwal",
    "Rabi' al-thani",
    "Jumada al-awwal",
    "Jumada al-thani",
    "Rajab",
    "Sha'ban",
    "Ramadan",
    "Shawwal",
    "Dhu al-Qi'dah",
    "Dhu al-Hijjah",
  ],

  // Norwegian - not in language list
  // no: [HIJRI_MONTHS_ENGLISH (fallback)]

  // Danish - not in language list
  // da: [HIJRI_MONTHS_ENGLISH (fallback)]

  // Finnish - not in language list
  // fi: [HIJRI_MONTHS_ENGLISH (fallback)]

  // Greek - not in language list
  // el: [HIJRI_MONTHS_ENGLISH (fallback)]

  // Hebrew
  he: [
    "מוהאראם",
    "סאפר",
    "ראבי אל-אוואל",
    "ראבי אל-תני",
    "ג'ומאדה אל-אוואל",
    "ג'ומאדה אל-תני",
    "ראג'ב",
    "שא'באן",
    "רמדאן",
    "שאוואל",
    "דו אל-קא'דה",
    "דו אל-חיג'ה",
  ],

  // Japanese
  ja: [
    "ムハッラム",
    "サファル",
    "ラビーウルアウワル",
    "ラビーウッサーニー",
    "ジュマーダルアウワル",
    "ジュマーダッサーニア",
    "ラジャブ",
    "シャアバーン",
    "ラマダーン",
    "シャウワール",
    "ズルカアダ",
    "ズルヒッジャ",
  ],

  // Korean
  ko: [
    "무하르람",
    "사파르",
    "라비 알-아왈",
    "라비 알-타니",
    "주마다 알-아왈",
    "주마다 알-타니",
    "라자브",
    "샤아반",
    "라마단",
    "샤왈",
    "두 알-키다",
    "두 알-히자",
  ],

  // Chinese (Simplified)
  zh: [
    "穆哈兰月",
    "萨法尔月",
    "柔麻丹月",
    "莱智月",
    "主马达月",
    "朱马达月",
    "莱哲卜月",
    "舍邦月",
    "莱麦丹月",
    "沙瓦勒月",
    "都尔喀尔德月",
    "都尔黑吉月",
  ],

  // Thai
  th: [
    "มุฮัรรม",
    "ซัฟการ",
    "ราบี อัล-อัววัล",
    "ราบี อัล-ษานี",
    "จุมาดา อัล-อัววัล",
    "จุมาดา อัล-ษานี",
    "ราจับ",
    "ชะอาบาน",
    "รมฎาน",
    "ชสวัล",
    "ดูล-กอิดะห์",
    "ดูล-หิจจะห์",
  ],

  // Vietnamese
  vi: [
    "Muharram",
    "Safar",
    "Rabi' al-awwal",
    "Rabi' al-thani",
    "Jumada al-awwal",
    "Jumada al-thani",
    "Rajab",
    "Sha'ban",
    "Ramadan",
    "Shawwal",
    "Dhu al-Qi'dah",
    "Dhu al-Hijjah",
  ],

  // Swahili
  sw: [
    "Muharram",
    "Safar",
    "Rabi' al-awwal",
    "Rabi' al-thani",
    "Jumada al-awwal",
    "Jumada al-thani",
    "Rajab",
    "Sha'ban",
    "Ramadan",
    "Shawwal",
    "Dhu al-Qi'dah",
    "Dhu al-Hijjah",
  ],

  // Hausa
  ha: [
    "Muharram",
    "Safar",
    "Rabi' al-awwal",
    "Rabi' al-thani",
    "Jumada al-awwal",
    "Jumada al-thani",
    "Rajab",
    "Sha'ban",
    "Ramadan",
    "Shawwal",
    "Dhu al-Qi'dah",
    "Dhu al-Hijjah",
  ],

  // Yoruba
  yo: [
    "Muharram",
    "Safar",
    "Rabi' al-awwal",
    "Rabi' al-thani",
    "Jumada al-awwal",
    "Jumada al-thani",
    "Rajab",
    "Sha'ban",
    "Ramadan",
    "Shawwal",
    "Dhu al-Qi'dah",
    "Dhu al-Hijjah",
  ],

  // Somali
  so: [
    "Muharram",
    "Safar",
    "Rabi' al-awwal",
    "Rabi' al-thani",
    "Jumada al-awwal",
    "Jumada al-thani",
    "Rajab",
    "Sha'ban",
    "Ramadan",
    "Shawwal",
    "Dhu al-Qi'dah",
    "Dhu al-Hijjah",
  ],

  // Amharic
  am: [
    "ሙሃረም",
    "ሳፋር",
    "ራቢ አል-አውዋል",
    "ራቢ አል-ታኒ",
    "ጁማዳ አል-አውዋል",
    "ጁማዳ አል-ታኒ",
    "ራጃብ",
    "ሻዓባን",
    "ራማዳን",
    "ሻውዋል",
    "ዱ አል-ቂዓዳ",
    "ዱ አል-ሂጃ",
  ],

  // Oromo
  om: [
    "Muharram",
    "Safar",
    "Rabi' al-awwal",
    "Rabi' al-thani",
    "Jumada al-awwal",
    "Jumada al-thani",
    "Rajab",
    "Sha'ban",
    "Ramadan",
    "Shawwal",
    "Dhu al-Qi'dah",
    "Dhu al-Hijjah",
  ],

  // Tigrinya
  ti: [
    "ሙሀረም",
    "ሳፈር",
    "ራቢ አል-አውዋል",
    "ራቢ አል-ታኒ",
    "ጁማዳ አል-አውዋል",
    "ጁማዳ አል-ታኒ",
    "ራጃብ",
    "ሻዓባን",
    "ራማዳን",
    "ሻውዋል",
    "ዱ አል-ቂዓዳ",
    "ዱ አል-ሂጃ",
  ],

  // Uyghur
  ug: [
    "محرم",
    "صفر",
    "ربيع الاول",
    "ربيع الثاني",
    "جمادى الاول",
    "جمادى الثاني",
    "رجب",
    "شعبان",
    "رمضان",
    "شوال",
    "ذو القعدة",
    "ذو الحجة",
  ],

  // Tajik
  tg: [
    "Муҳаррам",
    "Сафар",
    "Рабиул-аввал",
    "Рабиус-сони",
    "Ҷумодул-аввал",
    "Ҷумодус-сонн",
    "Раҷаб",
    "Шаъбон",
    "Рамазон",
    "Шавол",
    "Зуқаъда",
    "Зуҳиҷҷа",
  ],

  // Kazakh
  kk: [
    "Мұхаррам",
    "Сафар",
    "Раби әл-Аўвәл",
    "Раби әс-Сәни",
    "Жұмадә әл-Аўвәл",
    "Жұмадә әс-Сәни",
    "Раджаб",
    "Шәбан",
    "Рамазан",
    "Шәүәл",
    "Зүл-Қағда",
    "Зүл-Һиджжа",
  ],

  // Uzbek
  uz: [
    "Muharram",
    "Safar",
    "Rabi al-avval",
    "Rabi as-soni",
    "Jumoda al-avval",
    "Jumoda as-soni",
    "Rajab",
    "Shaʻban",
    "Ramazon",
    "Shavval",
    "Zul-Qaʻda",
    "Zul-Hijja",
  ],

  // Bambara (Mali)
  bm: [
    "Muharram",
    "Safar",
    "Rabi' al-awwal",
    "Rabi' al-thani",
    "Jumada al-awwal",
    "Jumada al-thani",
    "Rajab",
    "Sha'ban",
    "Ramadan",
    "Shawwal",
    "Dhu al-Qi'dah",
    "Dhu al-Hijjah",
  ],

  // Berber/Tamazight
  ber: [
    "Muharram",
    "Safar",
    "Rabi' al-awwal",
    "Rabi' al-thani",
    "Jumada al-awwal",
    "Jumada al-thani",
    "Rajab",
    "Sha'ban",
    "Ramadan",
    "Shawwal",
    "Dhu al-Qi'dah",
    "Dhu al-Hijjah",
  ],

  // Punjabi
  pa: [
    "ਮੁਹੱਰਮ",
    "ਸਫ਼ਰ",
    "ਰਬੀ ਅਲ-ਅੱਵਲ",
    "ਰਬੀ ਅਲ-ਸਾਨੀ",
    "ਜੁਮਾਦਾ ਅਲ-ਅੱਵਲ",
    "ਜੁਮਾਦਾ ਅਲ-ਸਾਨੀ",
    "ਰਜ਼ਬ",
    "ਸ਼ਾ'ਬਾਨ",
    "ਰਮਜ਼ਾਨ",
    "ਸ਼ਵ੍ਵਾਲ",
    "ਧੂ ਅਲ-ਕਾ'ਦਾ",
    "ਧੂ ਅਲ-ਹਿਜ਼ਜ਼ਾ",
  ],

  // Kannada
  kn: [
    "ಮುಹರ್ರಂ",
    "ಸಫರ್",
    "ರಬೀ ಅಲ್-ಅವ್ವಲ್",
    "ರಬೀ ಅಲ್-ತಾನೀ",
    "ಜುಮಾದಾ ಅಲ್-ಅವ್ವಲ್",
    "ಜುಮಾದಾ ಅಲ್-ತಾನೀ",
    "ರಜಬ್",
    "ಶಾ'ಬಾನ್",
    "ರಮಜಾನ್",
    "ಶವ್ವಾಲ್",
    "ಧು ಅಲ್-ಕಿದಾ",
    "ಧು ಅಲ್-ಹಿಜ್ಜಾ",
  ],

  // Khmer
  km: [
    "មុហាម្មដ",
    "សាហ្វា",
    "របៀលអាល់អាវ័ល",
    "របៀលអាល់តានី",
    "ជុមាដាអាល់អាវ័ល",
    "ជុមាដាអាល់តានី",
    "រាជាប",
    "ស័ាបាន",
    "រមដាន",
    "សូលវាល",
    "ធូលកាអែដា",
    "ធូលហិជ្ជា",
  ],

  // Sinhala
  si: [
    "මුහර්‍රම්",
    "සෆර්",
    "රබි අල්-අවල්",
    "රබි අල්-තානි",
    "ජුමාදා අල්-අවල්",
    "ජුමාදා අල්-තානි",
    "රජබ්",
    "ශා'බාන්",
    "රමසාන්",
    "ශවවාල්",
    "දු අල්-කි'දා",
    "දු අල්-හිජ්ජා",
  ],

  // Dari
  prs: [
    "محرم",
    "صفر",
    "ربيع الاول",
    "ربيع الثاني",
    "جمادى الاول",
    "جمادى الثاني",
    "رجب",
    "شعبان",
    "رمضان",
    "شوال",
    "ذو القعدة",
    "ذو الحجة",
  ],

  // Sindhi
  sd: [
    "محرم",
    "صفر",
    "ربي الاول",
    "ربي الثاني",
    "جمادي الاول",
    "جمادي الثاني",
    "رجب",
    "شعبان",
    "رمضان",
    "شوال",
    "ذو القعدة",
    "ذو الحجة",
  ],

  // Turkmeni/Turkmen
  tk: [
    "Muharrem",
    "Safar",
    "Rebi ülewwel",
    "Rebi üssani",
    "Cumada ülewwel",
    "Cumada üssani",
    "Receb",
    "Şaban",
    "Ramazan",
    "Şevval",
    "Zilkade",
    "Zilhicce",
  ],

  // Rwandan
  rw: [
    "Muharam",
    "Safar",
    "Rabi 'al-Awwal",
    "Rabi 'al-Thani",
    "Jumada al-Awwal",
    "Jumada al-Thani",
    "Rajab",
    "Sha'ban",
    "Ramadan",
    "Shawwal",
    "Dhu al-Qi'dah",
    "Dhu al-Hijjah",
  ],

  // Bosnian
  bs: [
    "Muharram",
    "Safar",
    "Rabi' al-awwal",
    "Rabi' al-thani",
    "Jumada al-awwal",
    "Jumada al-thani",
    "Rajab",
    "Sha'ban",
    "Ramadan",
    "Shawwal",
    "Dhu al-Qi'dah",
    "Dhu al-Hijjah",
  ],

  // Azeri
  az: [
    "Muharram",
    "Safar",
    "Rabi'ülevvel",
    "Rabi'üssani",
    "Cumada'lula",
    "Cumada'ssani",
    "Receb",
    "Şaban",
    "Ramazan",
    "Şevval",
    "Zilkade",
    "Zilhicce",
  ],

  // Albanian
  sq: [
    "Muharram",
    "Safar",
    "Rabi' al-awwal",
    "Rabi' al-thani",
    "Jumada al-awwal",
    "Jumada al-thani",
    "Rajab",
    "Sha'ban",
    "Ramadan",
    "Shawwal",
    "Dhu al-Qi'dah",
    "Dhu al-Hijjah",
  ],

  // Malayalam
  ml: [
    "മുഹരം",
    "സഫര്‍",
    "റബീ അല്‍ അവ്വല്‍",
    "റബീ അത്താനി",
    "ജുമാദാ അല്‍ അവ്വല്‍",
    "ജുമാദാ അത്താനി",
    "രജബ്",
    "ശാബാൻ",
    "രമദാൻ",
    "ശവ്വാല്‍",
    "ധൂല്‍ ഖഅദ",
    "ധൂല്‍ ഹിജ്ജ",
  ],

  // Nepali
  ne: [
    "मुहर्रम",
    "सफर",
    "रबी अल-अव्वल",
    "रबी अल-सानी",
    "जुमादा अल-अव्वल",
    "जुमादा अल-सानी",
    "रजब",
    "शा'बान",
    "रमजान",
    "शव्वाल",
    "धु अल-कि'दा",
    "धु अल-हिज्जा",
  ],

  // Tagalog/Filipino
  tl: [
    "Muharram",
    "Safar",
    "Rabi' al-awwal",
    "Rabi' al-thani",
    "Jumada al-awwal",
    "Jumada al-thani",
    "Rajab",
    "Sha'ban",
    "Ramadan",
    "Shawwal",
    "Dhu al-Qi'dah",
    "Dhu al-Hijjah",
  ],

  // Malay variant (for consistency)
  msa: [
    "Muharram",
    "Safar",
    "Rabi' al-awwal",
    "Rabi' al-thani",
    "Jumada al-awwal",
    "Jumada al-thani",
    "Rajab",
    "Sha'ban",
    "Ramadan",
    "Shawwal",
    "Dhul-Qi'dah",
    "Dhul-Hijjah",
  ],

  // Divehi (Maldivian)
  dv: [
    "Muharram",
    "Safar",
    "Rabi' al-awwal",
    "Rabi' al-thani",
    "Jumada al-awwal",
    "Jumada al-thani",
    "Rajab",
    "Sha'ban",
    "Ramadan",
    "Shawwal",
    "Dhu al-Qi'dah",
    "Dhu al-Hijjah",
  ],

  // Luganda (Uganda)
  // lg: [], // Not in primary list

  // Kinyarwanda
  // rn: [], // Not in primary list

  // Ewe (West Africa) → not typically localized
  // ee: [],

  // Igbo (Nigeria) → not typically localized
  // ig: [],

  // Cantonese (variant of Chinese) → can fall back to zh
  // yue: [],

  // Fallback: Any language not explicitly mapped will default to HIJRI_MONTHS_ENGLISH
};

/**
 * Get localized Hijri month names for a given language.
 * Falls back to English if the language is not explicitly translated.
 *
 * @param languageCode - ISO 639-1 or BCP 47 language code (e.g., "ar", "en", "fr", "ur")
 * @returns Array of 12 month names
 */
export function getHijriMonthsForLanguage(languageCode: string): string[] {
  const normalized = languageCode.toLowerCase().split("-")[0]; // Handle variants like "en-US"
  return HIJRI_MONTHS_LOCALIZED[normalized] || HIJRI_MONTHS_ENGLISH;
}

/**
 * Format a Hijri date with localized month name.
 * Useful for displaying formatted calendar strings in any language.
 *
 * @param hijriDayMonth - Day and month string (e.g., "15 Muharram")
 * @param hijriYear - Year only as string (e.g., "1446")
 * @param languageCode - Target language code
 * @returns Formatted date string
 */
export function formatHijriDate(
  hijriDayMonth: string,
  hijriYear: string,
  languageCode: string,
): string {
  // Extract day and replace month name
  const parts = hijriDayMonth.trim().split(/\s+/);
  if (parts.length >= 2) {
    const day = parts[0];
    // Rejoin in case month name contains spaces
    const monthName = parts.slice(1).join(" ");

    // Try to find and replace the month (basic pattern matching)
    const months = getHijriMonthsForLanguage(languageCode);
    for (let i = 0; i < HIJRI_MONTHS_ENGLISH.length; i++) {
      if (monthName === HIJRI_MONTHS_ENGLISH[i] || monthName.includes(HIJRI_MONTHS_ENGLISH[i])) {
        const localizedMonth = months[i];
        return `${day} ${localizedMonth} ${hijriYear}`;
      }
    }
  }

  // Fallback: return as-is if pattern matching fails
  return `${hijriDayMonth} ${hijriYear}`;
}
