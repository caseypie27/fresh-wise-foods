import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFoodItems } from "@/lib/items.functions";
import { getMyProfile } from "@/lib/profile.functions";
import { suggestRecipes } from "@/lib/ai.functions";
import { FoodCard } from "@/components/food-card";
import { computeStatus, itemValue, formatRM } from "@/lib/food-utils";
import { Sparkles, ChefHat, Camera, Plus, Wallet, TrendingDown, BellRing } from "lucide-react";
import { format, parseISO, isBefore } from "date-fns";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { savePushSubscription, sendTestNotification } from "@/lib/push.functions";
import { pushSupported, subscribePush, currentPushEndpoint } from "@/lib/push-client";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "Home — FreshTrack" }] }),
  component: Home,
});

function greet() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function Home() {
  const router = useRouter();
  const fetchItems = useServerFn(listFoodItems);
  const fetchProfile = useServerFn(getMyProfile);
  const fetchRecipes = useServerFn(suggestRecipes);

  const itemsQ = useSuspenseQuery({
    queryKey: ["items"],
    queryFn: () => fetchItems(),
  });
  const profileQ = useSuspenseQuery({
    queryKey: ["profile"],
    queryFn: () => fetchProfile(),
  });

  const items = itemsQ.data.items.map((i) => ({
    ...i,
    status: computeStatus(i.expiry_date, i.status === "consumed"),
  }));
  const active = items.filter((i) => i.status !== "consumed");
  const expiringToday = active.filter((i) => i.status === "expiring_soon" && new Date(i.expiry_date).toDateString() === new Date().toDateString());
  const expiringWeek = active.filter((i) => {
    const d = (new Date(i.expiry_date).getTime() - Date.now()) / 86400000;
    return d >= 0 && d <= 7;
  });
  const expired = items.filter((i) => i.status === "expired");
  const consumed = items.filter((i) => i.status === "consumed");

  // Money impact (RM)
  let savedRM = 0;
  let wastedRM = 0;
  for (const i of items) {
    const value = itemValue(i);
    if (i.status === "consumed" && i.consumed_at) {
      const consumedAt = parseISO(i.consumed_at);
      const expiry = parseISO(i.expiry_date);
      if (
        isBefore(consumedAt, expiry) ||
        consumedAt.toDateString() === expiry.toDateString()
      ) {
        savedRM += value;
      } else {
        wastedRM += value;
      }
    } else if (i.status === "expired") {
      wastedRM += value;
    }
  }
  const atRiskRM = expiringWeek.reduce((s, i) => s + itemValue(i), 0);

  const soonest = active
    .filter((i) => i.status !== "expired")
    .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date))
    .slice(0, 5);

  const nearExpiryNames = active
    .filter((i) => i.status === "expiring_soon")
    .slice(0, 6)
    .map((i) => i.name);

  const recipesQ = useQuery({
    queryKey: ["recipes", "home", nearExpiryNames],
    queryFn: () => fetchRecipes({ data: { ingredients: nearExpiryNames } }),
    enabled: nearExpiryNames.length > 0,
    staleTime: 5 * 60_000,
  });
  const topRecipe = recipesQ.data?.recipes?.[0];

  const name = profileQ.data.profile?.display_name ?? "there";

  return (
    <div className="px-5 pt-12">
      <header className="flex justify-between items-center">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
            {format(new Date(), "EEEE, MMM d")}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greet()}, {name.split(" ")[0]}
          </h1>
        </div>
        <Link
          to="/profile"
          className="size-10 rounded-full bg-primary-soft text-primary grid place-items-center font-semibold ring-1 ring-black/5"
        >
          {name.charAt(0).toUpperCase()}
        </Link>
      </header>

      {/* Money impact hero */}
      <section className="mt-6 relative overflow-hidden rounded-[28px] p-5 bg-gradient-to-br from-primary via-primary to-[oklch(0.52_0.17_150)] text-primary-foreground">
        <div className="absolute -right-14 -top-14 size-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest opacity-80 font-semibold flex items-center gap-1.5">
              <Wallet className="size-3" /> Money saved
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums leading-none">
              {formatRM(savedRM)}
            </p>
            <p className="text-[11px] opacity-80 mt-1">
              across {consumed.length} consumed item{consumed.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest opacity-80 font-semibold flex items-center gap-1.5 justify-end">
              <TrendingDown className="size-3" /> Wasted
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums leading-none">
              {formatRM(wastedRM)}
            </p>
          </div>
        </div>
        {atRiskRM > 0 && (
          <div className="relative mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1.5 text-[11px] font-medium">
            <span className="size-1.5 rounded-full bg-white animate-pulse" />
            {formatRM(atRiskRM)} at risk this week
          </div>
        )}
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3">
        <StatCard label="Total items" value={active.length} dot="bg-primary" />
        <StatCard
          label="Expiring this week"
          value={expiringWeek.length}
          dot="bg-warning"
        />
        <StatCard
          label="Expiring today"
          value={expiringToday.length}
          dot="bg-destructive"
        />
        <StatCard
          label="Waste prevented"
          value={consumed.length}
          dot="bg-success"
          suffix=" items"
        />
      </section>

      <section className="mt-6 flex gap-2 overflow-x-auto pb-2 -mx-5 px-5 no-scrollbar">
        <Link
          to="/add"
          className="flex-none h-10 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2"
        >
          <Plus className="size-4" /> Add item
        </Link>
        <Link
          to="/add"
          search={{ mode: "scan" }}
          className="flex-none h-10 px-4 rounded-full bg-surface text-foreground text-sm font-medium ring-1 ring-border flex items-center gap-2"
        >
          <Camera className="size-4" /> Scan food
        </Link>
        <Link
          to="/recipes"
          className="flex-none h-10 px-4 rounded-full bg-surface text-foreground text-sm font-medium ring-1 ring-border flex items-center gap-2"
        >
          <ChefHat className="size-4" /> Recipes
        </Link>
      </section>

      {topRecipe && (
        <section className="mt-6 bg-primary-soft p-5 rounded-3xl">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h3 className="text-sm font-semibold text-primary">Recipe match</h3>
          </div>
          <p className="text-base font-medium mt-1 leading-snug">
            {topRecipe.title}
          </p>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {topRecipe.description}
          </p>
          <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>⏱ {topRecipe.cooking_time_minutes} min</span>
            <span>•</span>
            <span>{topRecipe.difficulty}</span>
          </div>
          <Link
            to="/recipes"
            className="mt-4 inline-block text-sm font-medium text-primary"
          >
            See all suggestions →
          </Link>
        </section>
      )}

      <section className="mt-8 space-y-4">
        <div className="flex justify-between items-end">
          <h2 className="text-lg font-semibold tracking-tight">Expiring soon</h2>
          <Link to="/inventory" className="text-sm font-medium text-primary">
            See all
          </Link>
        </div>
        {soonest.length === 0 ? (
          <EmptyState
            title="Nothing tracked yet"
            body="Add your first item to start tracking expiry dates."
            action={
              <Link
                to="/add"
                className="inline-flex h-10 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium items-center"
              >
                <Plus className="size-4 mr-1" /> Add item
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {soonest.map((i) => (
              <FoodCard key={i.id} item={i} />
            ))}
          </div>
        )}
      </section>

      {expired.length > 0 && (
        <p className="mt-4 text-xs text-destructive">
          {expired.length} expired item{expired.length > 1 ? "s" : ""} —
          <Link to="/inventory" className="ml-1 underline">
            review
          </Link>
        </p>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  dot,
  suffix,
}: {
  label: string;
  value: number;
  dot: string;
  suffix?: string;
}) {
  return (
    <div className="bg-surface p-4 rounded-2xl ring-1 ring-black/5 flex flex-col justify-between h-28">
      <div className="flex items-center gap-2">
        <span className={`size-2 rounded-full ${dot}`} />
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
      </div>
      <div>
        <span className="text-3xl font-semibold block leading-none">
          {value}
        </span>
        {suffix && (
          <span className="text-[11px] text-muted-foreground">{suffix}</span>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-surface rounded-2xl ring-1 ring-black/5 p-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
