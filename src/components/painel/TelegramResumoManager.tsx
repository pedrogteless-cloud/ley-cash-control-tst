import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, ImageIcon, Loader2, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";

type Envio = {
  id: string;
  enviado_em: string;
  origem: "cron" | "manual";
  image_url: string;
  status_code: number | null;
  resposta: string | null;
  error_msg: string | null;
  timed_out: boolean | null;
};

type Status = { ativo: boolean; agenda: string; envios: Envio[] };

const QK = ["resumo_diario_status"] as const;

const fmtDataHora = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Fortaleza",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

/** Ainda sem resposta do pg_net e enviado há menos de 2 min. */
const isPendente = (e: Envio) =>
  e.status_code == null &&
  !e.error_msg &&
  !e.timed_out &&
  Date.now() - new Date(e.enviado_em).getTime() < 120_000;

function EnvioStatus({ e }: { e: Envio }) {
  if (e.status_code === 200) {
    return (
      <span className="inline-flex items-center gap-1 text-green">
        <CheckCircle2 className="h-3.5 w-3.5" /> Entregue
      </span>
    );
  }
  if (isPendente(e)) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Aguardando Telegram
      </span>
    );
  }
  if (e.status_code == null && !e.error_msg && !e.timed_out) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Clock className="h-3.5 w-3.5" /> Sem resposta registrada
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-red"
      title={e.resposta ?? e.error_msg ?? undefined}
    >
      <XCircle className="h-3.5 w-3.5" />
      Falhou{e.status_code ? ` (${e.status_code})` : e.timed_out ? " (tempo esgotado)" : ""}
    </span>
  );
}

export function TelegramResumoManager() {
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: QK,
    queryFn: async (): Promise<Status> => {
      const { data, error } = await supabase.rpc("resumo_diario_status");
      if (error) throw error;
      return data as unknown as Status;
    },
    // Enquanto houver envio aguardando resposta, atualiza a cada 3s
    refetchInterval: (q) => (q.state.data?.envios.some(isPendente) ? 3000 : false),
  });

  const ativoM = useMutation({
    mutationFn: async (ativo: boolean) => {
      const { error } = await supabase.rpc("set_resumo_diario_ativo", { p_ativo: ativo });
      if (error) throw error;
      return ativo;
    },
    onSuccess: (ativo) => {
      toast.success(ativo ? "Envio diário ativado" : "Envio diário pausado");
      qc.invalidateQueries({ queryKey: QK });
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  const enviarM = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("send_daily_cheques_table");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Resumo enviado ao Telegram — aguardando confirmação");
      qc.invalidateQueries({ queryKey: QK });
    },
    onError: (e: Error) => toast.error(`Erro ao enviar: ${e.message}`),
  });

  const ultimo = data?.envios[0];

  return (
    <div className="space-y-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <Send className="h-5 w-5 text-gold" /> Telegram
      </h2>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <div className="text-sm font-semibold text-foreground">Resumo do dia em imagem</div>
            <p className="text-xs text-muted-foreground">
              Tabelinha com enviado, recebido, carteira e saldo de caixa do dia, enviada no grupo do
              Telegram {data?.agenda ?? "todo dia às 18:30"}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-soft-foreground">
              <Switch
                checked={data?.ativo ?? false}
                disabled={!data || ativoM.isPending}
                onCheckedChange={(v) => ativoM.mutate(v)}
              />
              {data?.ativo ? "Ativo" : "Pausado"}
            </label>
            <button
              type="button"
              onClick={() => enviarM.mutate()}
              disabled={enviarM.isPending || !data}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-3 py-2 text-sm font-bold text-background transition-colors hover:bg-gold/90 disabled:opacity-50"
            >
              {enviarM.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Enviar agora
            </button>
          </div>
        </div>
        {data && !data.ativo && (
          <p className="mt-3 text-xs text-orange">
            Pausado: o envio automático das 18:30 não acontece. O botão "Enviar agora" continua
            funcionando.
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red/40 bg-red-dim/40 p-4 text-sm text-red">
          Não foi possível carregar o status: {(error as Error).message}
        </div>
      ) : !ultimo ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhum envio ainda. Use "Enviar agora" para testar.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                <ImageIcon className="h-4 w-4 text-gold" /> Último envio ·{" "}
                {fmtDataHora(ultimo.enviado_em)}
              </span>
              <EnvioStatus e={ultimo} />
            </div>
            <a href={ultimo.image_url} target="_blank" rel="noreferrer">
              <img
                src={ultimo.image_url}
                alt="Resumo do caixa de cheques enviado ao Telegram"
                className="w-full rounded-lg border border-border"
              />
            </a>
          </div>

          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border p-4 text-sm font-semibold text-foreground">
              Últimos envios
            </div>
            <table className="w-full text-sm">
              <tbody>
                {data!.envios.map((e) => (
                  <tr key={e.id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {fmtDataHora(e.enviado_em)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {e.origem === "cron" ? "Automático" : "Manual"}
                    </td>
                    <td className="px-4 py-3 text-right text-xs">
                      <EnvioStatus e={e} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
