import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ScanLine, BellRing, ChefHat, Bell } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
});

const slides = [
  {
    icon: ScanLine,
    title: "Track expiry dates easily",
    body: "Snap food packaging and FreshTrack reads the expiry date for you with AI-powered OCR.",
  },
  {
    icon: BellRing,
    title: "Never miss an expiry",
    body: "Get gentle reminders before food goes off, so nothing in your fridge gets forgotten.",
  },
  {
    icon: ChefHat,
    title: "Turn ingredients into meals",
    body: "Get recipe ideas built around what's about to expire — and waste less every week.",
  },
];

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [permissionStep, setPermissionStep] = useState(false);

  const next = () => {
    if (step < slides.length - 1) setStep(step + 1);
    else setPermissionStep(true);
  };

  const requestNotifications = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        await Notification.requestPermission();
      } catch {
        /* noop */
      }
    }
    navigate({ to: "/auth" });
  };

  if (permissionStep) {
    return (
      <div className="app-shell min-h-screen flex flex-col px-6 py-12 bg-gradient-to-b from-primary-soft via-background to-background">
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-6 animate-in fade-in duration-500">
          <div className="size-20 rounded-3xl bg-primary text-primary-foreground grid place-items-center">
            <Bell className="size-9" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Stay updated</h2>
            <p className="mt-3 text-muted-foreground max-w-xs">
              Enable notifications to receive expiry reminders and fresh recipe suggestions.
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <button
            onClick={requestNotifications}
            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-medium"
          >
            Allow notifications
          </button>
          <button
            onClick={() => navigate({ to: "/auth" })}
            className="w-full h-12 rounded-2xl text-muted-foreground font-medium"
          >
            Not now
          </button>
        </div>
      </div>
    );
  }

  const Slide = slides[step];
  const Icon = Slide.icon;
  return (
    <div className="app-shell min-h-screen flex flex-col px-6 py-12">
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {slides.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-8 bg-primary" : "w-1.5 bg-border"
              }`}
            />
          ))}
        </div>
        <button
          onClick={() => setPermissionStep(true)}
          className="text-sm text-muted-foreground font-medium"
        >
          Skip
        </button>
      </div>
      <div
        key={step}
        className="flex-1 flex flex-col items-center justify-center text-center gap-8 animate-in fade-in duration-500"
      >
        <div className="size-28 rounded-[2rem] bg-primary-soft text-primary grid place-items-center">
          <Icon className="size-12" strokeWidth={1.8} />
        </div>
        <div className="max-w-xs">
          <h2 className="text-2xl font-semibold tracking-tight">{Slide.title}</h2>
          <p className="mt-3 text-muted-foreground">{Slide.body}</p>
        </div>
      </div>
      <button
        onClick={next}
        className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-medium"
      >
        {step < slides.length - 1 ? "Continue" : "Get started"}
      </button>
    </div>
  );
}
