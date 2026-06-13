import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Leaf } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/home" });
  },
  head: () => ({
    meta: [
      { title: "FreshTrack — Stay Fresh. Waste Less. Save More." },
      {
        name: "description",
        content:
          "Track food expiry dates, get smart recipe ideas from what's about to expire, and waste less every week.",
      },
      { property: "og:title", content: "FreshTrack" },
      {
        property: "og:description",
        content: "Stay Fresh. Waste Less. Save More.",
      },
    ],
  }),
  component: Splash,
});

function Splash() {
  return (
    <div className="app-shell min-h-screen flex flex-col items-center justify-between py-16 px-6 bg-gradient-to-b from-primary-soft via-background to-background">
      <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center animate-in fade-in duration-700">
        <div className="size-20 rounded-3xl bg-primary text-primary-foreground grid place-items-center shadow-lg shadow-primary/30">
          <Leaf className="size-10" strokeWidth={2.2} />
        </div>
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">FreshTrack</h1>
          <p className="mt-3 text-base text-muted-foreground max-w-xs">
            Stay Fresh. Waste Less. Save More.
          </p>
        </div>
      </div>
      <div className="w-full space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <Link
          to="/onboarding"
          className="block w-full h-12 rounded-2xl bg-primary text-primary-foreground font-medium text-center leading-[3rem] active:scale-[0.98] transition-transform"
        >
          Get started
        </Link>
        <Link
          to="/auth"
          className="block w-full h-12 rounded-2xl bg-surface text-foreground font-medium text-center leading-[3rem] ring-1 ring-border"
        >
          I have an account
        </Link>
      </div>
    </div>
  );
}
