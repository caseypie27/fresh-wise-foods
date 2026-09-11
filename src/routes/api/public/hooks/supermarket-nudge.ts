import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled job (pg_cron). For every user who opted into supermarket reminders
 * and whose last known position is recent, check whether they're standing near
 * a grocery store and send a real web-push reminder about food expiring soon.
 * Runs server-side, so the notification arrives even when the app is closed.
 */
export const Route = createFileRoute("/api/public/hooks/supermarket-nudge")({
  server: {
    handlers: {
      POST: async () => {
        const lovableKey = process.env.LOVABLE_API_KEY;
        const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!lovableKey || !mapsKey) {
          return Response.json(
            { ok: false, error: "Maps connector not configured" },
            { status: 500 },
          );
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const webpush = (await import("web-push")).default;
        webpush.setVapidDetails(
          process.env.VAPID_SUBJECT || "mailto:notify@freshtrack.app",
          process.env.VAPID_PUBLIC_KEY!,
          process.env.VAPID_PRIVATE_KEY!,
        );

        const now = Date.now();
        const freshSince = new Date(now - 45 * 60 * 1000).toISOString();
        const cooldownBefore = new Date(now - 3 * 60 * 60 * 1000).toISOString();

        const { data: locs } = await supabaseAdmin
          .from("user_locations")
          .select("user_id, lat, lng, last_nudge_at, updated_at")
          .eq("reminders_enabled", true)
          .gte("updated_at", freshSince);

        const candidates = (locs ?? []).filter(
          (l) =>
            (l.lat !== 0 || l.lng !== 0) &&
            (!l.last_nudge_at || l.last_nudge_at < cooldownBefore),
        );
        if (!candidates.length) return Response.json({ ok: true, sent: 0 });

        const today = new Date();
        const iso = (d: Date) => d.toISOString().slice(0, 10);
        const in3 = new Date(today);
        in3.setDate(in3.getDate() + 3);

        const userIds = candidates.map((c) => c.user_id);
        const [{ data: items }, { data: subs }] = await Promise.all([
          supabaseAdmin
            .from("food_items")
            .select("user_id, name, expiry_date")
            .in("user_id", userIds)
            .neq("status", "consumed")
            .gte("expiry_date", iso(today))
            .lte("expiry_date", iso(in3))
            .order("expiry_date", { ascending: true }),
          supabaseAdmin
            .from("push_subscriptions")
            .select("*")
            .in("user_id", userIds),
        ]);

        const itemsByUser = new Map<string, { name: string; expiry_date: string }[]>();
        for (const it of items ?? []) {
          const arr = itemsByUser.get(it.user_id) ?? [];
          arr.push({ name: it.name, expiry_date: it.expiry_date });
          itemsByUser.set(it.user_id, arr);
        }
        const subsByUser = new Map<string, NonNullable<typeof subs>>();
        for (const s of subs ?? []) {
          const arr = subsByUser.get(s.user_id) ?? [];
          arr.push(s);
          subsByUser.set(s.user_id, arr);
        }

        let sent = 0;
        const stale: string[] = [];
        const nudged: string[] = [];

        for (const loc of candidates) {
          const list = itemsByUser.get(loc.user_id);
          const userSubs = subsByUser.get(loc.user_id);
          if (!list?.length || !userSubs?.length) continue;

          const res = await fetch(
            "https://connector-gateway.lovable.dev/google_maps/places/v1/places:searchNearby",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${lovableKey}`,
                "X-Connection-Api-Key": mapsKey,
                "Content-Type": "application/json",
                "X-Goog-FieldMask": "places.id,places.displayName",
              },
              body: JSON.stringify({
                includedTypes: ["supermarket", "grocery_store"],
                maxResultCount: 1,
                rankPreference: "DISTANCE",
                locationRestriction: {
                  circle: {
                    center: { latitude: loc.lat, longitude: loc.lng },
                    radius: 200,
                  },
                },
              }),
            },
          );
          if (!res.ok) continue;
          const json = (await res.json()) as { places?: { id: string }[] };
          if (!json.places?.length) continue;

          const names = list.slice(0, 3).map((i) => i.name);
          const listText =
            names.length === 1
              ? names[0]
              : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
          const days = Math.max(
            0,
            Math.round(
              (new Date(list[0].expiry_date + "T00:00:00Z").getTime() -
                new Date(iso(today) + "T00:00:00Z").getTime()) /
                86400000,
            ),
          );
          const when =
            days === 0
              ? "expire today"
              : days === 1
                ? "expire tomorrow"
                : `expire in ${days} days`;

          const payload = JSON.stringify({
            title: "You're at a supermarket! 🛒",
            body: `You already have ${listText} at home that ${when}. Consider using them before buying more.`,
            url: "/inventory",
            tag: "supermarket-nudge",
          });

          let delivered = false;
          for (const s of userSubs) {
            try {
              await webpush.sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                payload,
              );
              sent++;
              delivered = true;
            } catch (e: unknown) {
              const code = (e as { statusCode?: number })?.statusCode;
              if (code === 404 || code === 410) stale.push(s.endpoint);
            }
          }
          if (delivered) nudged.push(loc.user_id);
        }

        if (nudged.length) {
          await supabaseAdmin
            .from("user_locations")
            .update({ last_nudge_at: new Date().toISOString() })
            .in("user_id", nudged);
        }
        if (stale.length) {
          await supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .in("endpoint", stale);
        }

        return Response.json({ ok: true, sent, cleaned: stale.length });
      },
    },
  },
});
