import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFoodItems } from "@/lib/items.functions";
import { computeStatus, statusColor } from "@/lib/food-utils";
import { useMemo, useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameDay,
  parseISO,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Calendar — FreshTrack" }] }),
  component: CalendarPage,
});

function CalendarPage() {
  const fetchItems = useServerFn(listFoodItems);
  const itemsQ = useSuspenseQuery({
    queryKey: ["items"],
    queryFn: () => fetchItems(),
  });
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState(new Date());

  const items = useMemo(
    () =>
      itemsQ.data.items
        .filter((i) => i.status !== "consumed")
        .map((i) => ({
          ...i,
          status: computeStatus(i.expiry_date, false),
        })),
    [itemsQ.data.items],
  );

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursor)),
    end: endOfWeek(endOfMonth(cursor)),
  });

  const dayItems = items.filter((i) =>
    isSameDay(parseISO(i.expiry_date), selected),
  );

  return (
    <div className="px-5 pt-12">
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
          Plan your week
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
      </header>

      <div className="mt-6 bg-surface rounded-3xl p-4 ring-1 ring-black/5">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setCursor(subMonths(cursor, 1))}
            className="size-8 rounded-full grid place-items-center hover:bg-muted"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </button>
          <h2 className="text-sm font-semibold">
            {format(cursor, "MMMM yyyy")}
          </h2>
          <button
            onClick={() => setCursor(addMonths(cursor, 1))}
            className="size-8 rounded-full grid place-items-center hover:bg-muted"
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground mb-1">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const inMonth = d.getMonth() === cursor.getMonth();
            const isSel = isSameDay(d, selected);
            const dayItms = items.filter((i) =>
              isSameDay(parseISO(i.expiry_date), d),
            );
            const worst = dayItms.find((i) => i.status === "expired")
              ? "expired"
              : dayItms.find((i) => i.status === "expiring_soon")
                ? "expiring_soon"
                : dayItms.length
                  ? "fresh"
                  : null;
            const color = worst ? statusColor(worst).dot : "";
            return (
              <button
                key={d.toISOString()}
                onClick={() => setSelected(d)}
                className={`aspect-square rounded-xl text-xs flex flex-col items-center justify-center gap-1 transition-colors ${
                  isSel
                    ? "bg-primary text-primary-foreground"
                    : inMonth
                      ? "text-foreground hover:bg-muted"
                      : "text-muted-foreground/40"
                }`}
              >
                <span className="leading-none">{format(d, "d")}</span>
                {worst && (
                  <span
                    className={`size-1.5 rounded-full ${isSel ? "bg-primary-foreground" : color}`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold mb-3">
          {format(selected, "EEEE, MMM d")}
        </h3>
        {dayItems.length === 0 ? (
          <p className="text-sm text-muted-foreground bg-surface p-5 rounded-2xl ring-1 ring-black/5 text-center">
            Nothing expires on this day.
          </p>
        ) : (
          <div className="space-y-2">
            {dayItems.map((i) => {
              const c = statusColor(i.status);
              return (
                <div
                  key={i.id}
                  className="flex items-center gap-3 bg-surface p-3 rounded-xl ring-1 ring-black/5"
                >
                  <span className={`size-2 rounded-full ${c.dot}`} />
                  <span className="text-sm font-medium flex-1">{i.name}</span>
                  <span className={`text-[10px] uppercase font-semibold ${c.text}`}>
                    {i.status.replace("_", " ")}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
