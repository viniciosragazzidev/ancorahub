# Assets 3D contextuais no Diretor e Corretor

Pedido de Vinicios em 28/10/2026: aplicar os ícones gerados em locais estratégicos da UI.
Escopo aprovado pelo pedido: aplicação visual nos dois modos existentes, sem mudança de fluxo.

## Domínio e decisão de composição

- Diretor no visual Lite: reconhecer seções de filas, plantões e conversas; números e ações continuam prioritários.
- Corretor Lite: início e estado sem pendência, fila vazia, clientes vazios e preparação da cotação.
- Documentos: reutilizar a aplicação de ilustração já existente no estado vazio.
- Ilustração é apoio decorativo, não status, certificação, identidade de pessoa ou novo comando.
- Reutilizar PeopleEmpty, EmptyState e as composições atuais. Acrescentar somente slot opcional de ilustração em PeopleEmpty, onde ele falta. Tamanhos compartilhados usam a escala existente (48, 64, 80 px); sem novo token ou movimento.
- Arquivos derivados WebP pequenos, preservando alpha e proporção. Originais e prompts permanecem no estúdio editorial.
- Controle global no Super-admin, ligado por padrão para a aplicação solicitada, somente exposto ao corretor Lite e diretor Lite autenticados. Alteração validada e auditada; desligar restaura ícone anterior ou ausência de ilustração.

## Plano

1. Otimizar assets selecionados e registrar origem e local de aplicação.
2. Componente compartilhado com fallback, configuração administrativa e escopo visual no layout existente, usando cache de settings já disponível.
3. Aplicar nas seções e vazios relevantes; preservar busca, ações, dados e estados.
4. Verificar acessibilidade, viewport estreito, aplicação visual, testes de configuração e build. Registrar evidências reais e limitações do harness.

## Pré-condições documentais

Contrato e controle de UX, regras do projeto e documentação embarcada de Image/revalidatePath consultados. O arquivo histórico docs/ux-audit-2026-07-13.md citado nas regras não existe nesta revisão; o contrato vigente e as superfícies reais foram usados. Não há nova regra de domínio nem decisão pendente sendo implementada. O grill-with-docs e o glossário foram consultados; o pedido resolve a decisão de usar esses assets e as escolhas restantes são reversíveis de composição.

## Estado

Implementado e validado, pronto para envio à branch solicitada. Publicação depende do deploy. Rollback: desligar o controle administrativo ou reverter o commit isolado. Sem migração ou dependência nova.

## Aplicações implementadas

Sete WebPs 256 × 256 somam 86.908 bytes. Saudação e plantão no Início do corretor;
checklist em Agora sem pendência; fila vazia com calendário em Retornos, conversa em
Atendendo e checklist nas demais abas; clientes vazios com conexões; comparação na
preparação do resumo de cotação; documentos na superfície vazia já ilustrada. Diretor:
conexões em Leads por fila, calendário nos plantões e conversa no WhatsApp da equipe.
A busca sem resultado mantém seu feedback textual sem ilustração celebratória.

Componente ContextualIllustration, provider visual, slot opcional em PeopleEmpty e
controle em Super-admin > Configurações > Plataforma. Dados e autorização permanecem
nos resolvedores existentes. A configuração usa o cache compartilhado de settings;
sem consulta por imagem ou por linha. Alteração exige administrador da plataforma,
aceita somente true/false, registra estado anterior e novo e revalida o layout.

## Verificação

- 38 testes passaram na primeira rodada (6 arquivos), incluindo autorização do controle, entrada inválida, desligamento e fallback por falha de imagem.
- 53 testes passaram na segunda rodada (4 arquivos), cobrindo painel do diretor, estados, cotação e início do corretor; há repetição do teste de início entre as rodadas.
- TypeScript passou na execução dedicada e no harness fast/full.
- ESLint direcionado: zero erros e três avisos preexistentes em Documentos.
- Prévia dos componentes reais com fixtures sintéticas: Diretor, início do Corretor e fila vazia em 1440 × 1050 e 390 × 844, sem overflow horizontal; chave desligada sem imagens. A prévia substitui apenas limites Next, ações e onboarding, não valida autenticação nem ações contra produção.
- Harness fast/full encontrou falhas gerais preexistentes (sales-navigation e meta-capture-controls); as suítes gerais foram interrompidas após esses resultados. A suíte completa não é declarada aprovada.
- Full: lint global bloqueado pelas 952 ocorrências preexistentes de mojibake em três arquivos. Demais diagnósticos e relatório em reports/agent/verification.
- Build de produção Webpack passou (exit 0), com compilação em 8,7 min, sem cache em disco devido ao espaço livre reduzido. Tipos passaram separadamente no harness. Aviso existente do unpdf e logs de rotas dinâmicas não impediram a conclusão. A configuração original foi restaurada, com diff vazio confirmado, e não integra a mudança.

Evidências: reports/agent/verification/2026-10-28T15-37-55.310Z.md (fast), reports/agent/verification/2026-10-28T15-41-24.329Z.md (full), relatórios direcionados 2026-10-28-illustrations-* e diretório 2026-10-28-illustrations-ui com QA.json e capturas.

Após integrar os cinco commits mais recentes da branch de destino, o único conflito
foi no histórico de funcionalidades; ambos os registros foram preservados. A rodada
final combinada passou: 83 testes em 9 arquivos, TypeScript e validação documental.
O build foi executado antes da integração, sobre a mesma implementação visual; os
commits recebidos não alteraram os pontos de aplicação dos assets. Logs finais:
reports/agent/verification/2026-10-28-illustrations-after-rebase-tests.log e
reports/agent/verification/2026-10-28-illustrations-after-rebase-types.log.
