import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFoodItems } from "@/lib/items.functions";
import { computeStatus } from "@/lib/food-utils";
import {
  BarChart,
  Bar,
  XAxis,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from "recharts";
import { useMemo } from "react";
import { format, startOfWeek, addWeeks, parseISO } from "date-fns";

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

  const items = useMemo(
    () =>
      itemsQ.data.items.map((i) => ({
        ...i,
        derived: computeStatus(i.expiry_date, i.status === "consumed"),
      })),
    [itemsQ.data.items],
  );

  const total = items.length;
  const consumed = items.filter((i) => i.status === "consumed").length;
  const expired = items.filter((i) => i.derived === "expired").length;
  const saved = consumed;
  const wasteRate = total ? Math.round((expired / total) * 100) : 0;
  const savedRate = total ? Math.round((saved / total) * 100) : 0;

  // last 6 weeks consumed vs expired
  const weeks = Array.from({ length: 6 }).map((_, idx) => {
    const start = startOfWeek(addWeeks(new Date(), -(5 - idx)));
    return { start, label: format(start, "MMM d"), consumed: 0, expired: 0 };
  });
  for (const i of items) {
    if (i.status === "consumed" && i.consumed_at) {
      const t = parseISO(i.consumed_at);
      const w = weeks.find(
        (w) => t >= w.start && t < addWeeks(w.start, 1),
      );
      if (w) w.consumed++;
    }
    if (i.derived === "expired") {
      const t = parseISO(i.expiry_date);
      const w = weeks.find(
        (w) => t >= w.start && t < addWeeks(w.start, 1),
      );
      if (w) w.expired++;
    }
  }

  return (
    <div className="px-5 pt-12">
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
          Insights
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Your impact</h1>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-3">
        <BigStat label="Items tracked" value={total} />
        <BigStat label="Consumed in time" value={consumed} accent="success" />
        <BigStat label="Expired" value={expired} accent="destructive" />
        <BigStat label="Save rate" value={`${savedRate}%`} accent="success" />
      </section>

      <section className="mt-6 bg-surface rounded-3xl p-5 ring-1 ring-black/5">
        <h3 className="text-sm font-semibold mb-1">Last 6 weeks</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Items consumed before expiry vs items that expired.
        </p>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeks} barCategoryGap={12}>
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                fontSize={10}
              />
              <Tooltip cursor={{ fill: "var(--color-muted)" }} />
              <Bar dataKey="consumed" radius={[8, 8, 0, 0]}>
                {weeks.map((_, i) => (
                  <Cell key={i} fill="var(--color-primary)" />
                ))}
              </Bar>
              <Bar dataKey="expired" radius={[8, 8, 0, 0]}>
                {weeks.map((_, i) => (
                  <Cell key={i} fill="var(--color-destructive)" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mt-6 bg-primary-soft rounded-3xl p-5">
        <p className="text-xs uppercase tracking-wider text-primary font-semibold">
          Waste prevented
        </p>
        <p className="text-3xl font-semibold mt-1">{saved} items</p>
        <p className="text-xs text-muted-foreground mt-1">
          {wasteRate}% waste rate. Lower is better — keep it up.
        </p>
      </section>
    </div>
  );
}

function BigStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: "success" | "destructive";
}) {
  const accentClass =
    accent === "success"
      ? "text-success"
      : accent === "destructive"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div className="bg-surface p-4 rounded-2xl ring-1 ring-black/5 flex flex-col justify-between h-28">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className={`text-3xl font-semibold leading-none ${accentClass}`}>
        {value}
      </span>
    </div>
  );
}
