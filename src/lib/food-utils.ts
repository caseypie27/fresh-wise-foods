import { differenceInCalendarDays, parseISO } from "date-fns";

export type FoodStatus = "fresh" | "expiring_soon" | "expired" | "consumed";

export function daysUntilExpiry(expiryDate: string): number {
  const d = typeof expiryDate === "string" ? parseISO(expiryDate) : expiryDate;
  return differenceInCalendarDays(d, new Date());
}

export function computeStatus(
  expiryDate: string,
  consumed: boolean,
): FoodStatus {
  if (consumed) return "consumed";
  const days = daysUntilExpiry(expiryDate);
  if (days < 0) return "expired";
  if (days <= 3) return "expiring_soon";
  return "fresh";
}

export function statusColor(status: FoodStatus) {
  switch (status) {
    case "fresh":
      return {
        dot: "bg-success",
        text: "text-success",
        bar: "bg-success",
        ring: "ring-success/30",
      };
    case "expiring_soon":
      return {
        dot: "bg-warning",
        text: "text-warning-foreground",
        bar: "bg-warning",
        ring: "ring-warning/30",
      };
    case "expired":
      return {
        dot: "bg-destructive",
        text: "text-destructive",
        bar: "bg-destructive",
        ring: "ring-destructive/30",
      };
    case "consumed":
      return {
        dot: "bg-muted-foreground",
        text: "text-muted-foreground",
        bar: "bg-muted-foreground",
        ring: "ring-muted-foreground/20",
      };
  }
}

export function formatDaysLeft(expiryDate: string, consumed: boolean) {
  if (consumed) return "Consumed";
  const days = daysUntilExpiry(expiryDate);
  if (days < 0) return `${Math.abs(days)}d expired`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days <= 7) return `${days} days`;
  return `${days}d left`;
}

// --- Money (RM) ---
// Fallback average price per category (in RM) when the user didn't enter one.
const CATEGORY_PRICE_RM: Record<string, number> = {
  dairy: 8,
  milk: 8,
  cheese: 15,
  meat: 22,
  poultry: 18,
  seafood: 28,
  fish: 25,
  vegetables: 5,
  vegetable: 5,
  fruits: 7,
  fruit: 7,
  bakery: 6,
  bread: 5,
  grains: 10,
  rice: 12,
  pantry: 8,
  snacks: 6,
  beverages: 8,
  frozen: 15,
  condiments: 9,
  eggs: 12,
  default: 8,
};

export function estimatePrice(category?: string | null): number {
  if (!category) return CATEGORY_PRICE_RM.default;
  const key = category.trim().toLowerCase();
  return CATEGORY_PRICE_RM[key] ?? CATEGORY_PRICE_RM.default;
}

export function itemValue(item: {
  price?: number | null;
  category?: string | null;
  quantity?: number | null;
}): number {
  const unit =
    typeof item.price === "number" && item.price > 0
      ? Number(item.price)
      : estimatePrice(item.category);
  const qty =
    typeof item.quantity === "number" && item.quantity > 0
      ? Number(item.quantity)
      : 1;
  return unit * qty;
}

export function formatRM(value: number): string {
  return `RM ${value.toFixed(2)}`;
}
