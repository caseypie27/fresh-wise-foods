import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import {
  computeStatus,
  formatDaysLeft,
  statusColor,
  daysUntilExpiry,
  type FoodStatus,
} from "@/lib/food-utils";

type Item = {
  id: string;
  name: string;
  category: string | null;
  quantity: number | null;
  unit: string | null;
  location: string | null;
  expiry_date: string;
  status: FoodStatus;
  image_url: string | null;
};

export function FoodCard({ item }: { item: Item }) {
  const status = computeStatus(item.status === "consumed" ? "" : item.expiry_date, item.status === "consumed");
  const colors = statusColor(status);
  const days = daysUntilExpiry(item.expiry_date);
  const progress =
    status === "expired"
      ? 100
      : status === "consumed"
        ? 100
        : Math.min(100, Math.max(8, 100 - (days / 14) * 100));
  return (
    <Link
      to="/item/$id"
      params={{ id: item.id }}
      className="block bg-surface p-3 rounded-2xl ring-1 ring-black/5 transition-colors hover:ring-black/10"
    >
      <div className="flex items-center gap-4">
        <div className="size-16 rounded-xl overflow-hidden shrink-0 bg-muted grid place-items-center">
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-xl">🥬</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold truncate">{item.name}</h3>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {[item.location, item.quantity && `${item.quantity}${item.unit ? ` ${item.unit}` : ""}`]
              .filter(Boolean)
              .join(" • ") || format(parseISO(item.expiry_date), "MMM d, yyyy")}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1 flex-1 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full ${colors.bar}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider ${colors.text}`}
            >
              {formatDaysLeft(item.expiry_date, item.status === "consumed")}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
