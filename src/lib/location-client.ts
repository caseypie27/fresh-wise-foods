export const LOCATION_PREF_KEY = "freshtrack:location-reminders";
const LAST_NUDGE_KEY = "freshtrack:last-supermarket-nudge";
const LAST_POS_KEY = "freshtrack:last-checked-pos";

// Don't nudge more than once every 3 hours
const COOLDOWN_MS = 3 * 60 * 60 * 1000;
// Only re-check when the user has moved at least 120 m
const MIN_MOVE_M = 120;

export function geolocationSupported() {
  return typeof window !== "undefined" && "geolocation" in navigator;
}

export function locationRemindersEnabled() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(LOCATION_PREF_KEY) === "1";
}

export function setLocationReminders(on: boolean) {
  localStorage.setItem(LOCATION_PREF_KEY, on ? "1" : "0");
}

export function requestPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!geolocationSupported()) {
      reject(new Error("Location is not supported on this device"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000,
    });
  });
}

function distanceM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Returns true when we should hit the server for this position. */
export function shouldCheck(pos: { lat: number; lng: number }) {
  const last = Number(localStorage.getItem(LAST_NUDGE_KEY) || 0);
  if (Date.now() - last < COOLDOWN_MS) return false;
  const raw = localStorage.getItem(LAST_POS_KEY);
  if (raw) {
    try {
      const prev = JSON.parse(raw) as { lat: number; lng: number; t: number };
      if (
        Date.now() - prev.t < 10 * 60 * 1000 &&
        distanceM(prev, pos) < MIN_MOVE_M
      )
        return false;
    } catch {
      // ignore
    }
  }
  localStorage.setItem(
    LAST_POS_KEY,
    JSON.stringify({ ...pos, t: Date.now() }),
  );
  return true;
}

export function markNudged() {
  localStorage.setItem(LAST_NUDGE_KEY, String(Date.now()));
}
