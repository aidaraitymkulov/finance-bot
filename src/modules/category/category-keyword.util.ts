const MIN_KEYWORD_LENGTH = 3;
const MAX_KEYWORDS = 5;

const STOP_WORDS = new Set([
  "для",
  "про",
  "при",
  "без",
  "над",
  "под",
  "что",
  "это",
  "как",
  "или",
  "его",
  "еще",
  "все",
  "там",
  "тут",
  "уже",
  "мне",
  "нам",
  "они",
  "она",
]);

/** Lower-cases, folds ё to е and drops everything but letters and digits (emoji included). */
export const normalizeWord = (value: string): string =>
  value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]/gu, "");

/** Significant words of a comment that are remembered as "word -> category". */
export const extractKeywords = (comment: string | null | undefined): string[] => {
  if (!comment) {
    return [];
  }

  const words = comment
    .split(/\s+/)
    .map(normalizeWord)
    .filter(
      (word) =>
        word.length >= MIN_KEYWORD_LENGTH && !STOP_WORDS.has(word) && !/^\p{N}+$/u.test(word),
    );
  return [...new Set(words)].slice(0, MAX_KEYWORDS);
};
