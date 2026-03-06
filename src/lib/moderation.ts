const DEFAULT_BANNED_WORDS = ["insulte", "arnaque", "spam"];

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function getBannedWords() {
  const fromEnv = (process.env.MODERATION_BANNED_WORDS ?? "")
    .split(",")
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean);

  return fromEnv.length > 0 ? fromEnv : DEFAULT_BANNED_WORDS;
}

export function containsBannedWord(content: string) {
  const source = normalizeText(content);
  const bannedWords = getBannedWords().map((word) => normalizeText(word));

  return bannedWords.some((word) => source.includes(word));
}
