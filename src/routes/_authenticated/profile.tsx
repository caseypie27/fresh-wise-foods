import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile, updatePreferences, updateProfile } from "@/lib/profile.functions";
import {
  savePushSubscription,
  removePushSubscription,
  sendTestNotification,
} from "@/lib/push.functions";
import {
  pushSupported,
  subscribePush,
  unsubscribePush,
  currentPushEndpoint,
} from "@/lib/push-client";
import { supabase } from "@/integrations/supabase/client";
import {
  geolocationSupported,
  locationRemindersEnabled,
  setLocationReminders,
  requestPosition,
} from "@/lib/location-client";
import {
  checkSupermarketProximity,
  saveMyLocation,
  setLocationRemindersPref,
} from "@/lib/geo.functions";
import { Bell, BellRing, Moon, LogOut, ShieldCheck, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";


export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — FreshTrack" }] }),
  component: Profile,
});

function Profile() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const updatePrefsFn = useServerFn(updatePreferences);
  const updateProfileFn = useServerFn(updateProfile);

  const q = useSuspenseQuery({
    queryKey: ["profile"],
    queryFn: () => fetchProfile(),
  });

  const profile = q.data.profile;
  const prefs = q.data.preferences;
  const [name, setName] = useState(profile?.display_name ?? "");

  const [pushOn, setPushOn] = useState<boolean>(false);
  const [pushBusy, setPushBusy] = useState(false);
  const saveSub = useServerFn(savePushSubscription);
  const removeSub = useServerFn(removePushSubscription);
  const testFn = useServerFn(sendTestNotification);

  const [locOn, setLocOn] = useState(false);
  const [locBusy, setLocBusy] = useState(false);
  const checkNearby = useServerFn(checkSupermarketProximity);
  const pingLocation = useServerFn(saveMyLocation);
  const setRemindersPref = useServerFn(setLocationRemindersPref);

  useEffect(() => {
    setLocOn(locationRemindersEnabled());
  }, []);

  async function toggleLocation(next: boolean) {
    if (!next) {
      setLocationReminders(false);
      setLocOn(false);
      setRemindersPref({ data: { enabled: false } }).catch(() => {});
      toast.success("Supermarket reminders off");
      return;
    }
    if (!geolocationSupported()) {
      toast.error("Location isn't supported on this device");
      return;
    }
    setLocBusy(true);
    try {
      const pos = await requestPosition();
      setLocationReminders(true);
      setLocOn(true);
      // Store the position so reminders can be sent while the app is closed.
      await pingLocation({
        data: {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          enabled: true,
        },
      }).catch(() => {});
      if (!pushOn && pushSupported()) {
        try {
          const sub = await subscribePush();
          await saveSub({ data: sub });
          setPushOn(true);
        } catch {
          toast.info("Turn on push notifications to get store reminders");
        }
      }
      toast.success("Supermarket reminders on");
      const res = await checkNearby({
        data: { lat: pos.coords.latitude, lng: pos.coords.longitude },
      });
      if (res.nearby && res.sent > 0) toast.info("You're near a store — sent you a nudge");
    } catch (e) {
      toast.error(
        e instanceof Error && e.message.includes("denied")
          ? "Location permission denied"
          : "Couldn't get your location",
      );
    } finally {
      setLocBusy(false);
    }
  }



  useEffect(() => {
    if (prefs?.dark_mode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [prefs?.dark_mode]);

  useEffect(() => {
    if (!pushSupported()) return;
    currentPushEndpoint().then((e) => setPushOn(!!e));
  }, []);

  async function togglePush(next: boolean) {
    if (!pushSupported()) {
      toast.error("Notifications not supported on this device");
      return;
    }
    setPushBusy(true);
    try {
      if (next) {
        const sub = await subscribePush();
        await saveSub({ data: sub });
        setPushOn(true);
        toast.success("Notifications enabled");
        testFn().catch(() => {});
      } else {
        const endpoint = await unsubscribePush();
        if (endpoint) await removeSub({ data: { endpoint } });
        setPushOn(false);
        toast.success("Notifications disabled");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update notifications");
    } finally {
      setPushBusy(false);
    }
  }

  async function ensurePushRegistered(silent = false) {
    if (pushOn) return true;
    if (!pushSupported()) {
      if (!silent) toast.error("Notifications not supported on this device");
      return false;
    }
    try {
      const sub = await subscribePush();
      await saveSub({ data: sub });
      setPushOn(true);
      if (!silent) toast.success("This device will now get reminders");
      return true;
    } catch (e) {
      if (!silent)
        toast.error(
          e instanceof Error ? e.message : "Couldn't enable notifications",
        );
      return false;
    }
  }

  const anyExpiryPrefOn =
    !!prefs?.notify_7_days ||
    !!prefs?.notify_3_days ||
    !!prefs?.notify_1_day ||
    !!prefs?.notify_expiry_day;

  const savePrefs = useMutation({
    mutationFn: async (patch: Record<string, boolean>) => {
      const isExpiryPref = Object.keys(patch).some((k) =>
        k.startsWith("notify_"),
      );
      const turningOn = Object.values(patch).some(Boolean);
      if (isExpiryPref && turningOn) await ensurePushRegistered();
      return updatePrefsFn({ data: patch });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });

  const saveName = useMutation({
    mutationFn: () => updateProfileFn({ data: { display_name: name } }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="px-5 pt-12">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>

      <section className="mt-6 bg-surface rounded-3xl p-5 ring-1 ring-black/5">
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-full bg-primary-soft text-primary text-xl grid place-items-center font-semibold">
            {(name || "?").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="w-full bg-transparent text-base font-semibold outline-none"
            />
            <p className="text-xs text-muted-foreground">Display name</p>
          </div>
          {name !== (profile?.display_name ?? "") && (
            <button
              onClick={() => saveName.mutate()}
              className="text-sm font-medium text-primary"
            >
              Save
            </button>
          )}
        </div>
      </section>

      <section className="mt-6">
        <SectionTitle icon={Bell}>Notifications</SectionTitle>
        <div className="mt-3 bg-surface rounded-2xl ring-1 ring-black/5 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-4 bg-primary-soft/50">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-primary text-primary-foreground grid place-items-center">
                <BellRing className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Push notifications</p>
                <p className="text-[11px] text-muted-foreground">
                  {pushOn ? "Enabled on this device" : "Get reminders before food expires"}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={pushBusy}
              onClick={() => togglePush(!pushOn)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                pushOn ? "bg-primary" : "bg-muted"
              } disabled:opacity-60`}
              role="switch"
              aria-checked={pushOn}
            >
              <span
                className={`absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform ${
                  pushOn ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
          <div className="divide-y divide-border">
            <Toggle
              label="7 days before expiry"
              checked={!!prefs?.notify_7_days}
              onChange={(v) => savePrefs.mutate({ notify_7_days: v })}
            />
            <Toggle
              label="3 days before"
              checked={!!prefs?.notify_3_days}
              onChange={(v) => savePrefs.mutate({ notify_3_days: v })}
            />
            <Toggle
              label="1 day before"
              checked={!!prefs?.notify_1_day}
              onChange={(v) => savePrefs.mutate({ notify_1_day: v })}
            />
            <Toggle
              label="On expiry day"
              checked={!!prefs?.notify_expiry_day}
              onChange={(v) => savePrefs.mutate({ notify_expiry_day: v })}
            />
          </div>
        </div>
      </section>

      <section className="mt-6">
        <SectionTitle icon={MapPin}>Location</SectionTitle>
        <div className="mt-3 bg-surface rounded-2xl ring-1 ring-black/5 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3 pr-3">
              <div className="size-9 rounded-xl bg-primary-soft text-primary grid place-items-center shrink-0">
                <MapPin className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Supermarket reminders</p>
                <p className="text-[11px] text-muted-foreground">
                  Nudge me at the store about food expiring at home, even when
                  the app is closed
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={locBusy}
              onClick={() => toggleLocation(!locOn)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                locOn ? "bg-primary" : "bg-muted"
              } disabled:opacity-60`}
              role="switch"
              aria-checked={locOn}
            >
              <span
                className={`absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform ${
                  locOn ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
          <p className="px-4 pb-4 text-[11px] text-muted-foreground">
            Your latest location is stored privately and checked every 15 minutes
            against nearby grocery stores, so reminders reach you even when
            FreshTrack isn't open. Only you can see it.
          </p>
        </div>
      </section>



      <section className="mt-6">
        <SectionTitle icon={Moon}>Appearance</SectionTitle>
        <div className="mt-3 bg-surface rounded-2xl ring-1 ring-black/5">
          <Toggle
            label="Dark mode"
            checked={!!prefs?.dark_mode}
            onChange={(v) => savePrefs.mutate({ dark_mode: v })}
          />
        </div>
      </section>

      <section className="mt-6">
        <SectionTitle icon={ShieldCheck}>Privacy</SectionTitle>
        <div className="mt-3 bg-surface rounded-2xl ring-1 ring-black/5 p-4 text-xs text-muted-foreground">
          Your food data stays private and is only visible to you.
        </div>
      </section>

      <button
        onClick={signOut}
        className="mt-8 w-full h-12 rounded-2xl bg-surface ring-1 ring-border text-destructive font-medium flex items-center justify-center gap-2"
      >
        <LogOut className="size-4" /> Sign out
      </button>
      <div className="h-12" />
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-1">
      <Icon className="size-4 text-muted-foreground" />
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {children}
      </h2>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between px-4 py-3.5">
      <span className="text-sm font-medium">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-muted"
        }`}
        role="switch"
        aria-checked={checked}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}
