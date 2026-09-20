import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const WORKSPACE = "shahreena-meheron";
const DEFAULT_WORKFLOW = "food-expiry-scanner-1789203170630";

type Extracted = {
  name: string;
  expiry_date: string | null;
  raw_found: boolean;
};

// Normalise a variety of date strings to ISO YYYY-MM-DD
function toIsoDate(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input.trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  m = s.match(/^(\d{1,2})\s*[-/ ]?\s*([A-Za-z]{3,})\s*[-/ ]?\s*(\d{2,4})$/);
  if (m) {
    const mm = months[m[2].slice(0, 3).toLowerCase()];
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    if (mm) return `${year}-${mm}-${m[1].padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

// Walk the workflow output tree looking for the expected keys
function extract(node: unknown, acc: Extracted, depth = 0): Extracted {
  if (depth > 8 || node == null) return acc;
  if (Array.isArray(node)) {
    for (const n of node) extract(n, acc, depth + 1);
    return acc;
  }
  if (typeof node !== "object") return acc;
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    const k = key.toLowerCase();
    if (k === "expiry_date" || k === "expiry" || k === "expiration_date") {
      const iso = toIsoDate(
        typeof value === "object" && value !== null
          ? (value as { value?: unknown }).value
          : value,
      );
      if (iso) {
        acc.expiry_date = iso;
        acc.raw_found = true;
      }
      continue;
    }
    if (k === "food_name" || k === "product_name" || k === "name") {
      const v =
        typeof value === "object" && value !== null
          ? (value as { value?: unknown }).value
          : value;
      if (typeof v === "string" && v.trim() && !acc.name) {
        acc.name = v.trim();
        acc.raw_found = true;
      }
      continue;
    }
    extract(value, acc, depth + 1);
  }
  return acc;
}

export const scanWithRoboflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ imageDataUrl: z.string().min(20).max(8_000_000) }).parse(d),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.ROBOFLOW_API_KEY;
    if (!apiKey) throw new Error("Missing ROBOFLOW_API_KEY");
    const workflowId = process.env.ROBOFLOW_WORKFLOW_ID || DEFAULT_WORKFLOW;

    const base64 = data.imageDataUrl.includes(",")
      ? data.imageDataUrl.slice(data.imageDataUrl.indexOf(",") + 1)
      : data.imageDataUrl;

    const res = await fetch(
      `https://serverless.roboflow.com/infer/workflows/${WORKSPACE}/${workflowId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          inputs: { image: { type: "base64", value: base64 } },
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Roboflow error ${res.status}: ${text.slice(0, 300)}`);
    }

    const json = await res.json();
    const acc = extract(json?.outputs ?? json, {
      name: "",
      expiry_date: null,
      raw_found: false,
    });

    return {
      name: acc.name,
      expiry_date: acc.expiry_date,
      found: acc.raw_found && (!!acc.name || !!acc.expiry_date),
    };
  });
