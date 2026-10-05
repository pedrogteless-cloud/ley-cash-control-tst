// tabela-png — desenha uma tabela (no visual do Painel de Cheques) e devolve PNG.
//
// GET /functions/v1/tabela-png?d=<JSON em base64url>
// Função pública (verify_jwt = false): não lê o banco e não usa segredos, só
// desenha os números recebidos. Usada pelo resumo diário enviado ao Telegram
// (o Telegram baixa a imagem por esta URL no sendPhoto).

import { initWasm, Resvg } from "npm:@resvg/resvg-wasm@2.6.2";
import { buildSvg, decodeBase64Url, parseSpec, SpecError } from "./svg.ts";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm";
const FONT_BASE = "https://cdn.jsdelivr.net/npm/@expo-google-fonts/roboto@0.4.3";
const FONT_URLS = [
  `${FONT_BASE}/400Regular/Roboto_400Regular.ttf`,
  `${FONT_BASE}/400Regular_Italic/Roboto_400Regular_Italic.ttf`,
  `${FONT_BASE}/500Medium/Roboto_500Medium.ttf`,
  `${FONT_BASE}/700Bold/Roboto_700Bold.ttf`,
];
const MAX_PARAM = 8000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Carregados uma vez por instância da função
let ready: Promise<Uint8Array[]> | null = null;
function loadAssets() {
  ready ??= (async () => {
    await initWasm(fetch(WASM_URL));
    return await Promise.all(
      FONT_URLS.map(async (u) => {
        const res = await fetch(u);
        if (!res.ok) throw new Error(`font_fetch_failed ${res.status} ${u}`);
        return new Uint8Array(await res.arrayBuffer());
      }),
    );
  })().catch((e) => {
    ready = null; // permite nova tentativa na próxima requisição
    throw e;
  });
  return ready;
}

const badRequest = (error: string) =>
  new Response(JSON.stringify({ ok: false, error }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const d = new URL(req.url).searchParams.get("d");
  if (!d) return badRequest("parâmetro d ausente");
  if (d.length > MAX_PARAM) return badRequest("parâmetro d muito grande");

  let svg: string;
  try {
    svg = buildSvg(parseSpec(JSON.parse(decodeBase64Url(d))));
  } catch (e) {
    return badRequest(e instanceof SpecError ? e.message : "d não é JSON em base64url válido");
  }

  try {
    const fontBuffers = await loadAssets();
    const png = new Resvg(svg, {
      fitTo: { mode: "zoom", value: 2 },
      font: { fontBuffers, loadSystemFonts: false, defaultFontFamily: "Roboto" },
    }).render().asPng();

    return new Response(req.method === "HEAD" ? null : png, {
      headers: {
        ...corsHeaders,
        "Content-Type": "image/png",
        // A imagem depende só da URL
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    console.error("tabela-png render failed", e);
    return new Response(JSON.stringify({ ok: false, error: "render_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
