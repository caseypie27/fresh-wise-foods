import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CoordsInput = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius: z.number().min(50).max(1000).optional(),
});

/**
 * Checks whether the user is standing near a supermarket / grocery store and,
 * if they have food expiring within 3 days, pushes a "use it before you buy
 * more" reminder to their devices.
 */
export const checkSupermarketProximity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CoordsInput.parse(d))
  .handler(async ({ data, context }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!lovableKey || !mapsKey) throw new Error("Maps connector not configured");

    const res = await fetch(
      "https://connector-gateway.lovable.dev/google_maps/places/v1/places:searchNearby",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": mapsKey,
          "Content-Type": "application/json",
          "X-Goog-FieldMask": "places.id,places.displayName,places.primaryType",
        },
        body: JSON.stringify({
          includedTypes: ["supermarket", "grocery_store"],
          maxResultCount: 1,
          rankPreference: "DISTANCE",
          locationRestriction: {
            circle: {
              center: { latitude: data.lat, longitude: data.lng },
              radius: data.radius ?? 200,
            },
          },
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 403) {
        throw new Error(
          `Google Maps request was denied (403). Check the server key's restrictions in Google Cloud Console. ${body}`,
        );
      }
      throw new Error(`Places request failed [${res.status}]: ${body}`);
    }

    const json = (await res.json()) as {
      places?: { id: string; displayName?: { text?: string } }[];
    };
    const place = json.places?.[0];
    if (!place) return { nearby: false as const, sent: 0 };

    const storeName = place.displayName?.text ?? "a supermarket";

    // Items expiring in the next 3 days (and not already consumed/expired)
    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const in3 = new Date(today);
    in3.setDate(in3.getDate() + 3);

    const { data: items } = await context.supabase
      .from("food_items")
      .select("id, name, expiry_date")
      .neq("status", "consumed")
      .gte("expiry_date", iso(today))
      .lte("expiry_date", iso(in3))
      .order("expiry_date", { ascending: true });

    if (!items?.length) {
      return { nearby: true as const, store: storeName, sent: 0 };
    }

    const names = items.slice(0, 3).map((i) => i.name);
    const list =
      names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    const soonest = items[0].expiry_date;
    const days = Math.max(
      0,
      Math.round(
        (new Date(soonest + "T00:00:00Z").getTime() -
          new Date(iso(today) + "T00:00:00Z").getTime()) /
          86400000,
      ),
    );
    const when =
      days === 0 ? "expire today" : days === 1 ? "expire tomorrow" : `expire in ${days} days`;

    const body = `You already have ${list} at home that ${when}. Consider using them before buying more.`;

    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:notify@freshtrack.app",
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );

    const { data: subs } = await context.supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", context.userId);

    let sent = 0;
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({
            title: "You're at a supermarket! 🛒",
            body,
            url: "/inventory",
            tag: "supermarket-nudge",
          }),
        );
        sent++;
      } catch {
        // stale subscriptions are cleaned by the daily job
      }
    }

    return { nearby: true as const, store: storeName, sent, body };
  });
