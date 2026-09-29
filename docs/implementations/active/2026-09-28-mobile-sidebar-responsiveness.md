# Responsividade do menu lateral no celular

## Problema e escopo

No Sheet do CRM, o cabeçalho mobile alinhava marca, título, usuário e controles de largura total na mesma linha. O rodapé colocava Agente IA e perfil lado a lado. Em viewports estreitos, esses blocos comprimiam rótulos e alvos de toque. A navegação deve continuar sendo a mesma lista autorizada da rail desktop; o Corretor Lite mantém o menu próprio.

## Comportamento implementado

- A identidade ocupa uma linha: logo, nome do CRM e usuário, com espaço reservado ao botão de fechar do Sheet. O indicador de plantão e o seletor do Super Admin ficam abaixo, quando aplicáveis.
- O seletor de visão do Super Admin usa seu modo compacto dentro do cabeçalho mobile; no desktop mantém a posição flutuante anterior.
- A lista de destinos permanece na área rolável do Sheet e não deve criar rolagem horizontal. O rodapé mantém Agente IA e perfil empilhados, em largura inteira, com alvo mínimo de toque do design system e padding da safe area.
- Logo, destinos, links do perfil e Agente IA fecham o Sheet ao iniciar a navegação/ação. Backdrop, Escape e botão de fechar permanecem sob o componente compartilhado `Sheet`.

Não há alteração em permissões, rotas, tenant, dados ou regras de negócio. Nenhum token, dependência ou primitiva foi criado; o modo compacto já estava previsto na API de `SuperAdminRoleSwitcher`. As transições existentes usam os tokens do projeto e preservam `prefers-reduced-motion`.

## Verificação e limite

- `eslint` dirigido: zero erros; aviso preexistente sobre `<img>` no logo.
- `tsc --noEmit`: aprovado após remover dois arquivos temporários inconsistentes em `.next/dev/types` e regenerar os tipos de rota. O código da aplicação não apresentou erro de tipo.
- `npm run build`: bloqueado antes da compilação Next pelo prebuild da extensão (`esbuild` recebeu acesso negado ao ler `apps/browser-extension/src/background/service-worker.ts`).
- Build Next direto: aprovado, incluindo compilação de produção e TypeScript.
- Harness `fast`: documentação e tipos aprovados; 1204 testes passaram, 7 falharam e 8 foram ignorados. As falhas ocorreram em dashboard Lite, dashboard operacional, Meta, WhatsApp, planejador de plantões e um mock de Drizzle na suíte de Leads, fora dos arquivos editados. Evidência: `reports/agent/verification/2026-09-28T18-15-00.661Z.md`.
- Harness `full`: documentação, arquivos alterados, arquitetura, segurança, desempenho, lint e tipos aprovados. A suíte terminou com 1212 testes aprovados, 1 falha e 8 ignorados. A única falha é a asserção de ordem de código do painel Lite em `broker-lite-experience.test.tsx`, fora dos arquivos editados; por isso o harness não avançou ao build, já executado diretamente com sucesso. Evidência: `reports/agent/verification/2026-09-28T18-22-27.652Z.md`.
- QA visual autenticado em 320, 360, 375, 390, 412 e 430px: pendente. O navegador integrado não apresentou aba aberta nesta sessão; a captura enviada pelo usuário foi usada para conferir o problema original.

O item N99 permanece `partial` até a matriz UX-M1.10. Rollback: reverter apenas a composição mobile da sidebar e o uso do modo compacto no seletor, preservando os destinos autorizados.
