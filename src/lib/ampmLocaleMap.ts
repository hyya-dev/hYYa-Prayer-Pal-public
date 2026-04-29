/**
 * Locale-specific AM/PM markers.
 *
 * Many ICU implementations (mobile WebViews, older Android/iOS) fall back to
 * English "AM"/"PM" for locales that actually have their own day-period markers.
 * This map provides correct replacements so that `formatTime()` can post-process
 * the Intl output and swap out the English literal.
 *
 * Only locales whose standard CLDR day-period differs from English "AM"/"PM"
 * are listed here. If a locale naturally produces correct output from the
 * platform's ICU, the map entry is still kept for robustness against devices
 * with incomplete locale data.
 *
 * Sources: Unicode CLDR day-period data (abbreviated format)
 */
export const AMPM_LOCALE_MAP: Record<string, { am: string; pm: string }> = {
  // Already OK on most platforms but kept for safety:
  am:  { am: 'ጥዋት',  pm: 'ከሰዓት' },
  ar:  { am: 'ص',     pm: 'م' },
  as:  { am: 'পূৰ্বাহ্ন', pm: 'অপৰাহ্ন' },
  // Needs fix on many platforms:
  az:  { am: 'AM',    pm: 'PM' },   // Azerbaijani actually uses AM/PM per CLDR
  bn:  { am: 'পূর্বাহ্ণ', pm: 'অপরাহ্ণ' },
  bs:  { am: 'prijepodne', pm: 'popodne' },
  bg:  { am: 'пр.об.', pm: 'сл.об.' },
  de:  { am: 'vorm.',  pm: 'nachm.' },
  dv:  { am: 'މކ',    pm: 'މފ' },
  es:  { am: 'a.\u00A0m.', pm: 'p.\u00A0m.' },
  fa:  { am: 'ق.ظ.',  pm: 'ب.ظ.' },
  fr:  { am: 'AM',    pm: 'PM' },   // French CLDR is actually AM/PM
  gu:  { am: 'AM',    pm: 'PM' },   // Gujarati CLDR uses AM/PM
  ha:  { am: 'SF',    pm: 'YM' },
  he:  { am: 'לפנה״צ', pm: 'אחה״צ' },
  hi:  { am: 'am',    pm: 'pm' },   // Hindi CLDR uses lowercase am/pm
  id:  { am: 'AM',    pm: 'PM' },   // Indonesian CLDR uses AM/PM
  it:  { am: 'AM',    pm: 'PM' },   // Italian CLDR uses AM/PM
  ja:  { am: '午前',   pm: '午後' },
  kk:  { am: 'AM',    pm: 'PM' },   // Kazakh CLDR uses AM/PM
  km:  { am: 'មុនថ្ងៃត្រង់', pm: 'រសៀល' },
  ko:  { am: '오전',   pm: '오후' },
  ku:  { am: 'BN',    pm: 'PN' },
  ml:  { am: 'AM',    pm: 'PM' },   // Malayalam CLDR uses AM/PM
  mr:  { am: 'म.पू.',  pm: 'म.उ.' },
  ms:  { am: 'PG',    pm: 'PTG' },
  ne:  { am: 'पूर्वाह्न', pm: 'अपराह्न' },
  nl:  { am: 'a.m.',  pm: 'p.m.' },
  om:  { am: 'WD',    pm: 'WB' },
  pl:  { am: 'AM',    pm: 'PM' },   // Polish CLDR uses AM/PM
  ps:  { am: 'غ.م.',  pm: 'غ.و.' },
  pt:  { am: 'AM',    pm: 'PM' },   // Portuguese CLDR uses AM/PM
  ro:  { am: 'a.m.',  pm: 'p.m.' },
  ru:  { am: 'AM',    pm: 'PM' },   // Russian CLDR uses AM/PM (24h is default)
  rw:  { am: 'AM',    pm: 'PM' },   // Kinyarwanda CLDR uses AM/PM
  sd:  { am: 'صبح',   pm: 'شام' },
  si:  { am: 'පෙ.ව.',  pm: 'ප.ව.' },
  so:  { am: 'GH',    pm: 'GD' },
  sq:  { am: 'p.d.',  pm: 'm.d.' },
  sv:  { am: 'fm',    pm: 'em' },
  sw:  { am: 'AM',    pm: 'PM' },   // Swahili CLDR uses AM/PM
  ta:  { am: 'முற்பகல்', pm: 'பிற்பகல்' },
  te:  { am: 'AM',    pm: 'PM' },   // Telugu CLDR uses AM/PM
  tg:  { am: 'пе. чо.', pm: 'па. чо.' },
  th:  { am: 'ก่อนเที่ยง', pm: 'หลังเที่ยง' },
  tl:  { am: 'AM',    pm: 'PM' },   // Filipino CLDR uses AM/PM
  tr:  { am: 'ÖÖ',    pm: 'ÖS' },
  ug:  { am: 'چ.ب',   pm: 'چ.ك' },
  uk:  { am: 'дп',    pm: 'пп' },
  ur:  { am: 'قبل دوپہر', pm: 'بعد دوپہر' },
  uz:  { am: 'TO',    pm: 'TK' },
  vi:  { am: 'SA',    pm: 'CH' },
  yo:  { am: 'Àárọ̀',  pm: 'Ọ̀sán' },
  zh:  { am: '上午',   pm: '下午' },
};
