import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Leaf } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Welcome! Check your email if confirmation is required.");
        if (geolocationSupported() && !locationRemindersEnabled()) {
          try {
            await requestPosition();
            setLocationReminders(true);
            toast.info("Supermarket reminders on — we'll nudge you at the store");
          } catch {
            /* denied — continue */
          }
        }
        navigate({ to: "/home" });

      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate({ to: "/home" });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Password reset link sent.");
        setMode("signin");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function googleSignIn() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message || "Google sign-in failed");
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/home" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell min-h-screen flex flex-col px-6 py-12">
      <Link
        to="/"
        className="size-10 rounded-full grid place-items-center bg-surface ring-1 ring-border"
        aria-label="Back"
      >
        <ArrowLeft className="size-4" />
      </Link>

      <div className="mt-8 flex items-center gap-3">
        <div className="size-10 rounded-xl bg-primary text-primary-foreground grid place-items-center">
          <Leaf className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "signin"
              ? "Welcome back"
              : mode === "signup"
                ? "Create your account"
                : "Reset password"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "reset"
              ? "We'll email you a reset link"
              : "Keep your kitchen fresh"}
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-8 space-y-3">
        {mode === "signup" && (
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
              className="auth-input"
              placeholder="Alex Rivers"
            />
          </Field>
        )}
        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={255}
            className="auth-input"
            placeholder="you@email.com"
          />
        </Field>
        {mode !== "reset" && (
          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              maxLength={128}
              className="auth-input"
              placeholder="••••••••"
            />
          </Field>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-medium disabled:opacity-60"
        >
          {loading
            ? "Please wait…"
            : mode === "signin"
              ? "Sign in"
              : mode === "signup"
                ? "Create account"
                : "Send reset link"}
        </button>
      </form>

      {mode !== "reset" && (
        <>
          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            or continue with
            <div className="h-px flex-1 bg-border" />
          </div>
          <button
            onClick={googleSignIn}
            disabled={loading}
            className="w-full h-12 rounded-2xl bg-surface ring-1 ring-border font-medium flex items-center justify-center gap-2"
          >
            <GoogleIcon />
            Google
          </button>
        </>
      )}

      <div className="mt-6 flex items-center justify-between text-sm">
        <button
          className="text-muted-foreground"
          onClick={() =>
            setMode(mode === "signin" ? "signup" : "signin")
          }
        >
          {mode === "signin"
            ? "Need an account? Sign up"
            : "Have an account? Sign in"}
        </button>
        {mode === "signin" && (
          <button
            onClick={() => setMode("reset")}
            className="text-primary font-medium"
          >
            Forgot?
          </button>
        )}
        {mode === "reset" && (
          <button
            onClick={() => setMode("signin")}
            className="text-primary font-medium"
          >
            Back to sign in
          </button>
        )}
      </div>

      <style>{`
        .auth-input { width:100%; height:3rem; padding:0 1rem; border-radius:1rem; background:var(--color-surface); border:1px solid var(--color-border); font-size:0.95rem; outline:none; }
        .auth-input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 4px color-mix(in oklab, var(--color-primary) 18%, transparent); }
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

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.45c-.28 1.45-1.12 2.68-2.38 3.5v2.92h3.84c2.25-2.07 3.58-5.13 3.58-8.66z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.84-2.92c-1.07.72-2.43 1.16-4.09 1.16-3.14 0-5.8-2.12-6.76-4.97H1.27v3.07A11.99 11.99 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.24 14.36A7.21 7.21 0 0 1 4.86 12c0-.82.14-1.6.38-2.36V6.57H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.43l3.97-3.07z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.36.61 4.6 1.8l3.41-3.41C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.69 1.27 6.57l3.97 3.07C6.2 6.86 8.86 4.75 12 4.75z"
      />
    </svg>
  );
}
