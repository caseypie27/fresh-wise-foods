import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFoodItems } from "@/lib/items.functions";
import {
  BarChart,
  Bar,
  XAxis,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from "recharts";
import { useMemo } from "react";
import {
  format,
  startOfWeek,
  addWeeks,
  parseISO,
  isBefore,
  differenceInCalendarDays,
} from "date-fns";
import { itemValue, formatRM } from "@/lib/food-utils";
import { Leaf, TrendingUp, Trash2, Sparkles, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/stats")({
  head: () => ({ meta: [{ title: "Stats — FreshTrack" }] }),
  component: Stats,
});

function Stats() {
  const fetchItems = useServerFn(listFoodItems);
  const itemsQ = useSuspenseQuery({
    queryKey: ["items"],
    queryFn: () => fetchItems(),
  });

  const items = itemsQ.data.items;

  const { total, saved, wasted, savedRM, wastedRM } = useMemo(() => {
    let saved = 0;
    let wasted = 0;
    let savedRM = 0;
    let wastedRM = 0;
    for (const i of items) {
      const value = itemValue(i);
      if (i.status === "consumed" && i.consumed_at) {
        const consumedAt = parseISO(i.consumed_at);
        const expiry = parseISO(i.expiry_date);
        if (
          isBefore(consumedAt, expiry) ||
          format(consumedAt, "yyyy-MM-dd") === format(expiry, "yyyy-MM-dd")
        ) {
          saved++;
          savedRM += value;
        } else {
          wasted++;
          wastedRM += value;
        }
      } else {
        const days = differenceInCalendarDays(
          parseISO(i.expiry_date),
          new Date(),
        );
        if (days < 0) {
          wasted++;
          wastedRM += value;
        }
      }
    }
    return { total: items.length, saved, wasted, savedRM, wastedRM };
  }, [items]);

  const saveRate = total ? Math.round((saved / total) * 100) : 0;
  const totalRM = savedRM + wastedRM;
  const moneySaveRate = totalRM ? Math.round((savedRM / totalRM) * 100) : 0;

  const weeks = useMemo(() => {
    const arr = Array.from({ length: 6 }).map((_, idx) => {
      const start = startOfWeek(addWeeks(new Date(), -(5 - idx)));
      return { start, label: format(start, "MMM d"), saved: 0, wasted: 0 };
    });
    for (const i of items) {
      const value = itemValue(i);
      if (i.status === "consumed" && i.consumed_at) {
        const consumedAt = parseISO(i.consumed_at);
        const expiry = parseISO(i.expiry_date);
        const isSaved =
          isBefore(consumedAt, expiry) ||
          format(consumedAt, "yyyy-MM-dd") === format(expiry, "yyyy-MM-dd");
        const w = arr.find(
          (w) => consumedAt >= w.start && consumedAt < addWeeks(w.start, 1),
        );
        if (w) {
          if (isSaved) w.saved += value;
          else w.wasted += value;
        }
      } else {
        const expiry = parseISO(i.expiry_date);
        if (differenceInCalendarDays(expiry, new Date()) < 0) {
          const w = arr.find(
            (w) => expiry >= w.start && expiry < addWeeks(w.start, 1),
          );
          if (w) w.wasted += value;
        }
      }
    }
    return arr.map((w) => ({
      ...w,
      saved: Math.round(w.saved * 100) / 100,
      wasted: Math.round(w.wasted * 100) / 100,
    }));
  }, [items]);

  const bestWeek = weeks.reduce(
    (best, w) => (w.saved > best.saved ? w : best),
    weeks[0],
  );

  // Ring geometry
  const size = 128;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (saveRate / 100) * c;

  return (
    <div className="px-5 pt-12 pb-8 animate-in fade-in duration-500">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
            Insights
          </p>
          <h1 className="text-[28px] font-semibold tracking-tight leading-none">
            Your impact
          </h1>
        </div>
        <div className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-primary-soft text-primary text-xs font-semibold">
          <Sparkles className="size-3.5" />
          Live
        </div>
      </header>

      {/* Hero ring */}
      <section className="mt-6 relative overflow-hidden rounded-[28px] p-6 bg-gradient-to-br from-primary via-primary to-[oklch(0.52_0.17_150)] text-primary-foreground">
        <div className="absolute -right-16 -top-16 size-56 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -left-10 -bottom-16 size-48 rounded-full bg-white/5 blur-2xl" />
        <div className="relative flex items-center gap-5">
          <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke="rgba(255,255,255,0.18)"
                strokeWidth={stroke}
                fill="none"
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke="white"
                strokeWidth={stroke}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${dash} ${c}`}
                style={{ transition: "stroke-dasharray 900ms ease-out" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-semibold leading-none tabular-nums">
                {saveRate}%
              </span>
              <span className="text-[10px] uppercase tracking-widest mt-1 opacity-80">
                saved
              </span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-widest opacity-80 font-semibold">
              Save rate
            </p>
            <p className="mt-1 text-lg font-medium leading-snug">
              {saved} of {total} items reached your plate in time.
            </p>
            <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium bg-white/15 px-2.5 py-1 rounded-full backdrop-blur-sm">
              <ArrowUpRight className="size-3.5" />
              {wasteRate}% waste rate
            </div>
          </div>
        </div>
      </section>

      {/* Stat tiles */}
      <section className="mt-4 grid grid-cols-2 gap-3">
        <StatTile
          icon={Leaf}
          label="Consumed before expiry"
          value={saved}
          hint="Saved in time"
          tone="success"
        />
        <StatTile
          icon={Trash2}
          label="Expired or wasted"
          value={wasted}
          hint="Missed the window"
          tone="destructive"
        />
      </section>

      {/* Weekly chart */}
      <section className="mt-4 bg-surface rounded-3xl p-5 ring-1 ring-black/5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold">Weekly rhythm</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Saved vs wasted over 6 weeks
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-medium">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary" />
              Saved
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-destructive" />
              Wasted
            </span>
          </div>
        </div>
        <div className="h-52 mt-4 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeks} barCategoryGap={14} barGap={4}>
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                fontSize={10}
                tick={{ fill: "var(--color-muted-foreground)" }}
              />
              <Tooltip
                cursor={{ fill: "var(--color-muted)", opacity: 0.5 }}
                contentStyle={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 12,
                  fontSize: 12,
                  boxShadow: "0 8px 24px -12px rgba(0,0,0,0.15)",
                }}
              />
              <Bar dataKey="saved" radius={[8, 8, 0, 0]} maxBarSize={22}>
                {weeks.map((_, i) => (
                  <Cell key={i} fill="var(--color-primary)" />
                ))}
              </Bar>
              <Bar dataKey="wasted" radius={[8, 8, 0, 0]} maxBarSize={22}>
                {weeks.map((_, i) => (
                  <Cell key={i} fill="var(--color-destructive)" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Highlight card */}
      <section className="mt-4 rounded-3xl p-5 bg-surface ring-1 ring-black/5 flex items-center gap-4">
        <div className="size-12 rounded-2xl bg-primary-soft text-primary grid place-items-center">
          <TrendingUp className="size-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Best week
          </p>
          <p className="text-sm font-semibold mt-0.5">
            {bestWeek?.saved
              ? `${bestWeek.saved} items saved · ${bestWeek.label}`
              : "Start logging to unlock streaks"}
          </p>
        </div>
      </section>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  hint: string;
  tone: "success" | "destructive";
}) {
  const toneCls =
    tone === "success"
      ? {
          chip: "bg-primary-soft text-primary",
          value: "text-foreground",
          accent: "bg-primary",
        }
      : {
          chip: "bg-destructive/10 text-destructive",
          value: "text-foreground",
          accent: "bg-destructive",
        };
  return (
    <div className="relative overflow-hidden bg-surface p-4 rounded-2xl ring-1 ring-black/5 flex flex-col gap-3 transition-transform active:scale-[0.98]">
      <div className={`size-9 rounded-xl grid place-items-center ${toneCls.chip}`}>
        <Icon className="size-[18px]" />
      </div>
      <div>
        <span className={`text-3xl font-semibold leading-none tabular-nums ${toneCls.value}`}>
          {value}
        </span>
        <p className="text-[11px] font-medium text-muted-foreground mt-2 leading-tight">
          {label}
        </p>
        <p className="text-[10px] text-muted-foreground/70 mt-0.5">{hint}</p>
      </div>
      <span className={`absolute right-0 top-0 h-full w-1 ${toneCls.accent} opacity-70`} />
    </div>
  );
}
