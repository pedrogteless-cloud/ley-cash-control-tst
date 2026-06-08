## Problema

Hoje as ações de NF (Editar, Confirmar envio, Excluir) só aparecem dentro do painel `/`, que é a tela de *consulta* (`readOnly`). Por isso, mesmo logado como admin, os botões não aparecem.

A correção é mover a operação para a tela **/lancamentos**, mantendo o Painel 100% read-only.

## O que muda

### 1. Painel (`/`) continua só leitura
Nenhuma alteração funcional. Sem botões de ação.

### 2. Tela de Lançamentos vira a central de ações

**Aba "Notas Fiscais"** (admin e `lancador_nf`):
- Bloco "Hoje" (como já está).
- Bloco "Todas as NFs" — lista completa com filtros (Todas / Enviar Cheque / Aguardando Carga / Enviados) + busca por fornecedor/NF.
- Cada linha mostra:
  - **Editar** (abre `QuickAddDrawer` em edit-nf — já existe).
  - **Confirmar envio** — **só aparece se a NF estiver marcada como "CHEGOU" e ainda não enviada** (regra de `isAEnviar`). Para "Aguardando Carga" o botão não aparece. Abre modal de confirmação e chama `confirmarEnvio(id)` → baixa automática no caixa.
  - **Excluir** — **sempre pede confirmação** num `AlertDialog` com aviso claro:
    > "Tem certeza que quer excluir esta NF? Se o cheque já foi enviado ao fornecedor, o correto é usar **Confirmar envio** em vez de excluir, para registrar a baixa no caixa. Excluir apaga o registro permanentemente."
    
    Botões: **Cancelar** (padrão) e **Excluir mesmo assim** (vermelho).

**Aba "Caixa"** (admin e `lancador_caixa`):
- Bloco "Hoje" + bloco "Histórico completo" com Editar / Excluir por linha.
- **Excluir** também passa por `AlertDialog` de confirmação ("Tem certeza? Esta ação não pode ser desfeita.").

### 3. Permissões
"Confirmar envio" liberado para **admin, lançador de NF e lançador de caixa**. A RPC `confirmar_envio_nf` hoje só aceita admin/lancador_nf — ajustar via migration para também aceitar `lancador_caixa`.

### 4. Acesso
O botão "Lançar" no header do painel já é o atalho.

## Fora do escopo
- Schema de tabelas.
- Gráficos/KPIs/layout do painel.
- Mobile bar e drawer.

## Detalhes técnicos

Arquivos tocados:
- `src/routes/_authenticated/lancamentos.tsx` — adicionar seção "Todas as NFs" (filtros + busca + ações), seção "Histórico" no caixa, e dois `AlertDialog`s: um para confirmar envio (já modelado na CarteiraTab) e outro para confirmar exclusão (NF com mensagem específica sobre cheque enviado; caixa com mensagem padrão). Substituir os `onDelete` diretos por handlers que abrem o dialog.
- Migration SQL: `CREATE OR REPLACE FUNCTION public.confirmar_envio_nf(...)` aceitando também `lancador_caixa`.

Nenhum arquivo do painel (`CarteiraTab.tsx`, `CaixaTab.tsx`, `NfCard.tsx`, `CaixaCard.tsx`, `index.tsx`) é alterado.
