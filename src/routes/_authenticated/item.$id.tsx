import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFoodItems, deleteFoodItem, markConsumed, updateFoodItem } from "@/lib/items.functions";
import { computeStatus, statusColor, formatDaysLeft } from "@/lib/food-utils";
import { ArrowLeft, Check, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";

export const Route = createFileRoute("/_authenticated/item/$id")({
  head: () => ({ meta: [{ title: "Item — FreshTrack" }] }),
  component: ItemDetail,
});

function ItemDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchItems = useServerFn(listFoodItems);
  const updateFn = useServerFn(updateFoodItem);
  const delFn = useServerFn(deleteFoodItem);
  const consFn = useServerFn(markConsumed);

  const q = useSuspenseQuery({
    queryKey: ["items"],
    queryFn: () => fetchItems(),
  });
  const item = q.data.items.find((i) => i.id === id);
  const [form, setForm] = useState(() => ({
    name: item?.name ?? "",
    expiry_date: item?.expiry_date ?? "",
    notes: item?.notes ?? "",
  }));

  const status = useMemo(
    () =>
      item
        ? computeStatus(item.expiry_date, item.status === "consumed")
        : "fresh",
    [item],
  );

  const update = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          id,
          name: form.name,
          expiry_date: form.expiry_date,
          notes: form.notes,
        },
      }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["items"] });
    },
  });

  const consume = useMutation({
    mutationFn: () => consFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Marked as consumed");
      qc.invalidateQueries({ queryKey: ["items"] });
      navigate({ to: "/inventory" });
    },
  });

  const del = useMutation({
    mutationFn: () => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["items"] });
      navigate({ to: "/inventory" });
    },
  });

  if (!item) {
    return (
      <div className="px-5 pt-12">
        <p className="text-sm text-muted-foreground">Item not found.</p>
      </div>
    );
  }

  const colors = statusColor(status);

  return (
    <div className="px-5 pt-12 pb-12">
      <button
        onClick={() => navigate({ to: "/inventory" })}
        className="size-10 rounded-full grid place-items-center bg-surface ring-1 ring-border"
      >
        <ArrowLeft className="size-4" />
      </button>

      <div className="mt-6 flex items-center gap-4">
        <div className="size-20 rounded-2xl overflow-hidden bg-muted grid place-items-center">
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-3xl">🥗</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight truncate">
            {item.name}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <span className={`size-2 rounded-full ${colors.dot}`} />
            <span className={`text-xs font-semibold uppercase ${colors.text}`}>
              {formatDaysLeft(item.expiry_date, item.status === "consumed")}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Expires {format(parseISO(item.expiry_date), "MMM d, yyyy")}
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-4">
        <Field label="Name">
          <input
            value={form.name}
            maxLength={120}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Expiry date">
          <input
            type="date"
            value={form.expiry_date}
            onChange={(e) =>
              setForm({ ...form, expiry_date: e.target.value })
            }
            className="input"
          />
        </Field>
        <Field label="Notes">
          <textarea
            value={form.notes ?? ""}
            maxLength={500}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="input min-h-20 py-3"
          />
        </Field>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          onClick={() => update.mutate()}
          disabled={update.isPending}
          className="h-12 rounded-2xl bg-primary text-primary-foreground font-medium flex items-center justify-center gap-2"
        >
          <Save className="size-4" /> Save
        </button>
        <button
          onClick={() => consume.mutate()}
          disabled={item.status === "consumed" || consume.isPending}
          className="h-12 rounded-2xl bg-surface ring-1 ring-border font-medium flex items-center justify-center gap-2"
        >
          <Check className="size-4" /> Consumed
        </button>
      </div>

      <button
        onClick={() => {
          if (confirm("Delete this item?")) del.mutate();
        }}
        className="mt-3 w-full h-12 rounded-2xl text-destructive font-medium flex items-center justify-center gap-2"
      >
        <Trash2 className="size-4" /> Delete
      </button>

      <style>{`
        .input { width:100%; height:2.75rem; padding:0 0.9rem; border-radius:1rem; background:var(--color-surface); border:1px solid var(--color-border); font-size:0.9rem; outline:none; }
        .input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 4px color-mix(in oklab, var(--color-primary) 18%, transparent); }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted-foreground mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}
