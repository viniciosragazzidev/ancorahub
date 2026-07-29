# Navegação móvel e atualização viva de leads — 29/07/2026

## Objetivo

Garantir que o corretor consiga usar a fila no celular sem conteúdo encoberto pela
navegação fixa e que uma atribuição recebida seja refletida na rota `/leads` sem F5,
inclusive quando a notificação chega enquanto ele está em outra tela.

## Entrega

- A navegação inferior usa `primary` e `primary-foreground`, portanto acompanha a
  cor configurada para cada empresa. O estado ativo é explícito e a grade de quatro
  ações mantém tamanho de toque consistente.
- O shell móvel reserva espaço para a navegação e aplica `scrollPaddingBottom`; o
  último card de qualquer rota continua rolável e visível. Card de novo lead e CTA
  de instalação da PWA ficam acima dessa área segura.
- `RealtimeSyncProvider` invalida o cache local, propaga para outras abas com
  `BroadcastChannel` e executa `router.refresh()` coalescido para atualizar os Server
  Components. Atualização é adiada enquanto há formulário ou diálogo com foco para
  não interromper digitação.
- Um evento de atribuição grava uma revisão de curta duração no navegador. Ao entrar
  em `/leads`, `LeadsLiveSync` recarrega a fila se a atribuição ocorreu enquanto o
  corretor estava em outra rota.
- A reatribuição gerencial persiste `distributionStatus = assigned` e seus metadados
  de distribuição. O alerta de retorno à fila é restrito a Diretor/Gestor, somente
  quando o lead ainda não tem corretor responsável.

## Validações

- `npm run type-check` — aprovado.
- `npm test -- --run src/components/notifications/incoming-lead-queue.test.ts` — 4
  testes aprovados.
- `npm run lint` — aprovado com 187 avisos preexistentes, sem erro.
- `npm run build` — aprovado; extensão empacotada e 73 rotas geradas.
- `npm run agent:verify -- --level fast` e `--level full` excederam o limite de 124 s
  do executor durante a verificação; a etapa de documentação e o type-check internos
  foram concluídos antes do timeout. A evidência parcial está em
  `reports/agent/verification/2026-07-29T15-16-31.074Z.md`.

## Próxima fase: stream operacional confiável

1. **Evento durável e autorizado:** gravar, na mesma transação da atribuição, um
   envelope `operational_event` com versão, tipo, tenant, escopo de unidade/usuário e
   referência do recurso — sem PII. A outbox publica somente após o commit.
2. **Canal privado por escopo:** expor eventos pelo Supabase Realtime (ou SSE) com RLS
   por tenant, unidade e carteira. O navegador não assina a tabela ampla de leads nem
   decide seu próprio escopo.
3. **Cursor e reconciliação:** cada cliente mantém o último cursor; ao reconectar,
   chama um endpoint autenticado para buscar eventos perdidos e aplica somente eventos
   mais novos que a versão local.
4. **Cache de entidades:** listas e detalhes passam a usar chaves TanStack Query por
   tenant, usuário e filtro. O evento atualiza/invalida a entidade afetada; refresh de
   rota permanece como fallback para superfícies ainda server-first.
5. **Observabilidade e controle:** medir p50/p95 de commit até tela, lag de stream,
   reconexões e eventos descartados. O Super-admin controla a capacidade e pode
   desligar o consumidor, preservando a reconciliação por consulta.
6. **Critérios de aceite:** E2E com dois usuários sintéticos cobre atribuição aberta
   em outra rota, entrada posterior em `/leads`, duas abas, rede offline/reconexão e
   atualização sem perder um formulário em edição. Meta: atualização p95 abaixo de
   dois segundos; reconciliação após reconexão abaixo de cinco segundos.

## Risco e rollback

O refresh atual é um fallback seguro e não altera regra de distribuição, permissão ou
dados. Se houver falha de Realtime, a página ainda obtém os dados autoritativos no
servidor ao navegar/recarregar. A etapa de stream durável ficará atrás de flag antes
de substituir esse fallback.
