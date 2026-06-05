import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "lancador_nf" | "lancador_caixa" | "diretoria";

export function useRoles() {
  const q = useQuery({
    queryKey: ["my-roles"],
    queryFn: async (): Promise<AppRole[]> => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.user) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", s.session.user.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
    staleTime: 60_000,
  });

  const roles = q.data ?? [];
  const has = (r: AppRole) => roles.includes(r);
  const isAdmin = has("admin");
  const canWriteNf = isAdmin || has("lancador_nf");
  const canWriteCaixa = isAdmin || has("lancador_caixa");
  const canWrite = canWriteNf || canWriteCaixa;

  return { roles, isAdmin, canWriteNf, canWriteCaixa, canWrite, loading: q.isLoading };
}
