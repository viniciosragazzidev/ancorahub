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
