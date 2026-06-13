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
