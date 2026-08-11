# Central de Filas — primeira entrega

**Data:** 11/08/2026  
**Estado:** entregue parcialmente

## Objetivo

Separar a rotina de tratamento de leads da configuração da distribuição e do acompanhamento da automação, sem alterar permissões, regras de atribuição ou o escopo de dados de cada papel.

## Entrega

- A rota `/leads/distribuicao` passou a se apresentar como **Central de Filas**.
- A experiência agora possui três contextos persistentes por URL:
  - `?view=operar`: filas de ação e Inbox de distribuição;
  - `?view=configurar`: unidades, disponibilidade e distribuição automática;
  - `?view=saude`: processamento assíncrono e efeitos pendentes do intake.
- Os cartões “Sem unidade”, “Sem corretor” e “Devolvidos à fila” usam contagens reais e abrem a Inbox já filtrada.
- A Inbox recebe o filtro da URL de forma estável, sem modificar o contrato das Server Actions existentes.
- O roadmap N24 foi atualizado como `partial` para registrar o recorte entregue.

## Limites preservados

- Diretor continua responsável pela fila central sem unidade.
- Gestor continua limitado à própria unidade para encaminhar, atribuir, reatribuir e configurar distribuição.
- Supervisor não recebeu acesso a distribuição, reatribuição, regras ou plantões. A fila de supervisão própria permanece pendente de decisão de produto e implementação posterior.
- Nenhuma regra de SLA, processamento automático, plantão, auditoria ou configuração do Super-admin foi alterada.

## Risco e rollback

A alteração é de composição da interface. O rollback consiste em restaurar a renderização sequencial anterior de `page.tsx`; não há migração, alteração de dados ou efeito externo.

## Validação

- `npx eslint src/app/(dashboard)/leads/distribuicao/page.tsx src/app/(dashboard)/leads/distribuicao/_components/distribution-inbox.tsx`
- `npm run type-check`
- `npm run agent:verify -- --level full` executou documentação, escopo, arquitetura, segurança e desempenho; terminou com falhas de lint globais em arquivos preexistentes fora deste recorte. As verificações focadas, o build e os testes abaixo foram executados separadamente.
- `npm run test`
- `npm run build`
