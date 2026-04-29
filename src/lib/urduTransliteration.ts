/**
 * Urdu transliteration for common city names
 * Maps English city names to their Urdu script equivalents
 */
const cityTransliterationMap: Record<string, string> = {
  // Major cities
  'San Francisco': 'سان فرانسسکو',
  'New York': 'نیو یارک',
  'Los Angeles': 'لاس اینجلس',
  'Chicago': 'شکاگو',
  'Houston': 'ہوسٹن',
  'Phoenix': 'فینکس',
  'Philadelphia': 'فلاڈیلفیا',
  'San Antonio': 'سان انٹونیو',
  'San Diego': 'سان ڈیاگو',
  'Dallas': 'ڈیلاس',
  'London': 'لندن',
  'Paris': 'پیرس',
  'Berlin': 'برلن',
  'Madrid': 'میڈرڈ',
  'Rome': 'روم',
  'Moscow': 'ماسکو',
  'Istanbul': 'استنبول',
  'Dubai': 'دبئی',
  'Riyadh': 'ریاض',
  'Jeddah': 'جدہ',
  'Medina': 'مدینہ',
  'Karachi': 'کراچی',
  'Lahore': 'لاہور',
  'Islamabad': 'اسلام آباد',
  'Rawalpindi': 'راولپنڈی',
  'Faisalabad': 'فیصل آباد',
  'Multan': 'ملتان',
  'Hyderabad': 'حیدرآباد',
  'Peshawar': 'پشاور',
  'Quetta': 'کوئٹہ',
  'Mumbai': 'ممبئی',
  'Delhi': 'دہلی',
  'Bangalore': 'بنگلور',
  'Kolkata': 'کولکتہ',
  'Chennai': 'چنائی',
  'Ahmedabad': 'احمد آباد',
  'Surat': 'سورت',
  'Pune': 'پونے',
  'Jaipur': 'جے پور',
  'Lucknow': 'لکھنؤ',
  'Kanpur': 'کانپور',
  'Nagpur': 'ناگپور',
  'Indore': 'انڈور',
  'Thane': 'تھانے',
  'Bhopal': 'بھوپال',
  'Visakhapatnam': 'وشاکھاپٹنم',
  'Patna': 'پٹنہ',
  'Vadodara': 'وڈودرا',
  'Ghaziabad': 'غازی آباد',
  'Ludhiana': 'لدھیانہ',
  'Agra': 'آگرہ',
  'Nashik': 'ناسک',
  'Faridabad': 'فرید آباد',
  'Meerut': 'میرٹھ',
  'Rajkot': 'راجکوٹ',
  'Varanasi': 'وارانسی',
  'Srinagar': 'سرینگر',
  'Amritsar': 'امرتسر',
  'Dammam': 'دمام',
  'Abha': 'ابھا',
  'Tabuk': 'تبوک',
  'Jubail': 'جبیل',
  'Khobar': 'خبر',
  'Taif': 'طائف',
  'Buraidah': 'بريدة',
  'Khamis Mushait': 'خمیس مشیط',
  'Hail': 'حائل',
  'Najran': 'نجران',
  'Al Bahah': 'الباحہ',
  'Arar': 'عرعر',
  'Sakaka': 'سکاکا',
  'Jizan': 'جازان',
  'Yanbu': 'ینبع',
  'Abqaiq': 'بقيق',
  'Unaizah': 'عنيزة',
  'Qatif': 'قطیف',
  'Al Khafji': 'الخفجی',
  'Dhahran': 'ظهران',
  'Al Mubarraz': 'المبرز',
  'Al Kharj': 'الخرج',
  'Al Qunfudhah': 'القنفذة',
  'Samtah': 'صامطة',
  'Sabya': 'صبیا',
  'Makkah': 'مکہ',
  'Madinah': 'مدینہ',
  'Al Qassim': 'القصیم',
  'Al Jawf': 'الجوف',
  'Northern Borders': 'الحدود الشمالیة',
  'Eastern Province': 'المنطقة الشرقية',
  'Asir': 'عسیر',
  'Jazan': 'جازان',
};

/**
 * Transliterates a city name to Urdu script if available
 * @param cityName - The city name to transliterate
 * @returns The Urdu transliteration if available, otherwise returns the original name
 */
export function transliterateCityToUrdu(cityName: string): string {
  if (!cityName) return cityName;
  
  // Check exact match first
  if (cityTransliterationMap[cityName]) {
    return cityTransliterationMap[cityName];
  }
  
  // Check case-insensitive match
  const lowerCityName = cityName.toLowerCase();
  for (const [english, urdu] of Object.entries(cityTransliterationMap)) {
    if (english.toLowerCase() === lowerCityName) {
      return urdu;
    }
  }
  
  // If no match found, return original
  return cityName;
}
