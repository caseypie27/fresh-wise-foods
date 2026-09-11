import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { checkSupermarketProximity, saveMyLocation } from "@/lib/geo.functions";
import {
  geolocationSupported,
  locationRemindersEnabled,
  markNudged,
  shouldCheck,
} from "@/lib/location-client";

const PING_EVERY_MS = 3 * 60 * 1000;

/**
 * While the app is open and the user has opted in, watch their position:
 *  - store the latest position server-side so the scheduled job can send a
 *    real push notification even when the app is closed or backgrounded,
 *  - and opportunistically ask the server to check for a nearby supermarket.
 */
export function useSupermarketWatch() {
  const check = useServerFn(checkSupermarketProximity);
  const ping = useServerFn(saveMyLocation);
  const busy = useRef(false);
  const lastPing = useRef(0);

  useEffect(() => {
    if (!geolocationSupported() || !locationRemindersEnabled()) return;

    let cancelled = false;

    const onPos = async (pos: GeolocationPosition) => {
      if (cancelled) return;
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };

      // Keep the server's copy of the last known position fresh.
      if (Date.now() - lastPing.current > PING_EVERY_MS) {
        lastPing.current = Date.now();
        ping({
          data: { ...coords, accuracy: pos.coords.accuracy, enabled: true },
        }).catch(() => {});
      }

      if (busy.current) return;
      if (!shouldCheck(coords)) return;
      busy.current = true;
      try {
        const res = await check({ data: coords });
        if (res.sent > 0) markNudged();
      } catch {
        // silent — location nudges are best-effort
      } finally {
        busy.current = false;
      }
    };

    const id = navigator.geolocation.watchPosition(onPos, () => {}, {
      enableHighAccuracy: false,
      maximumAge: 60000,
      timeout: 30000,
    });

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(id);
    };
  }, [check, ping]);
}
