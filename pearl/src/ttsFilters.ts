import type { Settings } from "./types";

type Filters = Partial<Pick<Settings, "ttsBlockedPhrases" | "ttsSkipLinks" | "ttsSkipCommands">>;
const normalize = (text: string) => text.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
const linkPattern = /(?:\b[a-z][a-z0-9+.-]*:\/\/\S+|\bwww\.\S+|(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?\.)+[\p{L}]{2,63}(?=$|[^\p{L}\p{N}_-]))/iu;

export function chatTtsFilterReason(message: string, settings: Filters): string | null {
  if (settings.ttsSkipCommands && message.trimStart().startsWith("!")) return "command";
  if (settings.ttsSkipLinks && linkPattern.test(message.normalize("NFKC"))) return "link";
  const normalized = normalize(message);
  for (const entry of (settings.ttsBlockedPhrases || "").split(/\r?\n/u)) {
    const phrase = normalize(entry);
    if (!phrase) continue;
    // Match literal whole words to avoid blocking 'badge' for an entry of 'bad'.
    let start = normalized.indexOf(phrase);
    while (start !== -1) {
      const before = Array.from(normalized.slice(0, start)).pop() || "";
      const after = Array.from(normalized.slice(start + phrase.length))[0] || "";
      const characters = Array.from(phrase);
      const word = /[\p{L}\p{N}_]/u;
      if ((!word.test(characters[0]) || !word.test(before)) &&
          (!word.test(characters[characters.length - 1]) || !word.test(after))) return "blocked word or phrase";
      start = normalized.indexOf(phrase, start + 1);
    }
  }
  return null;
}
