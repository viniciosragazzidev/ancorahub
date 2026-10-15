# Ligação G0 em G1 e G3

Data: 2026-10-15
Branch: `feat/gestao-ligar-metricas`
Branch integrada: `feat/diretor-visual-lite` (`f4850eed`, G2)

## Entrega

- `/gestao` do gestor Lite monta o resumo da unidade com uma chamada a `getTeamMetrics`. SLA é mostrado como percentual; leads da unidade usam `commercial.leads_received`; conversão, aceite e demais métricas permanecem no catálogo G0.
- Scores e pontos fortes/de atenção usam `teamHealthInputFor` tanto para a janela atual como para a anterior. O grupo sem supervisor aparece como “Sem equipe”. O ramo G2 do supervisor permanece renderizando a própria equipe.
- Os seis números do topo incluem tendências para as quatro métricas de janela. Corretores ativos e equipes exibem `s/h`, pois o esquema não guarda snapshots históricos de roster.
- O rail do Lite mostra “Gestão” para o gestor somente quando a flag está ativa; a tela já era acessível pelo menu Mais.
- O perfil G3 consome a janela selecionada pelo parâmetro `?janela=7|30` e projeta os dados G0 em oito indicadores com comparação real. O pulso alimenta somente o gráfico de aceites semanais. O perfil de supervisor desativa a consulta da média da unidade, que não usa, para manter uma única agregação SQL de métricas.
- `/dev/g1-gestao-preview` e `/dev/g3-perfil-preview` refletem as novas métricas e janelas.

## Verificação

- Vitest direcionado após o ajuste dos mocks de navegação do perfil: 7 arquivos, 44 testes passaram (G1 com e sem dados; G3 com e sem dados, janelas e seletor; montagem do perfil e compatibilidade das rotas tipadas).
- ESLint direcionado a todos os arquivos TypeScript/TSX alterados, incluindo os mocks: passou sem erros.
- `npx tsc --noEmit -p .`: passou com os validadores de rota do Next incluídos. Para isso, a assinatura da página de qualificação foi alinhada ao contrato de `PageProps`, e `extractRealToken` foi movido para fora do arquivo de rota.
- `npm run agent:verify -- --level full`: documentação, arquivos alterados, arquitetura, segurança, performance e type-check passaram. O lint global aponta 995 casos de mojibake em três arquivos (`docs/business-rules.md`, `src/features/leads/management-actions.test.ts` e `src/features/reports/metrics/lead-quality-period.test.ts`). A suíte completa também falhou em testes de outros módulos, com erros de conexão ao banco local bloqueado e timeouts; o perfil G3 teve cinco falhas por falta de mocks de navegação, corrigidas e cobertas pelo conjunto direcionado acima.
- `npm run build`: o Turbopack falhou porque o junction de `node_modules` aponta fora da raiz. `npm run build -- --webpack` permaneceu sem resultado por vários minutos e foi interrompido; as prévias foram servidas com `npx next dev --webpack -p 3135`.
- Capturas locais em `tmp/wire/`: `gestao-desktop-1440.png`, `gestao-mobile-390.png`, `g3-perfil-7d-1440.png` e `g3-perfil-30d-1440.png`.

## Limites

Nenhum banco real foi acessado e nenhuma migration foi criada. O servidor de prévia usou URLs locais inválidas para qualquer acesso ao banco; as rotas capturadas são fixtures. O SQL manual de G0 permanece para conferência futura no Supabase.

A seção antiga “Atenção agora”, que dependia do pulso, foi removida para manter o pulso apenas no gráfico semanal; os alertas canônicos de equipe continuam disponíveis no G2.
