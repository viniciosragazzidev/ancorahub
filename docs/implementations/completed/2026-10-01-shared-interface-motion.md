# Movimento dos componentes reutilizáveis

Status: concluído e validado em 02/10/2026. Pedido: aplicar os conceitos de animação enviados pelo usuário a toda a biblioteca reutilizável.

## Contrato

- Público: corretores, operação e gestão; interação frequente, desktop e mobile. Tom sóbrio, feedback rápido e acionável (UX-H1 / UX-M1.10).
- Botões e campos: confirmação tátil curta, foco visível e estados estáticos legíveis. Menus/dialogs/sheets: abertura contextual e saída mais curta, usando o ciclo de presença/foco da Base UI. Seletores: indicador estável; carregamento: pulso discreto sem bloquear ações.
- Sem entrada/reordenação animada de tabelas, filas ou métricas (DEC-034), sem bounce, confete, parallax ou movimento decorativo contínuo. Componentes puramente estruturais permanecem estáticos.
- Reutilizar tokens `transitions-dev`, componentes-base e pacotes existentes. Sem alterar regras de negócio, escopos, cores, geometria ou identidade do Lite.
- Corrigir a integração do controle existente `feature_interface_motion_enabled`: leitura pública somente do booleano, independente do carregamento do layout; alterações continuam na ação exclusiva e auditada do Super-admin. Movimento reduzido sempre prevalece.

## Plano

1. Consolidar CSS de motion, removendo definições conflitantes; cobrir controles, overlays, indicadores e skeletons das famílias UI/DS/Unlumen.
2. Fazer os componentes React Motion e ícones respeitarem o mesmo controle e curvas sem overshoot; preservar teclado, foco e valores finais.
3. Validar a governança e os estados importantes, revisar no catálogo de componentes, executar harness e build; atualizar controle UX, changelog e roadmap N38.

## Entrega

- `src/styles/interface-motion.css` substitui as definições conflitantes de `globals.css`: feedback de ação, foco, controle binário, disclosure, carregamento e estado. Sem animação automática de badges/linhas, sem `will-change` permanente ou shimmer de background.
- UI/DS/Unlumen compartilham a escala temporal e estados finais; sheets diferenciam lados, menus preservam origem/presença, tab indicators usam transformação. Conteúdo de opções aparece junto, sem sequência que atrase a interação.
- React Motion, 35 ícones imperativos, uploads, botões com estado, seleção, troca de tema e dock obedecem ao mesmo controle. O dock mantém dimensões fixas e limita a ampliação a 1,12 para não sobrepor vizinhos.
- Totais, gráficos e listas operacionais não interpolam valores nem animam entrada/reordenação. Estados de sucesso, falha, carregamento e seleção continuam distinguíveis sem movimento.
- `InterfaceMotionProvider` consulta somente `/api/public/interface-motion`, sem cookies, com timeout de 5s, atualização no foco/retorno à aba e no máximo a cada minuto enquanto visível. Falhas desativam movimento, sem bloquear a aplicação. O HTML começa estático; CSS em portais e JS recebem a mesma preferência. Mudança do sistema operacional é reativa.
- A configuração existente continua editável apenas pelo Super-admin, com sua auditoria prévia. A leitura pública não aceita chave/tenant do cliente e não expõe dados ou segredos. Não há dependência ou migration nova.
- Incluído ajuste pendente no teste SQL da central de qualidade: compila a projeção real passada pelo serviço, preservando a regressão dos aliases sem acessos de tipos inválidos ao mock.

## Verificação

- `transitions-dev` e `better-ui` orientaram durações, saídas curtas, direção, interrupção, foco e alternativa estática. O anexo foi adaptado aos contratos do CRM; não criou regra de negócio.
- Primeiro ciclo dirigido: 24 testes passaram. Testes adicionais de ícones e uploads: 3 passaram, usando Motion real no teste de upload para conferir o estado final.
- QA reproduzível: `node scripts/ui/verify-shared-motion.mjs`, com fixture sintética em `scripts/ui/fixtures/shared-motion-preview.tsx`. Reexecutado após mover para o caminho definitivo: passou. Evidências em `reports/agent/verification/shared-motion-2026-10-01/` (`results.json`, desktop, mobile/reduced e dark). Cobertura: 1360px/390px, valor de select/checkbox/switch, Escape e retorno de foco, direção dos quatro sheets, desativação global/OS, portais, overflow horizontal e erros no navegador. Não usa dados do CRM nem tipografia carregada por Next/font.
- Primeiro harness full: `reports/agent/verification/2026-10-01T21-32-32.072Z.md`. TypeScript passou; 1.343 testes passaram, 7 excederam 5s sob alta concorrência e 1 revelou que o mock global de Motion não implementa LayoutGroup. O teste foi corrigido para usar a implementação real e passou. O único erro de lint vinha do shim temporário de Windows e foi corrigido, não do produto.
- Reexecução full com `VITEST_MAX_WORKERS=4`, sem elevar timeouts: todos os gates passaram. Lint global passou (0 erros; 1.100 avisos), TypeScript passou, 1.355 testes passaram e 17 foram ignorados pela configuração das suítes. Segurança sem achados: `reports/agent/verification/2026-10-02T11-23-57.733Z.md`. `npm run build` passou incluindo prebuild e empacotamento da extensão, compilação, tipos e prerender. Evidência final: `reports/agent/verification/2026-10-02T11-40-35.017Z.md`; log completo: `reports/agent/verification/shared-motion-full-retry.log`.
- QA adicional com os componentes reais no navegador: menus/popovers fecham por Escape e devolvem foco; o botão com estado mantém pendência e confirmação desabilitadas. Passou no script definitivo, sem ampliar dependências.
- Controle UX, changelog, nota de implementação da DEC-034 e as duas entradas N38 do roadmap atualizados. `git diff --check` passou; o shim de Windows e o tsconfig temporário foram removidos. O script de QA sintético foi preservado em `scripts/ui/` para reprodução.

## Limites e rollback

- UX-M1.10 autenticado em todas as rotas/papéis continua pendente; QA da biblioteca não representa homologação do aplicativo completo.
- Diagnósticos de tamanho dos uploads são preexistentes; o código foi reduzido e a extração estrutural não faz parte desta mudança. O harness também inclui arquivos de plantão/schema alterados por trabalho paralelo, preservados sem intervenção nesta tarefa.
- Rollback de movimento: desligar `feature_interface_motion_enabled` no Super-admin. O efeito é refletido no foco/retorno ou na próxima atualização em até um minuto; entradas, seleção, foco e ações continuam disponíveis.
