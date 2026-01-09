/**
 * Transliteration utility for Cyrillic to Latin conversion
 * Allows searching in Cyrillic even when data is stored in Latin and vice versa
 */

// Cyrillic to Latin mapping
const CYRILLIC_TO_LATIN: Record<string, string> = {
  // Russian Cyrillic
  'а': 'a',
  'б': 'b',
  'в': 'v',
  'г': 'g',
  'д': 'd',
  'е': 'e',
  'ё': 'e',
  'ж': 'zh',
  'з': 'z',
  'и': 'i',
  'й': 'y',
  'к': 'k',
  'л': 'l',
  'м': 'm',
  'н': 'n',
  'о': 'o',
  'п': 'p',
  'р': 'r',
  'с': 's',
  'т': 't',
  'у': 'u',
  'ф': 'f',
  'х': 'h',
  'ц': 'ts',
  'ч': 'ch',
  'ш': 'sh',
  'щ': 'sch',
  'ъ': '',
  'ы': 'y',
  'ь': '',
  'э': 'e',
  'ю': 'yu',
  'я': 'ya',
  
  // Uppercase
  'А': 'A',
  'Б': 'B',
  'В': 'V',
  'Г': 'G',
  'Д': 'D',
  'Е': 'E',
  'Ё': 'E',
  'Ж': 'Zh',
  'З': 'Z',
  'И': 'I',
  'Й': 'Y',
  'К': 'K',
  'Л': 'L',
  'М': 'M',
  'Н': 'N',
  'О': 'O',
  'П': 'P',
  'Р': 'R',
  'С': 'S',
  'Т': 'T',
  'У': 'U',
  'Ф': 'F',
  'Х': 'H',
  'Ц': 'Ts',
  'Ч': 'Ch',
  'Ш': 'Sh',
  'Щ': 'Sch',
  'Ъ': '',
  'Ы': 'Y',
  'Ь': '',
  'Э': 'E',
  'Ю': 'Yu',
  'Я': 'Ya',
};

// Latin to Cyrillic mapping (for reverse transliteration)
const LATIN_TO_CYRILLIC: Record<string, string> = {
  'a': 'а',
  'b': 'б',
  'v': 'в',
  'g': 'г',
  'd': 'д',
  'e': 'е',
  'zh': 'ж',
  'z': 'з',
  'i': 'и',
  'y': 'й',
  'k': 'к',
  'l': 'л',
  'm': 'м',
  'n': 'н',
  'o': 'о',
  'p': 'п',
  'r': 'р',
  's': 'с',
  't': 'т',
  'u': 'у',
  'f': 'ф',
  'h': 'х',
  'ts': 'ц',
  'ch': 'ч',
  'sh': 'ш',
  'sch': 'щ',
  'yu': 'ю',
  'ya': 'я',
};

/**
 * Convert Cyrillic text to Latin equivalent
 * @param text - Text to convert
 * @returns Transliterated text in Latin characters
 */
export function cyrillicToLatin(text: string): string {
  let result = '';
  for (const char of text) {
    result += CYRILLIC_TO_LATIN[char] || char;
  }
  return result;
}

/**
 * Check if text contains Cyrillic characters
 * @param text - Text to check
 * @returns true if text contains Cyrillic
 */
export function hasCyrillic(text: string): boolean {
  return /[а-яёА-ЯЁ]/.test(text);
}

/**
 * Normalize search text for cross-script matching
 * Converts Cyrillic to Latin and lowercases
 * @param text - Text to normalize
 * @returns Normalized text
 */
export function normalizeSearchText(text: string): string {
  const transliterated = cyrillicToLatin(text);
  return transliterated.toLowerCase();
}

/**
 * Check if a searchable text matches a search query, supporting both Cyrillic and Latin
 * @param searchableText - The text to search in (e.g., student name)
 * @param searchQuery - The search input from user
 * @returns true if the text matches the query
 */
export function searchMatchesCrossScript(searchableText: string, searchQuery: string): boolean {
  if (!searchableText || !searchQuery) {
    return !searchQuery; // Empty query matches everything
  }

  const normalizedSearchable = normalizeSearchText(searchableText);
  const normalizedQuery = normalizeSearchText(searchQuery);

  return normalizedSearchable.includes(normalizedQuery);
}
