import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ROLE = z.enum(["admin", "lancador_nf", "lancador_caixa", "diretoria"]);

export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Apenas administradores podem ver o time.");

    const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
      supabase.from("profiles").select("id, display_name, email, created_at"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (pErr) throw new Error(pErr.message);
    if (rErr) throw new Error(rErr.message);

    const rolesByUser = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    });

    return (profiles ?? []).map((p) => ({
      id: p.id,
      displayName: p.display_name,
      email: p.email,
      roles: rolesByUser.get(p.id) ?? [],
    }));
  });

export const setRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      role: ROLE,
      enabled: z.boolean(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Apenas administradores podem alterar papéis.");

    // Trava: admin não pode remover o próprio papel admin (evita lockout).
    if (data.userId === userId && data.role === "admin" && !data.enabled) {
      throw new Error("Você não pode remover seu próprio papel de admin.");
    }

    if (data.enabled) {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: data.userId, role: data.role });
      // ignora duplicata (unique constraint)
      if (error && !String(error.message).toLowerCase().includes("duplicate")) {
        throw new Error(error.message);
      }
    } else {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });
