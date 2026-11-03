import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LeyLogo } from "@/components/LeyLogo";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar · Painel de Cheques" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/", replace: true });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) navigate({ to: "/", replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error(result.error.message);
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <img src="/ley-monograma.png" alt="" aria-hidden className="pointer-events-none absolute -bottom-16 -left-24 w-[520px] max-w-none opacity-60" />
      <div className="relative w-full max-w-sm rounded-lg border border-border bg-card p-6">
        <div className="mb-6 flex flex-col items-center text-center">
          <LeyLogo className="h-14" />
          <div className="mt-3 h-1.5 w-[72px] rounded bg-[#4aa3ef]" />
          <h1 className="mt-3 text-lg font-extrabold text-foreground">Painel de Cheques</h1>
          <p className="mt-1 text-xs text-muted-foreground">Entre na sua conta</p>
        </div>

        <button
          onClick={onGoogle}
          disabled={loading}
          className="mb-4 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground hover:border-gold/40 transition-colors disabled:opacity-50"
        >
          Continuar com Google
        </button>

        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> ou <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email" required maxLength={120}
            value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="email@exemplo.com"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none"
          />
          <input
            type="password" required minLength={6} maxLength={72}
            value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none"
          />
          <button
            type="submit" disabled={loading}
            className="w-full rounded-lg bg-gold px-4 py-2.5 text-sm font-bold text-background hover:bg-gold/90 disabled:opacity-50"
          >
            {loading ? "..." : "Entrar"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Acesso restrito. Solicite a criação da sua conta ao administrador.
        </p>
      </div>
    </div>
  );
}
