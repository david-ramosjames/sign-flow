import type { SupportedLanguage } from "@/types/models";

/** Pick Spanish template when `language` is `es` and Spanish text is configured; otherwise English. */
export function templateForLanguage(
  language: SupportedLanguage,
  english: string,
  spanish: string | undefined | null,
): string {
  if (language === "es") {
    const s = spanish?.trim();
    if (s) return s;
  }
  return english;
}
