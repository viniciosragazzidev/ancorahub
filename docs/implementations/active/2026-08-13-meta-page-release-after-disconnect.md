# Liberação segura de Página Meta após desconexão

## Objetivo

Permitir que uma Página Meta desconectada de uma corretora seja conectada à corretora correta, preservando o histórico e impedindo dois tenants ativos para a mesma Página.

## Decisão aplicada

Uma Página possui no máximo uma fonte de Lead Ads **ativa**. Vínculos inativos são históricos auditáveis e não bloqueiam uma nova conexão. A desconexão de Marketing revoga a credencial de captura, inativa fontes e ativos daquele tenant e registra a liberação.

## Escopo

- migração de unicidade global para unicidade parcial por status ativo;
- desconexão canônica libera fontes e credenciais de Lead Ads do tenant;
- reconexão volta a marcar Páginas e contas selecionadas como ativas;
- teste de proteção contra compartilhamento ativo e de transferência após desconexão.
- regra explícita por campanha e por anúncio: receber em uma fila ativa ou não registrar o lead no CRM; a regra do anúncio prevalece sobre a da campanha.

## Fluxo de captação e roteamento

Após a conexão, o Diretor vê os ativos que foram autorizados para a própria corretora: perfil do Business, Páginas, contas de anúncios, pixels, fontes, campanhas, anúncios e formulários. A sincronização grava campanhas, conjuntos, anúncios, pixels e formulários no tenant atual. Em **Distribuição de Leads → Central de filas**, o Diretor ou Gestor do escopo pode escolher uma campanha ou um anúncio e uma fila ativa; o webhook preserva a atribuição e entrega o lead à fila escolhida. A fila — e não a campanha — decide capacidade, escala e corretor. A regra do anúncio prevalece sobre a regra da campanha. O Diretor também pode marcar cada campanha ou anúncio como **Não registrar**, descartando somente os próximos leads correspondentes com auditoria, sem afetar os demais ativos.

## Risco e rollback

Reverter a migração recria a unicidade global e volta a bloquear vínculos históricos. O rollback de código preserva registros inativos, mas não deve ser usado enquanto houver migração de Página entre corretoras em andamento.

## Validações

- `npm run db:check` e `npm run db:migrate` concluídos; o banco já registrava as migrações desta entrega;
- 14 testes focados dos contratos de Lead Ads e da visualização dos ativos Meta aprovados;
- `npm run agent:verify -- --level fast`: 90 arquivos e 366 testes aprovados, com type-check e documentação válidos (evidência em `reports/agent/verification/2026-08-13T17-49-59.091Z.md`);
- `npm run build`: build de produção Next.js concluído com sucesso.
