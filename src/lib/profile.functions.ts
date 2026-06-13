import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [profile, prefs] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("*")
        .eq("id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", context.userId)
        .maybeSingle(),
    ]);
    return {
      profile: profile.data,
      preferences: prefs.data,
    };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        display_name: z.string().min(1).max(80).optional(),
        avatar_url: z.string().url().max(2048).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update(data)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updatePreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        notify_7_days: z.boolean().optional(),
        notify_3_days: z.boolean().optional(),
        notify_1_day: z.boolean().optional(),
        notify_expiry_day: z.boolean().optional(),
        dark_mode: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("notification_preferences")
      .update(data)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
