import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { ArrowLeft, Camera, Upload, Pencil, Loader2, RotateCw } from "lucide-react";
import { createFoodItem } from "@/lib/items.functions";
import { scanFoodImage } from "@/lib/ai.functions";
import { scanWithRoboflow } from "@/lib/roboflow.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays } from "date-fns";

const search = z.object({ mode: z.enum(["scan", "manual"]).optional() });

export const Route = createFileRoute("/_authenticated/add")({
  ssr: false,
  validateSearch: search,
  head: () => ({ meta: [{ title: "Add item — FreshTrack" }] }),
  component: AddItem,
});

function AddItem() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { mode } = Route.useSearch();
  const [step, setStep] = useState<"choose" | "scanning" | "form">(
    mode === "scan" ? "scanning" : mode === "manual" ? "form" : "choose",
  );
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    category: "",
    quantity: "1",
    unit: "",
    location: "Fridge",
    expiry_date: format(addDays(new Date(), 7), "yyyy-MM-dd"),
    manufacturing_date: "",
    notes: "",
    price: "",
  });

  const scanFn = useServerFn(scanFoodImage);
  const roboflowFn = useServerFn(scanWithRoboflow);
  const createFn = useServerFn(createFoodItem);

  const scan = useMutation({
    mutationFn: async (imageDataUrl: string) => {
      // Primary: published Roboflow workflow (key stays server-side)
      try {
        const rf = await roboflowFn({ data: { imageDataUrl } });
        if (rf.found) {
          return {
            name: rf.name,
            category: "",
            expiry_date: rf.expiry_date,
            manufacturing_date: null,
          };
        }
      } catch {
        // fall through to the existing AI scan
      }
      return scanFn({ data: { imageDataUrl } });
    },
    onSuccess: (data) => {
      setForm((f) => ({
        ...f,
        name: data.name || f.name,
        category: data.category || f.category,
        expiry_date: data.expiry_date || f.expiry_date,
        manufacturing_date: data.manufacturing_date || f.manufacturing_date,
      }));
      setStep("form");
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Scan failed");
      setStep("form");
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      let image_url: string | null = null;
      if (imageDataUrl) {
        // upload to storage
        const blob = await (await fetch(imageDataUrl)).blob();
        const { data: u } = await supabase.auth.getUser();
        if (u.user) {
          const path = `${u.user.id}/${crypto.randomUUID()}.jpg`;
          const { error: upErr } = await supabase.storage
            .from("food-images")
            .upload(path, blob, { contentType: blob.type || "image/jpeg" });
          if (!upErr) {
            const { data: signed } = await supabase.storage
              .from("food-images")
              .createSignedUrl(path, 60 * 60 * 24 * 365);
            image_url = signed?.signedUrl ?? null;
          }
        }
      }
      return createFn({
        data: {
          name: form.name.trim(),
          category: form.category || null,
          quantity: form.quantity ? Number(form.quantity) : null,
          unit: form.unit || null,
          location: form.location || null,
          expiry_date: form.expiry_date,
          manufacturing_date: form.manufacturing_date || null,
          notes: form.notes || null,
          price: form.price ? Number(form.price) : null,
          image_url,
        },
      });
    },
    onSuccess: () => {
      toast.success("Added to your inventory");
      qc.invalidateQueries({ queryKey: ["items"] });
      navigate({ to: "/inventory" });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Couldn't save item"),
  });

  // Downscale + compress before sending to OCR — big upload/latency win
  function compressImage(file: File, maxSide = 1024, quality = 0.7) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read image"));
      reader.onload = () => {
        const src = reader.result as string;
        const img = new Image();
        img.onerror = () => resolve(src);
        img.onload = () => {
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(src);
          ctx.drawImage(img, 0, 0, w, h);
          try {
            resolve(canvas.toDataURL("image/jpeg", quality));
          } catch {
            resolve(src);
          }
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleFile(file: File) {
    setStep("scanning");
    try {
      const url = await compressImage(file);
      setImageDataUrl(url);
      scan.mutate(url);
    } catch {
      toast.error("Couldn't read that image");
      setStep("form");
    }
  }

  return (
    <div className="px-5 pt-12 pb-12">
      <button
        onClick={() => navigate({ to: "/home" })}
        className="size-10 rounded-full grid place-items-center bg-surface ring-1 ring-border"
        aria-label="Back"
      >
        <ArrowLeft className="size-4" />
      </button>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Add item</h1>

      {step === "choose" && (
        <div className="mt-8 space-y-3">
          <ChoiceCard
            icon={Camera}
            title="Take a photo"
            body="Use your camera to scan packaging"
            input={
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={(e) =>
                  e.target.files?.[0] && handleFile(e.target.files[0])
                }
              />
            }
          />
          <ChoiceCard
            icon={Upload}
            title="Upload image"
            body="Pick a photo from your library"
            input={
              <input
                type="file"
                accept="image/*"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={(e) =>
                  e.target.files?.[0] && handleFile(e.target.files[0])
                }
              />
            }
          />
          <button
            onClick={() => setStep("form")}
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-surface ring-1 ring-border text-left"
          >
            <div className="size-11 rounded-xl bg-primary-soft text-primary grid place-items-center">
              <Pencil className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Add manually</p>
              <p className="text-xs text-muted-foreground">
                Enter the details yourself
              </p>
            </div>
          </button>
        </div>
      )}

      {step === "scanning" && (
        <div className="mt-10 flex flex-col items-center gap-4">
          {imageDataUrl && (
            <img
              src={imageDataUrl}
              alt="scan"
              className="max-h-64 rounded-2xl ring-1 ring-border"
            />
          )}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span className="text-sm">Reading expiry & product name…</span>
          </div>
        </div>
      )}

      {step === "form" && (
        <div className="mt-6 space-y-4">
          {imageDataUrl && (
            <div className="flex items-center gap-3">
              <img
                src={imageDataUrl}
                alt="scan"
                className="size-20 rounded-2xl object-cover ring-1 ring-border"
              />
              <button
                onClick={() => scan.mutate(imageDataUrl)}
                disabled={scan.isPending}
                className="text-sm text-primary font-medium flex items-center gap-1"
              >
                <RotateCw className="size-3.5" /> Rescan
              </button>
            </div>
          )}
          <Field label="Product name">
            <input
              required
              maxLength={120}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
              placeholder="e.g. Organic milk"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <input
                maxLength={60}
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value })
                }
                className="input"
                placeholder="Dairy"
              />
            </Field>
            <Field label="Location">
              <select
                value={form.location}
                onChange={(e) =>
                  setForm({ ...form, location: e.target.value })
                }
                className="input"
              >
                <option>Fridge</option>
                <option>Freezer</option>
                <option>Pantry</option>
                <option>Counter</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity">
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.quantity}
                onChange={(e) =>
                  setForm({ ...form, quantity: e.target.value })
                }
                className="input"
              />
            </Field>
            <Field label="Unit">
              <input
                maxLength={20}
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="input"
                placeholder="L, g, pcs"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Expiry date">
              <input
                type="date"
                required
                value={form.expiry_date}
                onChange={(e) =>
                  setForm({ ...form, expiry_date: e.target.value })
                }
                className="input"
              />
            </Field>
            <Field label="Price (RM)">
              <input
                type="number"
                min="0"
                step="0.10"
                inputMode="decimal"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="input"
                placeholder="0.00"
              />
            </Field>
          </div>
          <Field label="Notes">
            <textarea
              maxLength={500}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input min-h-20 py-3"
            />
          </Field>

          <button
            disabled={!form.name || create.isPending}
            onClick={() => create.mutate()}
            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-medium disabled:opacity-60"
          >
            {create.isPending ? "Saving…" : "Save item"}
          </button>
        </div>
      )}

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

function ChoiceCard({
  icon: Icon,
  title,
  body,
  input,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  input?: React.ReactNode;
}) {
  return (
    <div className="relative flex items-center gap-4 p-4 rounded-2xl bg-surface ring-1 ring-border">
      <div className="size-11 rounded-xl bg-primary text-primary-foreground grid place-items-center">
        <Icon className="size-5" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{body}</p>
      </div>
      {input}
    </div>
  );
}
