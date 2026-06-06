import { useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const ONE_HOUR_MS = 60 * 60 * 1000;
const EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];

export function useInactivityLogout(timeoutMs = ONE_HOUR_MS) {
  const router = useRouter();
  const qc = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const logout = async () => {
      try {
        await qc.cancelQueries();
        qc.clear();
        await supabase.auth.signOut();
        toast.info("Sessão encerrada por inatividade.");
        router.navigate({ to: "/auth", replace: true });
      } catch (e) {
        console.error("inactivity logout failed", e);
      }
    };

    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(logout, timeoutMs);
    };

    reset();
    EVENTS.forEach((ev) => window.addEventListener(ev, reset, { passive: true }));
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      EVENTS.forEach((ev) => window.removeEventListener(ev, reset));
    };
  }, [router, qc, timeoutMs]);
}
