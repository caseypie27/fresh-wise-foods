import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { checkSupermarketProximity } from "@/lib/geo.functions";
import {
  geolocationSupported,
  locationRemindersEnabled,
  markNudged,
  shouldCheck,
} from "@/lib/location-client";

/**
 * While the app is open and the user has opted in, watch their position and
 * ask the server whether they're standing near a supermarket. The server sends
 * the push notification if they have food expiring soon.
 */
export function useSupermarketWatch() {
  const check = useServerFn(checkSupermarketProximity);
  const busy = useRef(false);

  useEffect(() => {
    if (!geolocationSupported() || !locationRemindersEnabled()) return;

    let cancelled = false;

    const onPos = async (pos: GeolocationPosition) => {
      if (cancelled || busy.current) return;
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
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
  }, [check]);
}
