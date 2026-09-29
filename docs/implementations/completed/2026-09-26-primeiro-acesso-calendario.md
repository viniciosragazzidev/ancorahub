# Primeiro acesso: calendário de nascimento e borda do e-mail

- Escopo: formulário de ativação de membro convidado em `/primeiro-acesso`. O cadastro da equipe continua responsável apenas pelo convite.
- Decisão: reutilizar `Calendar`, `Popover` e `Button` compartilhados. Exibir nascimento em `dd/MM/aaaa`, com seleção de mês/ano em português e datas futuras indisponíveis; manter o valor enviado ao servidor em `AAAA-MM-DD`.
- E-mail: destacar a borda do campo corporativo tanto quando editável quanto quando preenchido pelo convite, preservando a aparência de campo bloqueado.
- Sem mudança de contrato, persistência, permissão ou validação do servidor. O fluxo de ativação e sua auditoria existentes permanecem.
- Evidência de código: `src/app/primeiro-acesso/onboarding-wizard.tsx`.
- Verificações: lint direcionado e geral, TypeScript e build de produção passaram. O harness full passou em documentação, arquitetura, segurança, desempenho e tipos; houve uma falha preexistente no teste do dashboard Lite. Evidência em `reports/agent/verification/2026-09-26-primeiro-acesso-calendario.md`.
- Limite: sem QA autenticado do convite por falta de token de teste; o QA mobile da etapa UX-M1.10 segue pendente.
- Rollback: restaurar o campo de data nativo e a classe anterior do e-mail somente em `onboarding-wizard.tsx`; o contrato de `birthDate` não mudou.
