# Ciclo comercial — acompanhamento de renovação

## Objetivo

Transformar o pós-venda já persistido no CRM em uma etapa operacional: o responsável pela carteira deve conseguir registrar o andamento da renovação na ficha do cliente, sem depender de notas soltas ou de um módulo financeiro.

## Escopo

- Exibir o status e as observações de renovação do cliente ativo.
- Permitir que Corretor, Gestor e Diretor atualizem o andamento apenas dentro do próprio escopo.
- Registrar a mudança na auditoria e atualizar imediatamente a ficha e as listas relacionadas.
- Corrigir a referência visual de renovação para usar o vencimento real do contrato quando ele estiver disponível.

## Fora de escopo

- Cálculo, pagamento, desconto ou estorno automático de comissões.
- Criação de uma nova venda durante a renovação.
- Automação de mensagens ou tarefas sem confirmação humana.

## Risco e rollback

A alteração apenas registra o andamento operacional do cliente ativo. Caso seja necessário reverter, remover o controle da ficha não altera contratos, vendas nem registros de auditoria já existentes.

## Validação

- `npm run type-check`: aprovado.
- `npm run agent:verify -- --level fast`: 55 arquivos e 231 testes aprovados.
- Lint direcionado nos arquivos alterados: aprovado.
- `npm run agent:verify -- --level full`: documentação, segurança, tipo, testes e build aprovados. O comando retorna falha por 325 erros de lint preexistentes fora deste escopo, incluindo `update_cards.js` e referências locais de design.
- Build de produção: aprovado; a geração da rota administrativa de revisão do WhatsApp precisou de uma nova tentativa por demora superior a 60 segundos, mas terminou com sucesso.
