const GEOCODE_TIMEOUT_MS = 8000;

/** Best-effort address -> coordinates lookup via Nominatim (OpenStreetMap's free geocoding API -
 * no key/billing needed, matching the rest of this app's map stack). Always resolves rather than
 * throwing: a timeout, network error, or an address that just doesn't match anything all come back
 * as `null`, since a delivery address that can't be pinned shouldn't ever break the order/tracking
 * flow it's attached to. */
export async function geocodeAddress(query: string): Promise<{ lat: number; lng: number } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      signal: controller.signal,
      // Required by Nominatim's usage policy - identifies the app making the request.
      headers: { 'User-Agent': 'KuISOKO-Ecommerce/1.0 (delivery tracking)' },
    });
    if (!res.ok) return null;
    const results = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (results.length === 0) return null;
    const lat = parseFloat(results[0].lat);
    const lng = parseFloat(results[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
