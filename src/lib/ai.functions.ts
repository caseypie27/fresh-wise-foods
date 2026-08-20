import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callAI(body: unknown) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify(body),
  });
  if (res.status === 429)
    throw new Error("AI rate limit reached. Try again shortly.");
  if (res.status === 402)
    throw new Error("AI credits exhausted. Add credits to continue.");
  if (!res.ok) throw new Error(`AI error ${res.status}: ${await res.text()}`);
  return res.json();
}

// OCR — Detect product name + expiry from food packaging photo
export const scanFoodImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ imageDataUrl: z.string().min(20).max(8_000_000) }).parse(d),
  )
  .handler(async ({ data }) => {
    const result = await callAI({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "system",
          content:
            "You are an OCR assistant for grocery items. Given a photo of food packaging or fresh produce, extract the product name and expiry date if visible. Respond ONLY with strict JSON of shape: {\"name\": string, \"category\": string, \"expiry_date\": string|null, \"manufacturing_date\": string|null}. Dates must be ISO YYYY-MM-DD. If a date is not visible, use null. Category is a single short word like 'Dairy', 'Produce', 'Bakery', 'Meat', 'Pantry', 'Frozen', 'Beverage'.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract product info from this image." },
            { type: "image_url", image_url: { url: data.imageDataUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 200,
      temperature: 0,
    });
    const txt = result?.choices?.[0]?.message?.content ?? "{}";
    try {
      const parsed = JSON.parse(txt);
      return {
        name: typeof parsed.name === "string" ? parsed.name : "",
        category: typeof parsed.category === "string" ? parsed.category : "",
        expiry_date:
          typeof parsed.expiry_date === "string" ? parsed.expiry_date : null,
        manufacturing_date:
          typeof parsed.manufacturing_date === "string"
            ? parsed.manufacturing_date
            : null,
      };
    } catch {
      return {
        name: "",
        category: "",
        expiry_date: null,
        manufacturing_date: null,
      };
    }
  });

// Recipe suggestions from a list of ingredients near expiry
export const suggestRecipes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        ingredients: z.array(z.string().min(1).max(80)).min(1).max(20),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const result = await callAI({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content:
            "You are a creative home-cook assistant. Given ingredients close to expiry, propose 4 distinct recipes that use as many of them as possible. Prefer simple, well-known recipes. Respond ONLY with strict JSON: {\"recipes\":[{\"title\":string,\"description\":string,\"cooking_time_minutes\":number,\"difficulty\":\"Easy\"|\"Medium\"|\"Hard\",\"ingredients\":[string],\"instructions\":[string],\"uses\":[string]}]}. 'uses' is the subset of provided ingredients each recipe uses.",
        },
        {
          role: "user",
          content: `Ingredients near expiry: ${data.ingredients.join(", ")}`,
        },
      ],
      response_format: { type: "json_object" },
    });
    const txt = result?.choices?.[0]?.message?.content ?? "{}";
    try {
      const parsed = JSON.parse(txt);
      return { recipes: Array.isArray(parsed.recipes) ? parsed.recipes : [] };
    } catch {
      return { recipes: [] };
    }
  });
