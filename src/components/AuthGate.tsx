import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { LockKeyhole, Loader2, Spade } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;

      if (sessionError) {
        setError(sessionError.message);
      }

      setSession(data.session);
      setChecking(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setChecking(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (event: FormEvent) => {
    event.preventDefault();

    const normalizedEmail = email.trim();

    if (!normalizedEmail || !password) {
      setError("Enter your email and password.");
      return;
    }

    setSigningIn(true);
    setError(null);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    setSigningIn(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    setSession(data.session);
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking access…
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-lg bg-felt text-felt-foreground">
              <Spade className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Tournament Floor
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to access the tournament dashboard.
            </p>
          </div>

          <form
            onSubmit={signIn}
            className="space-y-4 rounded-xl border bg-card p-5 shadow-sm"
          >
            <div className="space-y-2">
              <Label htmlFor="auth_email">Email</Label>
              <Input
                id="auth_email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                className="h-11"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="auth_password">Password</Label>
              <Input
                id="auth_password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                className="h-11"
              />
            </div>

            {error && (
              <p className="text-sm font-medium text-destructive">{error}</p>
            )}

            <Button type="submit" className="h-11 w-full" disabled={signingIn}>
              {signingIn ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  <LockKeyhole className="h-4 w-4" />
                  Sign in
                </>
              )}
            </Button>
          </form>
        </div>
      </main>
    );
  }

  return children;
}
