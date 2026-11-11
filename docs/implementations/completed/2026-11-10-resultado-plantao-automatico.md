# Resultado do plantão automático

## Objetivo e escopo

Enviar diariamente às 19h de São Paulo um resumo de operação para o grupo WAHA
configurado por tenant. A prévia e o disparo manual ficam em uma página de acesso
exclusivo do diretor. Nenhum gestor ou corretor acessa o controle.

## Regras e decisões

- A janela usa o dia civil de `America/Sao_Paulo`, de 00:00 até o instante da
  consulta. As filas dos leads vêm do primeiro evento `queued`, não da fila atual.
- Os nomes de filas e plantões ficam no objeto de configuração por tenant, com
  defaults centralizados. O total externo é a soma de WhatsApp Externo e RD.
- Tipos form e WhatsApp usam as chaves documentadas de `source_metadata`.
  Distribuição considera leads distintos com oferta aceita e `offered_at` na
  janela; para cada grupo e período, a média é a soma de leads distintos de
  todos os plantões do grupo dividida pela soma de corretores distintos.
- Indicações são leads distintos com oferta aceita, separadas pelo corte de
  13:30 em São Paulo; saem da contagem as ofertas de Plantão Plus e as ofertas
  de leads cuja fila original seja `Alessandra Leads`.
- As médias de quantidade são exibidas com `Math.ceil`, sem casa decimal ou
  vírgula; um resultado zero continua como `0`.
- O grupo PME exige nome iniciado por `PME` e tem prioridade sobre os demais;
  Online exige nome iniciado por `Premium`, sem busca parcial.
- O grupo padrão e a busca usam `Fechamento Plantão Geral`, comparando nome
  normalizado (acentos e caixa ignorados), sem busca parcial. O `groupId` fica
  em cache no setting, mas o nome é confirmado na lista atual antes do envio.
- A mensagem segue o formato do relatório das 18h: título em negrito com emoji,
  separador ` · `, contagens sem zero à esquerda e médias arredondadas para cima
  para inteiros, sem linha de telefone. Externo é WhatsApp Externo + RD; a data usa
  `shortDate` do relatório das 18h.
- O cron usa a reserva `plantao-report:<tenant>:<dia>` e envia no máximo uma
  vez por tenant/dia. Cada envio manual usa `plantao-report-manual:<tenant>:<dia>:<HHMMSS>`;
  ele não cria nem consome a reserva diária do cron.
- A reserva de envio fica em `system_settings` com prefixo `lease:` para ser
  atômica e ficar fora da leitura de configurações. Em falha após a reserva, ela
  é liberada por chave e valor exatos para permitir retry;
  estado `sending` após queda do processo bloqueia duplicação até intervenção.
- A flag global é o interruptor do Super-admin. O setting do tenant ausente
  permanece desligado.

## UX

Papel: diretor do tenant. Rota `/settings/resultado-plantao`. Ação principal:
conferir a prévia e enviar agora. Controles secundários: ativar/desativar o envio
automático. Estados: feature global desligada, configuração do tenant ausente ou
desligada, grupo/número inválido, envio em andamento, enviado hoje, falha e
prévia atualizada. Reutilizar Card, Button, Switch e tipografia existentes. Sem
novo token, primitive ou animação; não altera uma etapa global do redesign.

## Implementação e validação

Implementado: core puro e testes, consultas escopadas por tenant, resolução do
grupo WAHA pelo nome exato, envio idempotente, job às 22:00 UTC, tela exclusiva
do Diretor, scripts explícitos de configuração e prévia somente leitura. Não foi
criada migration.

Validação: a consulta somente leitura do dia 09/11 bateu todos os números de
referência: Externo 92/27 = 119; Interno 118/17 = 135; indicações 82/48;
médias brutas PME 9,5, Online 4,2/1,0 e Presencial 6,5/6,7, exibidas como
10/5/1/7/7 após arredondamento para cima. A referência antiga de 86 indicações
pela manhã era sem os filtros novos; após excluir Plantão Plus e a fila original
Alessandra Leads, a contagem verificada é 82, com tarde em 48. O script de preview
somente leitura imprime também o resultado do dia corrente até o instante da execução.
Vitest focado: 23 testes em 3 arquivos aprovados. `tsc --noEmit`, ESLint dos arquivos tocados, harness
documental e diagnósticos de arquitetura, segurança e desempenho passaram.
O script de configuração e o envio real não foram executados. O harness integral
e o build não foram rodados.

## Operação e rollback

Para ativar, o operador deve ligar a flag global, rodar
`npx tsx scripts/create-plantao-report-setting.ts --tenant-id <tenant> --actor-user-id <diretor> --apply`
e cadastrar no Coolify o endpoint `/api/internal/jobs/plantao-report` às 22:00
UTC com `CRON_SECRET`. O setting fica desligado até esse passo. Para rollback,
desligar a flag global ou o setting do tenant e pausar a tarefa no Coolify. Não
exige migration.
