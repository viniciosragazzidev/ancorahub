# Área de negociações

## Objetivo

Dar à direção, à gestão e à supervisão uma visão atualizada dos atendimentos em negociação, com sinais da conversa, leitura da IA, fila de resposta, métricas e histórico sob o escopo já autorizado para cada papel.

## Decisões de escopo

- A página `/negociacoes` é uma leitura calculada no momento da consulta. Não cria tabelas nem altera o fluxo comercial.
- Diretor consulta o tenant e pode filtrar unidade. Gestor fica na unidade do contexto autenticado. Supervisor fica nos corretores associados à sua equipe ativa. Corretor não acessa.
- Mensagens são limitadas por tenant, leads do escopo e sete dias. O classificador considera apenas mensagens com conteúdo real e não conta mensagens de assistente ou sistema como respostas do corretor.
- O histórico completo é consultado sob demanda após revalidar tenant, unidade ou equipe. A abertura registra auditoria sem persistir conteúdo de mensagens.
- A área é controlada pelo super admin pela configuração `feature_negotiations_area_enabled`, sem migração. A navegação só mostra o item quando habilitado e autorizado pelo papel.
- Datas e agrupamentos usam `America/Sao_Paulo`; textos e números são apresentados em pt-BR.
- UX: a ação principal é abrir um atendimento; a lista e as métricas ficam nas abas; leitura completa e histórico aparecem no painel lateral Lite, em painel no desktop e sheet no celular.

## Estados e validação

- Carregamento: skeleton Lite.
- Sem escopo ou sem resultados: orientação explícita, sem dados de outro papel.
- Erro de página e erro de histórico: mensagem e opção de tentar novamente.
- Testes puros da régua e do escopo, teste de renderização com fixtures sintéticas, TypeScript, ESLint, check-lite-skin e validação visual em 1440 e 390 px.

## Arquivos e fluxos

- `src/features/negotiations/`: classificação, escopo, consultas agregadas, auditoria, ação do histórico, UI e fixtures de teste/prévia.
- `src/app/(dashboard)/negociacoes/`: rota protegida, carregamento e erro.
- `src/app/dev/negociacoes-preview/`: prévia sintética restrita a desenvolvimento dentro do AppShell real.
- Navegação Lite de diretor, gestor e supervisor; controle global do super admin na página de configurações.

## Status

Concluída em 26/10/2026 na branch `feat/negociacoes-area`. A tela `/negociacoes` foi liberada para diretor, gestor e supervisor, com permissões de rota e escopo tenant/unidade/equipe validados no servidor. O super admin controla a flag global sem migração.

## Verificação final

- `npx vitest run src/features/negotiations src/components/light/light-routes.test.ts src/components/light/light-routes-supervisor.test.ts src/components/light/light-routes-manager.test.ts src/components/light/director-routes.test.ts src/components/light/negotiations-dev-preview.test.ts src/features/custom-roles/routes.test.ts --maxWorkers=1`: 9 arquivos, 50 testes aprovados.
- `npx tsc --noEmit`: aprovado.
- ESLint em todos os arquivos de código tocados: sem erros; três avisos preexistentes em `super-admin/actions.ts` e `corretop-sidebar.tsx`.
- `check-lite-skin` nos arquivos da tela: zero desvios.
- Prévia real com AppShell e fixtures em 1440 e 390 px. Medidas: largura da página 1440/1440 e 390/390; sem rolagem horizontal. Capturas finais de 26/10 às 18:49 em `C:/Users/kyper/AppData/Local/Temp/claude/C--Users-kyper-brain/6cd0e216-1c89-45cb-8d4d-15f8cd017a2b/scratchpad/negociacoes-prints/negociacoes-1440.png` (134.635 bytes) e `negociacoes-390.png` (50.708 bytes).
- Nenhum `.env.local`, teste de banco, migração ou push.
- Diagnósticos do harness: dois achados arquiteturais, um de segurança e três de desempenho em arquivos existentes do super admin e da moldura, fora da feature; ver `reports/agent/verification/`. O componente cliente foi reduzido para 14,5 KB e não gera achado de desempenho.
- O navegador de prévia injetou `style="caret-color: transparent"` no campo de busca antes da hidratação. A marcação SSR não contém esse estilo; é um aviso de extensão/ambiente local, sem erro de aplicação.
