import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFoodItems } from "@/lib/items.functions";
import { FoodCard } from "@/components/food-card";
import { computeStatus, type FoodStatus } from "@/lib/food-utils";
import { useState, useMemo } from "react";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({ meta: [{ title: "Inventory — FreshTrack" }] }),
  component: Inventory,
});

const FILTERS: { label: string; value: "all" | FoodStatus }[] = [
  { label: "All", value: "all" },
  { label: "Fresh", value: "fresh" },
  { label: "Expiring", value: "expiring_soon" },
  { label: "Expired", value: "expired" },
  { label: "Consumed", value: "consumed" },
];

function Inventory() {
  const fetchItems = useServerFn(listFoodItems);
  const itemsQ = useSuspenseQuery({
    queryKey: ["items"],
    queryFn: () => fetchItems(),
  });
  const [filter, setFilter] = useState<"all" | FoodStatus>("all");
  const [search, setSearch] = useState("");

  const items = useMemo(
    () =>
      itemsQ.data.items.map((i) => ({
        ...i,
        status: computeStatus(i.expiry_date, i.status === "consumed"),
      })),
    [itemsQ.data.items],
  );

  const filtered = items.filter((i) => {
    if (filter !== "all" && i.status !== filter) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  return (
    <div className="px-5 pt-12">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
            {items.length} items
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
        </div>
      </header>

      <div className="mt-5 relative">
        <Search className="size-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your kitchen…"
          className="w-full h-11 pl-11 pr-4 rounded-2xl bg-surface ring-1 ring-border text-sm"
        />
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto -mx-5 px-5 no-scrollbar">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`flex-none h-9 px-3.5 rounded-full text-sm font-medium ring-1 transition-colors ${
              filter === f.value
                ? "bg-primary text-primary-foreground ring-primary"
                : "bg-surface text-foreground ring-border"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            No items match.
          </p>
        ) : (
          filtered.map((i) => <FoodCard key={i.id} item={i} />)
        )}
      </div>
    </div>
  );
}
