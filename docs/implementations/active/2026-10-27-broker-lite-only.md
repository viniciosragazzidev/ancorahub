# Corretores exclusivamente no Lite

Pedido aprovado por Vinicios em 2026-10-27: desativar completamente o modo
normal para corretores. Escopo confirmado pelo pedido, sem nova preferência
ou chave que permita ao próprio corretor reabrir o modo aposentado.

## Diagnóstico e plano

O cookie NORMAL e a preferência persistida eram consultados antes do padrão
Lite. A Server Action também aceitava NORMAL e a sidebar expunha a alternância.

1. Fazer o papel broker autenticado prevalecer antes de ler cookie/banco.
2. Negar e auditar a troca para NORMAL, sem gravar preferência ou cookie NORMAL.
3. Retirar a alternância do menu legado. Reutilizar o shell e os bloqueios de
   rota Lite existentes, inclusive em acesso por URL e em Ver como corretor.
4. Testar cookie antigo, preferência persistida, contexto implícito/indisponível,
   Ver como e ação direta; validar e publicar somente esta correção.

Papel: corretor. Objetivo/ação principal: atender seus leads no Lite.
Disclosure e estados: os do Lite existente. Sem novos componentes, tokens ou
movimento. Outros papéis preservam seus controles existentes. A decisão altera
a disponibilidade do modo aposentado, sem mudar permissões ou escopo de dados.
O domínio ficou resolvido pelo pedido; não há decisão pendente para implementação.

## Estado e validações

Implementado e pronto para publicação na feat/diretor-visual-lite, conforme pedido.
A correção anterior Utility permanece na mesma base, sem alteração de conteúdo.
Deploy ainda não realizado por esta tarefa.

- Regressão reproduzida antes da correção: seis testes falharam por aceitar NORMAL.
- 34 testes focados passaram: resolução real do modo, ação direta, auditoria,
  indisponibilidade do banco, papel do diretor/gestor, shell Lite e rotas existentes.
- TypeScript passou no harness fast, no full e no build.
- Lint dirigido sem erros; um aviso preexistente de img na sidebar.
- Build de produção passou com npm run build -- --webpack, incluindo TypeScript
  e geração das páginas. Aviso preexistente de import.meta no unpdf.
- Harness full: documentação, arquivos alterados, arquitetura, segurança,
  desempenho e TypeScript passaram. Lint global bloqueado por 952 ocorrências
  preexistentes de codificação. Suíte geral interrompida após falhas fora do escopo
  e timeout ao encerrar worker de whatsapp-connect-dialog.test.tsx; não constitui
  uma execução completa da suíte. A falha de prefetch de Vendas já foi observada
  na validação da correção Utility, antes desta mudança no menu.
- Evidências locais em reports/agent/verification/2026-10-27T18-35-31.811Z.md,
  2026-10-27-broker-lite-build.log e 2026-10-27-broker-lite-focused-tests.log.
- Nenhuma alteração manual de dados de produção ou dependência.

## Rollback

Reverter somente o commit deste bloqueio; a correção Utility anterior é independente.
