import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFoodItems } from "@/lib/items.functions";
import { suggestRecipes } from "@/lib/ai.functions";
import { computeStatus } from "@/lib/food-utils";
import { ChefHat, Clock, Loader2, Sparkles, ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/recipes")({
  head: () => ({ meta: [{ title: "Recipes — FreshTrack" }] }),
  component: Recipes,
});

function Recipes() {
  const fetchItems = useServerFn(listFoodItems);
  const fetchRecipes = useServerFn(suggestRecipes);
  const itemsQ = useSuspenseQuery({
    queryKey: ["items"],
    queryFn: () => fetchItems(),
  });
  const active = useMemo(
    () =>
      itemsQ.data.items
        .map((i) => ({
          ...i,
          status: computeStatus(i.expiry_date, i.status === "consumed"),
        }))
        .filter(
          (i) => i.status === "expiring_soon" || i.status === "fresh",
        ),
    [itemsQ.data.items],
  );

  const [selected, setSelected] = useState<string[]>(() =>
    active.filter((i) => i.status === "expiring_soon").slice(0, 6).map((i) => i.name),
  );

  const recipesQ = useQuery({
    queryKey: ["recipes", selected],
    queryFn: () => fetchRecipes({ data: { ingredients: selected } }),
    enabled: selected.length > 0,
    staleTime: 5 * 60_000,
  });

  function toggle(name: string) {
    setSelected((s) =>
      s.includes(name) ? s.filter((n) => n !== name) : [...s, name],
    );
  }

  return (
    <div className="px-5 pt-12 pb-8">
      <div className="flex items-center gap-3">
        <Link
          to="/home"
          className="size-10 rounded-full grid place-items-center bg-surface ring-1 ring-border"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            AI suggestions
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Recipes</h1>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs text-muted-foreground mb-2">
          Pick ingredients you want to use up
        </p>
        <div className="flex gap-2 flex-wrap">
          {active.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Add items to your inventory to get recipe ideas.
            </p>
          )}
          {active.map((i) => {
            const on = selected.includes(i.name);
            return (
              <button
                key={i.id}
                onClick={() => toggle(i.name)}
                className={`h-8 px-3 rounded-full text-xs font-medium ring-1 transition-colors ${
                  on
                    ? "bg-primary text-primary-foreground ring-primary"
                    : "bg-surface text-foreground ring-border"
                }`}
              >
                {i.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {recipesQ.isFetching && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="size-4 animate-spin" />
            Cooking up ideas…
          </div>
        )}
        {!recipesQ.isFetching && selected.length === 0 && (
          <p className="text-sm text-muted-foreground bg-surface p-5 rounded-2xl ring-1 ring-black/5 text-center">
            Select at least one ingredient.
          </p>
        )}
        {recipesQ.data?.recipes?.map((r, idx) => (
          <details
            key={idx}
            className="group bg-surface rounded-3xl ring-1 ring-black/5 overflow-hidden"
          >
            <summary className="cursor-pointer list-none p-5">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-xl bg-primary-soft text-primary grid place-items-center shrink-0">
                  <ChefHat className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-3 text-primary" />
                    <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">
                      Uses {r.uses?.length ?? 0} of yours
                    </span>
                  </div>
                  <p className="text-base font-semibold mt-1 leading-tight">
                    {r.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {r.description}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {r.cooking_time_minutes} min
                    </span>
                    <span>•</span>
                    <span>{r.difficulty}</span>
                  </div>
                </div>
              </div>
            </summary>
            <div className="px-5 pb-5 pt-1 space-y-3 border-t border-border">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-3">
                  Ingredients
                </h4>
                <ul className="mt-2 space-y-1 text-sm">
                  {r.ingredients?.map((ing: string, i: number) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-primary">•</span>
                      {ing}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Instructions
                </h4>
                <ol className="mt-2 space-y-2 text-sm">
                  {r.instructions?.map((step: string, i: number) => (
                    <li key={i} className="flex gap-3">
                      <span className="text-primary font-semibold">
                        {i + 1}.
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
