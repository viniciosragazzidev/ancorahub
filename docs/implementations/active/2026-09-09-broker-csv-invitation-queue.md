# Importação CSV e convite seguro de corretores

## Objetivo

Fazer a importação em lote produzir o mesmo estado seguro do cadastro manual: corretor pendente, convite de uso único e entrega pelo template oficial `broker_first_access`, sem ativação antecipada.

## Entregue

- CSV exige apenas `nome` e `telefone`; `email`, `cpf` e `unidade` são opcionais.
- Telefones repetidos no arquivo/tenant e e-mails já usados por qualquer identidade de acesso são rejeitados por linha.
- Cada registro válido nasce como `INVITED`, recebe convite `PENDING` e auditoria própria.
- O envio reutiliza a outbox idempotente do WhatsApp oficial e é drenado em lotes pequenos; nenhum WhatsApp pessoal participa.
- Cadastro manual e CSV usam o mesmo adaptador de entrega e as mesmas quatro variáveis do `broker_first_access`: nome, empresa, cargo e unidade.
- Convites sem e-mail permitem que o corretor defina um e-mail obrigatório no primeiro acesso; a ativação exige uma identidade nova, evitando reutilizar ou sobrescrever senha de uma conta existente, e persiste o e-mail no perfil e no convite.
- Perfis antigos `DRAFT` sem usuário deixam de aparecer como ativos na lista da equipe.
- Links Meta legados com `{{id}}` codificado após o token são normalizados nas duas rotas públicas, sem enfraquecer a validação criptográfica do convite.
- O worker nunca substitui o token por `invitationId`: convite inexistente, expirado, não pendente, sem token cifrado ou com falha de descriptografia encerra a entrega como falha explícita, sem enviar URL inválida nem cair para WAHA.

## Migração

`0144_optional_broker_invitation_email.sql` torna opcionais apenas os campos de e-mail anteriores à ativação. A conta final continua exigindo e-mail válido.

## Validação

- Teste regressivo do token Meta: aprovado.
- Contratos do payload Meta, catálogo `brokerInvitation`, política interna e worker: 20 testes focados aprovados em 09/09/2026.
- Type-check: aprovado após os hardenings finais.
- Build e harness full: pendentes até a verificação final desta entrega.

## Próximos passos

- Homologar um CSV sintético no canal Meta de teste e observar `queued → sent → delivered`.
- Expor métricas agregadas de tempo de fila e falhas definitivas no painel administrativo.
- Adicionar controle global específico para pausar novas importações; até lá, o item N48 permanece `partial` e o canal oficial já mantém sua governança existente.
