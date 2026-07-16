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
import { useEffect, useMemo, useRef, useState } from "react";
import {
  format,
  startOfWeek,
  addWeeks,
  parseISO,
  isBefore,
  differenceInCalendarDays,
} from "date-fns";
import { Sparkles, TrendingUp, TrendingDown, Leaf, Trash2 } from "lucide-react";

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

  const { total, saved, wasted } = useMemo(() => {
    let saved = 0;
    let wasted = 0;
    for (const i of items) {
      if (i.status === "consumed" && i.consumed_at) {
        const consumedAt = parseISO(i.consumed_at);
        const expiry = parseISO(i.expiry_date);
        if (
          isBefore(consumedAt, expiry) ||
          format(consumedAt, "yyyy-MM-dd") === format(expiry, "yyyy-MM-dd")
        ) {
          saved++;
        } else {
          wasted++;
        }
      } else {
        const days = differenceInCalendarDays(
          parseISO(i.expiry_date),
          new Date(),
        );
        if (days < 0) {
          wasted++;
        }
      }
    }
    return { total: items.length, saved, wasted };
  }, [items]);

  const saveRate = total ? Math.round((saved / total) * 100) : 0;
  const wasteRate = total ? Math.round((wasted / total) * 100) : 0;

  // last 6 weeks saved vs wasted
  const weeks = useMemo(() => {
    const w = Array.from({ length: 6 }).map((_, idx) => {
      const start = startOfWeek(addWeeks(new Date(), -(5 - idx)));
      return { start, label: format(start, "MMM d"), saved: 0, wasted: 0 };
    });
    for (const i of items) {
      if (i.status === "consumed" && i.consumed_at) {
        const consumedAt = parseISO(i.consumed_at);
        const expiry = parseISO(i.expiry_date);
        const isSaved =
          isBefore(consumedAt, expiry) ||
          format(consumedAt, "yyyy-MM-dd") === format(expiry, "yyyy-MM-dd");
        const wk = w.find(
          (x) => consumedAt >= x.start && consumedAt < addWeeks(x.start, 1),
        );
        if (wk) {
          if (isSaved) wk.saved++;
          else wk.wasted++;
        }
      } else {
        const expiry = parseISO(i.expiry_date);
        const days = differenceInCalendarDays(expiry, new Date());
        if (days < 0) {
          const wk = w.find(
            (x) => expiry >= x.start && expiry < addWeeks(x.start, 1),
          );
          if (wk) wk.wasted++;
        }
      }
    }
    return w;
  }, [items]);

  // Trend: compare last 3 weeks vs previous 3 weeks
  const trend = useMemo(() => {
    const recent = weeks.slice(3).reduce((a, x) => a + x.saved, 0);
    const prev = weeks.slice(0, 3).reduce((a, x) => a + x.saved, 0);
    if (prev === 0 && recent === 0) return 0;
    if (prev === 0) return 100;
    return Math.round(((recent - prev) / prev) * 100);
  }, [weeks]);

  const [filter, setFilter] = useState<"all" | "saved" | "wasted">("all");

  return (
    <div className="px-5 pt-12 pb-8">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground mb-1">
            Insights
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Your impact</h1>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full bg-primary-soft text-primary px-2.5 py-1">
          <Sparkles className="size-3" />
          Live
        </span>
      </header>

      {/* Hero — save rate ring */}
      <section className="mt-6 relative overflow-hidden rounded-3xl p-5 text-primary-foreground bg-primary shadow-[0_20px_50px_-20px_var(--primary)]">
        <div
          aria-hidden
          className="absolute -top-16 -right-16 size-56 rounded-full bg-white/15 blur-2xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-20 -left-10 size-52 rounded-full bg-black/10 blur-2xl"
        />
        <div className="relative flex items-center gap-5">
          <SaveRateRing value={saveRate} />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
              Save rate
            </p>
            <p className="text-2xl font-semibold leading-tight mt-1">
              You're saving {saveRate}% of your food
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-2.5 py-1 text-[11px] font-medium">
              {trend >= 0 ? (
                <TrendingUp className="size-3.5" />
              ) : (
                <TrendingDown className="size-3.5" />
              )}
              {trend >= 0 ? "+" : ""}
              {trend}% vs last 3 weeks
            </div>
          </div>
        </div>
      </section>

      {/* Metric cards */}
      <section className="mt-4 grid grid-cols-2 gap-3">
        <MetricCard
          icon={<Leaf className="size-4" />}
          label="Consumed before expiry"
          value={saved}
          sub={`${saveRate}% of tracked`}
          tone="success"
        />
        <MetricCard
          icon={<Trash2 className="size-4" />}
          label="Expired / wasted"
          value={wasted}
          sub={`${wasteRate}% of tracked`}
          tone="destructive"
        />
      </section>

      {/* Split ratio bar */}
      <section className="mt-4 bg-surface rounded-2xl p-4 ring-1 ring-black/5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-muted-foreground">
            Saved vs wasted
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{total}</span> total
          </p>
        </div>
        <RatioBar saved={saved} wasted={wasted} />
        <div className="mt-3 flex items-center gap-4 text-[11px]">
          <LegendDot color="bg-success" label={`Saved · ${saved}`} />
          <LegendDot color="bg-destructive" label={`Wasted · ${wasted}`} />
        </div>
      </section>

      {/* Weekly chart with filter chips */}
      <section className="mt-4 bg-surface rounded-3xl p-5 ring-1 ring-black/5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold">Last 6 weeks</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Track your weekly trend
            </p>
          </div>
          <div className="inline-flex rounded-full bg-muted p-0.5 text-[11px] font-medium">
            {(["all", "saved", "wasted"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`px-2.5 py-1 rounded-full transition-colors capitalize ${
                  filter === k
                    ? "bg-surface text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
        <div className="h-52 mt-4 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeks} barCategoryGap={14}>
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                fontSize={10}
                tick={{ fill: "var(--color-muted-foreground)" }}
              />
              <Tooltip
                cursor={{ fill: "var(--color-muted)", radius: 12 }}
                contentStyle={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 12,
                  fontSize: 12,
                  boxShadow: "0 10px 30px -12px rgba(0,0,0,0.15)",
                }}
              />
              {(filter === "all" || filter === "saved") && (
                <Bar dataKey="saved" radius={[10, 10, 4, 4]} maxBarSize={22}>
                  {weeks.map((_, i) => (
                    <Cell key={i} fill="var(--color-primary)" />
                  ))}
                </Bar>
              )}
              {(filter === "all" || filter === "wasted") && (
                <Bar dataKey="wasted" radius={[10, 10, 4, 4]} maxBarSize={22}>
                  {weeks.map((_, i) => (
                    <Cell key={i} fill="var(--color-destructive)" />
                  ))}
                </Bar>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Highlight card */}
      <section className="mt-4 rounded-3xl p-5 bg-gradient-to-br from-primary-soft to-accent ring-1 ring-black/5">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-wider text-primary font-semibold">
            Waste prevented
          </p>
          <Leaf className="size-4 text-primary" />
        </div>
        <p className="text-4xl font-semibold tracking-tight mt-2">
          <AnimatedNumber value={saved} /> items
        </p>
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
          You kept {saved} item{saved === 1 ? "" : "s"} out of the bin.
          {wasteRate > 0 && ` Aim to bring waste below ${wasteRate}%.`}
        </p>
      </section>
    </div>
  );
}

function SaveRateRing({ value }: { value: number }) {
  const size = 92;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dur = 800;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  const offset = c - (display / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="currentColor"
          strokeOpacity={0.2}
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
          strokeDasharray={c}
          strokeDashoffset={offset}
          fill="none"
          style={{ transition: "stroke-dashoffset 0.2s linear" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="text-xl font-semibold">{display}%</span>
      </div>
    </div>
  );
}

function AnimatedNumber({ value }: { value: number }) {
  const [n, setN] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    let raf = 0;
    const from = prev.current;
    const start = performance.now();
    const dur = 700;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(from + (value - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
      else prev.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{n}</>;
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
  tone: "success" | "destructive";
}) {
  const toneClasses =
    tone === "success"
      ? "text-success bg-primary-soft"
      : "text-destructive bg-destructive/10";
  return (
    <div className="relative bg-surface p-4 rounded-2xl ring-1 ring-black/5 overflow-hidden group transition-transform active:scale-[0.98]">
      <div
        className={`inline-flex items-center justify-center size-8 rounded-xl ${toneClasses}`}
      >
        {icon}
      </div>
      <p className="text-[11px] font-medium text-muted-foreground mt-3 leading-tight">
        {label}
      </p>
      <p className="text-3xl font-semibold leading-none mt-1.5 tracking-tight">
        <AnimatedNumber value={value} />
      </p>
      <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}

function RatioBar({ saved, wasted }: { saved: number; wasted: number }) {
  const total = saved + wasted;
  const sPct = total ? (saved / total) * 100 : 0;
  const wPct = total ? (wasted / total) * 100 : 0;
  return (
    <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
      <div
        className="h-full bg-success transition-[width] duration-700 ease-out"
        style={{ width: `${sPct}%` }}
      />
      <div
        className="h-full bg-destructive transition-[width] duration-700 ease-out"
        style={{ width: `${wPct}%` }}
      />
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <span className={`size-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}
