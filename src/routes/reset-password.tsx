import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated");
      navigate({ to: "/home" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell min-h-screen px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
      <form onSubmit={submit} className="mt-8 space-y-3">
        <input
          type="password"
          required
          minLength={6}
          maxLength={128}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          className="w-full h-12 px-4 rounded-2xl bg-surface ring-1 ring-border"
        />
        <button
          disabled={loading}
          className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-medium"
        >
          {loading ? "Saving…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
