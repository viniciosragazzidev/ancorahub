# Onda 5: distribuição e plantões

Base: `origin/feat/diretor-visual-lite` em `d2d80a01`.
Worktree: `C:/Users/kyper/Desktop/Kyper/Projects/ancorahub-diretor-onda5`.
Branch: `feat/diretor-lite-onda5`.

## Entregas

- [x] `/distribuicao`, aba Resumo: diretor usa o gate server-side da empresa e a
  consulta existente de resumo; a versão antiga continua no caminho legado quando
  a chave está desligada.
- [x] `/distribuicao`, aba Entradas e regras: mesmos painéis e ações existentes,
  com uma área ativa por vez e navegação URL acessível.
- [x] Aba Operação: KPIs, filtros, seleção, envio e atribuição reaproveitam os
  dados e ações existentes; inbox usa tabela no desktop e lista Lite no celular.
- [x] Aba Filas: filas, revisão de leads frios, SLA e política mantêm os mesmos
  controles. Configurações são componentes irmãos e recebem apenas dados simples.
- [x] Aba Plantões: reaproveita o workspace e as ações atuais, com calendário
  responsivo em lista no celular, datas no fuso de São Paulo e alvos de 44px.
- [x] Editor da ocorrência.
- [x] Aba Saúde.
- [x] `/distribuicao/dashboard`.
- [x] Rotas de plantões no escopo 2.5. A rota de corretor permanece com os checks de escopo já existentes; `/plantoes` e `/plantoes/agora` seguem exclusivos do corretor.

O alias `/distribuicao` continua herdando o layout de autorização que bloqueia
gestores. Os novos links e conteúdo ficam no lado do servidor; a navegação recebe
somente valores serializáveis e não recebe JSX nem callbacks do servidor.

## Decisão de acesso (25/10)

As telas internas Lite recebem papel e permissões do contexto autenticado. Restrições por papel repetem os checks da tela atual; o gate isDirectorLitePageOnServer e useDirectorLitePage continua temporário até a troca central da chave.

## Validação desta rodada

- Vitest focado: 18 arquivos e 86 testes aprovados; a verificação isolada do DutyNowView também passou, com 7 testes.
- npx tsc --noEmit -p .: código 0, sem erros.
- ESLint: zero erros; permanecem 6 avisos preexistentes na inbox e no workspace de plantões. Os módulos CSS não fazem parte da configuração do ESLint.
- node scripts/check-lite-skin.mjs: relatório executado. A comparação dos arquivos alterados com d2d80a01 não encontrou desvios novos de estilo.
- Prévia real /dev/diretor-shell-real: 24 capturas em 1440 e 390, para diretor e super-admin, cobrindo operação, filas, calendário, ocorrência, saúde e dashboard. Erros de console: 0; largura do documento igual ao viewport; cabeçalho e conteúdo alinhados (258/1425 no desktop, 0/375 no celular). Arquivos e medições em C:/Users/kyper/AppData/Local/Temp/claude/C--Users-kyper-brain/24b9384d-0a21-4b55-a4b1-9fff1a71d8e4/scratchpad/final-prints/.
- Refinamento visual: controles da inbox cabem na tabela desktop; nomes longos truncam com reticências; cards de plantão empilham nome e horário no celular. O gate desligado mantém o HTML legado do DutyNowView.

## Correções da revisão Vigia (25/10)

- Removidas as sombras dos cards Lite dos painéis de distribuição, saúde e escala, com borda `1px solid var(--border)` e raio `--radius-surface`; corrigido o caminho do gate para `/leads/distribuicao`.
- Restaurado o slot de children legado de `BrokerOccurrenceCard`; snapshot confirma HTML idêntico ao código de origem `d2d80a01` quando o gate está desligado, mesmo com o resumo novo presente.
- Calendário de escala aplica `inert` e `aria-hidden` à versão desktop ou móvel oculta; teste cobre os dois viewports. DutyNowView valida a classe CSS renderizada.
- Commits: `457660ab`, `be5396d9`. Vitest: 30 arquivos, 107 testes; type-check e ESLint passaram. As 24 capturas em `/dev/diretor-shell-real` foram regeneradas sem erros de browser ou overflow horizontal.
- O `DomainDashboard` em `/distribuicao/dashboard` ficou intocado pela decisão pendente do Vinicios.
