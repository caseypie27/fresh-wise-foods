import { VAPID_PUBLIC_KEY } from "./vapid";

export class PushSetupError extends Error {
  code: "blocked" | "dismissed" | "unsupported" | "insecure" | "registration";

  constructor(
    code: PushSetupError["code"],
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PushSetupError";
    this.code = code;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function pushPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

export function pushPermissionMessage(error: unknown): string {
  if (error instanceof PushSetupError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Couldn't enable notifications on this device";
}

export async function getRegistration(): Promise<ServiceWorkerRegistration> {
  if (!pushSupported()) {
    throw new PushSetupError(
      "unsupported",
      "Push notifications aren't supported in this browser",
    );
  }
  if (!window.isSecureContext) {
    throw new PushSetupError(
      "insecure",
      "Open FreshTrack using its secure https address to enable notifications",
    );
  }

  try {
    await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    const ready = await navigator.serviceWorker.ready;
    if (!ready.active) {
      throw new Error("The notification service did not become active");
    }
    return ready;
  } catch (error) {
    throw new PushSetupError(
      "registration",
      "FreshTrack couldn't start its notification service. Reload and try again",
      { cause: error },
    );
  }
}

function applicationServerKeyMatches(subscription: PushSubscription): boolean {
  const current = subscription.options.applicationServerKey;
  if (!current) return false;
  const expected = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  const actual = new Uint8Array(current);
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

export async function subscribePush(): Promise<{
  endpoint: string;
  keys: { p256dh: string; auth: string };
  user_agent: string;
}> {
  if (!pushSupported()) {
    throw new PushSetupError(
      "unsupported",
      "Push notifications aren't supported in this browser",
    );
  }
  if (!window.isSecureContext) {
    throw new PushSetupError(
      "insecure",
      "Open FreshTrack using its secure https address to enable notifications",
    );
  }
  const currentPermission = pushPermission();
  if (currentPermission === "unsupported") {
    throw new PushSetupError(
      "unsupported",
      "Push notifications aren't supported in this browser",
    );
  }
  if (currentPermission === "denied") {
    throw new PushSetupError(
      "blocked",
      "Notifications are blocked for this FreshTrack address. In Chrome, open Site settings, set Notifications to Allow, then reload FreshTrack",
    );
  }
  const permission =
    currentPermission === "granted"
      ? currentPermission
      : await Notification.requestPermission();
  if (permission === "denied") {
    throw new PushSetupError(
      "blocked",
      "Notifications are blocked for this FreshTrack address. In Chrome, open Site settings, set Notifications to Allow, then reload FreshTrack",
    );
  }
  if (permission !== "granted") {
    throw new PushSetupError(
      "dismissed",
      "Notification permission wasn't granted. Tap Enable when you're ready and choose Allow",
    );
  }

  const reg = await getRegistration();
  let sub = await reg.pushManager.getSubscription();
  if (sub && !applicationServerKeyMatches(sub)) {
    await sub.unsubscribe();
    sub = null;
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
    });
  }
  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!p256dh || !auth) {
    await sub.unsubscribe();
    throw new PushSetupError(
      "registration",
      "Chrome couldn't finish registering this device. Reload FreshTrack and try again",
    );
  }
  return {
    endpoint: sub.endpoint,
    keys: {
      p256dh,
      auth,
    },
    user_agent: navigator.userAgent,
  };
}

export async function unsubscribePush(): Promise<string | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!reg) return null;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  return endpoint;
}

export async function currentPushEndpoint(): Promise<string | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = await reg?.pushManager.getSubscription();
  return sub?.endpoint ?? null;
}
