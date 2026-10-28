# Aba Distribuidos na central de conversas

Status: concluido em 28/10/2026.

## Escopo

Na rota `/conversas`, Diretor e Gestor com unidade podem abrir `?tab=distribuidos` para consultar somente conversas de leads com corretor responsavel. A aba reutiliza a lista, filtros, ordenacao e escopo existentes.

## O que mudou

- O servidor aplica `corretor_id IS NOT NULL` junto dos filtros de tenant, unidade/papel, exclusao e arquivamento ja existentes. A resolucao da aba impede que papeis sem acesso exibam Distribuidos.
- A leitura de mensagens da aba fica restrita aos leads carregados; contatos sinteticos sem lead sao omitidos.
- A lista e o cabecalho da conversa mostram o nome do corretor como texto secundario. Quando nao ha nome, nenhum rotulo de atribuicao e mostrado.
- A contagem usa as conversas efetivamente retornadas pelo servidor, depois da deduplicacao e dos mesmos filtros de lista.

## Arquivos e fluxos

- `src/app/(dashboard)/conversas/page.tsx`
- `src/app/(dashboard)/conversas/conversations-frame.tsx`
- `src/app/(dashboard)/conversas/conversations-workspace.tsx`
- `src/app/(dashboard)/conversas/_components/conversas-header-nav.tsx`
- `src/features/conversations/conversation-tab.ts` e teste puro associado
- `/dev/diretor-shell-real?view=conversas&tab=distribuidos`, fixtures sinteticas

## Validacao

- Vitest focado: 2 arquivos, 11 testes passaram; snapshot da navegacao atualizado para a nova aba.
- Type-check: `npx tsc --noEmit` passou.
- ESLint dos arquivos tocados: passou sem erros; 13 avisos preexistentes em `conversations-workspace.tsx`.
- Capturas na rota real `/dev/diretor-shell-real?view=conversas&tab=distribuidos`: 1440x900 (230941 bytes), 390x844 (77739 bytes) e conversa aberta em 390x844 (51733 bytes), todas em `C:/Users/kyper/AppData/Local/Temp/claude/C--Users-kyper-brain/24b9384d-0a21-4b55-a4b1-9fff1a71d8e4/scratchpad/conversas-prints/`.
- `check-lite-skin` concluiu em modo relatorio; o relatorio inclui desvios anteriores do repositorio e nao foi tratado como verificacao de zero desvios.
- Nenhum teste `*.db.test.ts`, migration ou acesso ao banco foi executado.

## Rollback

Reverter o commit local desta entrega. Nenhum schema, envio de mensagem, PDF ou regra de permissao existente foi alterado.
