const fs = require('fs');
const path = require('path');

// Urdu translations
const urduCommon = {
  "buttons": { "save": "محفوظ کریں", "cancel": "منسوخ کریں", "delete": "حذف کریں", "edit": "ترمیم", "done": "مکمل", "close": "بند کریں", "confirm": "تصدیق کریں", "continue": "جاری رکھیں", "back": "واپس", "next": "اگلا", "skip": "چھوڑ دیں", "submit": "جمع کرائیں", "search": "تلاش کریں", "filter": "فلٹر", "share": "شیئر کریں", "retry": "دوبارہ کوشش کریں" },
  "navigation": { "home": "ہوم", "maps": "نقشے", "groups": "گروپس", "you": "آپ", "quickActions": "فوری اقدامات" },
  "status": { "loading": "لوڈ ہو رہا ہے...", "saving": "محفوظ ہو رہا ہے...", "success": "کامیابی", "error": "خرابی", "comingSoon": "جلد آرہا ہے" },
  "units": { "km": "کلومیٹر", "kg": "کلوگرام", "kmh": "کلومیٹر/گھنٹہ", "min": "منٹ", "sec": "سیکنڈ", "hours": "گھنٹے" },
  "days": { "monday": "پیر", "tuesday": "منگل", "wednesday": "بدھ", "thursday": "جمعرات", "friday": "جمعہ", "saturday": "ہفتہ", "sunday": "اتوار" },
  "months": { "january": "جنوری", "february": "فروری", "march": "مارچ", "april": "اپریل", "may": "مئی", "june": "جون", "july": "جولائی", "august": "اگست", "september": "ستمبر", "october": "اکتوبر", "november": "نومبر", "december": "دسمبر" },
  "timePeriods": { "week": "ہفتہ", "month": "مہینہ", "threeMonths": "3 مہینے", "sixMonths": "6 مہینے", "year": "سال", "allTime": "تمام وقت" }
};

// Polish translations  
const polishCommon = {
  "buttons": { "save": "Zapisz", "cancel": "Anuluj", "delete": "Usuń", "edit": "Edytuj", "done": "Gotowe", "close": "Zamknij", "confirm": "Potwierdź", "continue": "Kontynuuj", "back": "Wstecz", "next": "Dalej", "skip": "Pomiń", "submit": "Wyślij", "search": "Szukaj", "filter": "Filtruj", "share": "Udostępnij", "retry": "Spróbuj ponownie" },
  "navigation": { "home": "Strona główna", "maps": "Mapy", "groups": "Grupy", "you": "Ty", "quickActions": "Szybkie akcje" },
  "status": { "loading": "Ładowanie...", "saving": "Zapisywanie...", "success": "Sukces", "error": "Błąd", "comingSoon": "Wkrótce" },
  "units": { "km": "km", "kg": "kg", "kmh": "km/h", "min": "min", "sec": "sek", "hours": "godziny" },
  "days": { "monday": "Poniedziałek", "tuesday": "Wtorek", "wednesday": "Środa", "thursday": "Czwartek", "friday": "Piątek", "saturday": "Sobota", "sunday": "Niedziela" },
  "months": { "january": "Styczeń", "february": "Luty", "march": "Marzec", "april": "Kwiecień", "may": "Maj", "june": "Czerwiec", "july": "Lipiec", "august": "Sierpień", "september": "Wrzesień", "october": "Październik", "november": "Listopad", "december": "Grudzień" },
  "timePeriods": { "week": "Tydzień", "month": "Miesiąc", "threeMonths": "3 miesiące", "sixMonths": "6 miesięcy", "year": "Rok", "allTime": "Cały czas" }
};

// Bengali translations
const bengaliCommon = {
  "buttons": { "save": "সংরক্ষণ করুন", "cancel": "বাতিল করুন", "delete": "মুছুন", "edit": "সম্পাদনা করুন", "done": "সম্পন্ন", "close": "বন্ধ করুন", "confirm": "নিশ্চিত করুন", "continue": "চালিয়ে যান", "back": "পিছনে", "next": "পরবর্তী", "skip": "এড়িয়ে যান", "submit": "জমা দিন", "search": "খুঁজুন", "filter": "ফিল্টার", "share": "শেয়ার করুন", "retry": "আবার চেষ্টা করুন" },
  "navigation": { "home": "হোম", "maps": "ম্যাপ", "groups": "গ্রুপ", "you": "আপনি", "quickActions": "দ্রুত কাজ" },
  "status": { "loading": "লোড হচ্ছে...", "saving": "সংরক্ষণ হচ্ছে...", "success": "সফল", "error": "ত্রুটি", "comingSoon": "শীঘ্রই আসছে" },
  "units": { "km": "কিমি", "kg": "কেজি", "kmh": "কিমি/ঘণ্টা", "min": "মিনিট", "sec": "সেকেন্ড", "hours": "ঘণ্টা" },
  "days": { "monday": "সোমবার", "tuesday": "মঙ্গলবার", "wednesday": "বুধবার", "thursday": "বৃহস্পতিবার", "friday": "শুক্রবার", "saturday": "শনিবার", "sunday": "রবিবার" },
  "months": { "january": "জানুয়ারি", "february": "ফেব্রুয়ারি", "march": "মার্চ", "april": "এপ্রিল", "may": "মে", "june": "জুন", "july": "জুলাই", "august": "আগস্ট", "september": "সেপ্টেম্বর", "october": "অক্টোবর", "november": "নভেম্বর", "december": "ডিসেম্বর" },
  "timePeriods": { "week": "সপ্তাহ", "month": "মাস", "threeMonths": "৩ মাস", "sixMonths": "৬ মাস", "year": "বছর", "allTime": "সব সময়" }
};

// Write files
fs.writeFileSync('locales/ur/common.json', JSON.stringify(urduCommon, null, 2));
fs.writeFileSync('locales/pl/common.json', JSON.stringify(polishCommon, null, 2));
fs.writeFileSync('locales/bn/common.json', JSON.stringify(bengaliCommon, null, 2));

console.log('Translations written successfully!');
