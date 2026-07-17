import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/expiry-reminders")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const webpush = (await import("web-push")).default;
        webpush.setVapidDetails(
          process.env.VAPID_SUBJECT || "mailto:notify@freshtrack.app",
          process.env.VAPID_PUBLIC_KEY!,
          process.env.VAPID_PRIVATE_KEY!,
        );

        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const iso = (offsetDays: number) => {
          const d = new Date(today);
          d.setUTCDate(d.getUTCDate() + offsetDays);
          return d.toISOString().slice(0, 10);
        };

        const { data: items } = await supabaseAdmin
          .from("food_items")
          .select("id, user_id, name, expiry_date, status")
          .neq("status", "consumed")
          .in("expiry_date", [iso(0), iso(1), iso(3), iso(7)]);

        if (!items?.length) return Response.json({ ok: true, sent: 0 });

        const userIds = [...new Set(items.map((i) => i.user_id))];
        const [{ data: prefs }, { data: subs }] = await Promise.all([
          supabaseAdmin
            .from("notification_preferences")
            .select("*")
            .in("user_id", userIds),
          supabaseAdmin
            .from("push_subscriptions")
            .select("*")
            .in("user_id", userIds),
        ]);

        const prefsByUser = new Map(prefs?.map((p) => [p.user_id, p]) ?? []);
        const subsByUser = new Map<string, typeof subs>();
        for (const s of subs ?? []) {
          const arr = subsByUser.get(s.user_id) ?? [];
          arr.push(s);
          subsByUser.set(s.user_id, arr);
        }

        const perUser = new Map<string, typeof items>();
        for (const it of items) {
          const days = Math.round(
            (new Date(it.expiry_date).getTime() - today.getTime()) / 86400000,
          );
          const p = prefsByUser.get(it.user_id);
          if (!p) continue;
          if (days === 0 && !p.notify_expiry_day) continue;
          if (days === 1 && !p.notify_1_day) continue;
          if (days === 3 && !p.notify_3_days) continue;
          if (days === 7 && !p.notify_7_days) continue;
          const arr = perUser.get(it.user_id) ?? [];
          arr.push(it);
          perUser.set(it.user_id, arr);
        }

        let sent = 0;
        const stale: string[] = [];
        for (const [userId, list] of perUser) {
          const userSubs = subsByUser.get(userId) ?? [];
          if (!userSubs.length) continue;
          const soonest = list.sort((a, b) =>
            a.expiry_date.localeCompare(b.expiry_date),
          );
          const preview = soonest.slice(0, 2).map((i) => i.name).join(", ");
          const extra = soonest.length > 2 ? ` +${soonest.length - 2} more` : "";
          const payload = JSON.stringify({
            title: `${soonest.length} item${soonest.length > 1 ? "s" : ""} expiring soon`,
            body: `${preview}${extra}`,
            url: "/home",
            tag: "expiry-" + soonest[0].expiry_date,
          });
          for (const s of userSubs) {
            try {
              await webpush.sendNotification(
                {
                  endpoint: s.endpoint,
                  keys: { p256dh: s.p256dh, auth: s.auth },
                },
                payload,
              );
              sent++;
            } catch (e: unknown) {
              const code = (e as { statusCode?: number })?.statusCode;
              if (code === 404 || code === 410) stale.push(s.endpoint);
            }
          }
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
