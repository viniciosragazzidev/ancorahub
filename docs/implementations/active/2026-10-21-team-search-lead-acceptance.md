# Busca da unidade e envio versus aceite no Lite

## Pedido e escopo

Vinicios priorizou esta entrega em 21/10/2026 e confirmou que a busca deve localizar
apenas corretores da própria unidade. Base: origin/feat/diretor-visual-lite,
5f54293e, em worktree isolado. A pasta principal estava em uma branch anterior
que não continha a aba Unidade do Lite. As alterações iniciais naquela pasta
foram retiradas preservando o trabalho preexistente.

## Implementação

- `my-team-page.tsx`: campo Arc SearchField com lupa na aba Unidade, filtro imediato
  por nome sem distinção de acentos ou maiúsculas, total dos resultados e vazio
  específico para busca. Adicionar, Convidar e Pedir transferência conservam ações,
  IDs e autorização existentes.
- `search-field.tsx`: parâmetro opcional clearLabel para localizar a ação de limpar.
  Reutiliza os movimentos e reduced-motion existentes, sem animação nova.
- `supervisor-broker-profile.tsx` e `/equipe/[id]/page.tsx`: gestor e supervisor
  recebem os totais existentes de ofertas efetivamente enviadas, aceitas, pendentes
  e não aceitas. Enviados e aceitos lado a lado, com taxa e histórico completo
  explicitados. Reenvios contam como novas ofertas, conforme cálculo existente;
  CANCELLED e LOST ficam excluídos. Não altera a janela 7/30 do Desempenho.

## Segurança e governança

Nenhuma query, mutação, permissão ou esquema novo. A busca filtra somente o array
já autorizado por tenant e unidade no servidor. A adição mantém auditoria e
revalidação das ações existentes. O perfil mantém leitura auditada e o kill switch
feature_team_member_profile_enabled; as superfícies continuam sob os controles
Lite de gestor/supervisor. Reverter o commit desfaz a apresentação sem tocar dados.
Sem dependência nova, migration, acesso a banco real ou deploy.

## Validação

- 25 testes focados passaram em 5 arquivos: minha equipe, perfil, ofertas,
  autorização e ações de equipe.
- ESLint direcionado passou nos quatro arquivos alterados.
- TypeScript passou no harness fast e no full.
- Harness fast: 2640 testes passaram, 1 falhou, 19 ignorados. Falha em
  meta-capture-controls.test.tsx, que não encontra o feedback de atualização global.
- Harness full: 2636 testes passaram, 5 falharam, 19 ignorados. Além da falha Meta,
  houve falhas em dashboard, planner, qualidade de leads e primeiro contato,
  arquivos não alterados nesta entrega. Não há sucesso global de testes.
- Lint global bloqueado por 952 ocorrências de encoding em três arquivos fora
  deste escopo. Lint dos quatro arquivos desta entrega passou.
- Diagnósticos: segurança sem achados; arquitetura apontou o tamanho do roadmap;
  desempenho apontou tamanho do roadmap e do perfil compartilhado já existente.
- Evidência fast: reports/agent/verification/2026-10-21T19-13-18.882Z.md.
- Evidência full: reports/agent/verification/2026-10-21T19-16-57.563Z.md.
- Build padrão bloqueado pela junction de node_modules no Turbopack; build com
  Webpack em execução conforme orientação do plano Lite. Nenhum .env foi copiado.
- Prévia visual: o navegador integrado não anexou a webview na primeira tentativa.
  QA visual autenticado permanece pendente se a prévia não estiver disponível.
