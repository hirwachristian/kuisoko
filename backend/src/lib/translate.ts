/** Free machine translation via MyMemory (no API key required, no billing setup) - used to
 * auto-fill a Kinyarwanda translation for a category/section/item whenever an admin doesn't type
 * one in by hand. Best-effort: on any failure (network error, rate limit, unsupported pair) this
 * just returns null, and the caller leaves that field untranslated - exactly the same as if
 * auto-translate had never run, it never blocks the actual create/update from succeeding.
 */
export async function translateToKinyarwanda(text: string): Promise<string | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=en|rw`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { responseData?: { translatedText?: string } };
    const translated = data.responseData?.translatedText?.trim();
    // MyMemory echoes the input back (rather than erroring) when it can't actually translate a
    // pair - treat an unchanged result as "no translation available" rather than storing English
    // text in the Kinyarwanda field.
    if (!translated || translated.toLowerCase() === trimmed.toLowerCase()) return null;
    return translated;
  } catch (err) {
    console.error('Error auto-translating text to Kinyarwanda:', err);
    return null;
  }
}

/** Translates a batch of strings in parallel, preserving order/length - used for a section's
 * item list, where every item needs its own translation. Falls back to null per-item on failure,
 * same as translateToKinyarwanda itself. */
export async function translateManyToKinyarwanda(texts: string[]): Promise<(string | null)[]> {
  return Promise.all(texts.map((text) => translateToKinyarwanda(text)));
}
