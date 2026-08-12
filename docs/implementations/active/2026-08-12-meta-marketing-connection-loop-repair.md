# Reparo do início de conexão Meta Marketing

## Objetivo

Eliminar o ciclo de Server Actions em `/integrations/meta` ao iniciar o OAuth de
Marketing, preservando o isolamento por tenant e a auditoria da tentativa.

## Escopo entregue

- Extraído o caso de uso de criação da tentativa para um serviço server-side.
- Criada a rota interna autenticada `POST /api/integrations/meta/marketing/attempt`.
- A interface faz uma única requisição HTTP por clique, com trava local contra
  chamadas duplicadas e sem revalidar a rota de integrações.
- A resposta informa apenas falhas recuperáveis (sessão, autorização ou falha de
  preparo), enquanto os logs registram um código correlacionável sem token,
  estado OAuth, tenant ou dados pessoais.
- Adicionado teste de contrato da rota e um probe transacional de banco que insere
  a tentativa e sempre executa rollback.

## Segurança e rollback

A identidade e o tenant continuam derivados exclusivamente da sessão no servidor.
O endpoint não recebe payload, não expõe a tentativa persistida e usa `no-store`.
O rollback é reverter a interface para a Server Action anterior e remover a rota;
nenhuma mudança de schema é necessária.

## Validações

- `npm run test -- src/app/api/integrations/meta/marketing/attempt/route.test.ts src/features/meta-ads/meta-connection-attempts.test.ts`
- `npm run db:check-meta-connection`
- `npm run agent:verify -- --level fast`

## Próximo passo

Após o deploy, validar uma única abertura de OAuth no navegador e confirmar nos
logs somente um `POST /api/integrations/meta/marketing/attempt` por clique.
