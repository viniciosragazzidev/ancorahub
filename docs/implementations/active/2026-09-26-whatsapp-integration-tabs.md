# Unificação visual dos canais WhatsApp

## Escopo e decisão

`/integrations/whatsapp` passa a ser a página canônica com duas áreas selecionadas pela URL: **Oficial (Meta)** como padrão e **Diretoria (WAHA)** em `?visao=diretoria`. A segunda área aparece somente para Diretor, como já ocorre na rota anterior. `/integrations/whats_alt` preserva links antigos por redirecionamento. A troca de aba não conecta, pausa, desconecta nem altera o roteamento de mensagens.

A distinção de domínio da DEC-120 permanece: o número Meta é o canal oficial de atendimento e notificações; o número WAHA da diretoria conversa com corretores e pode enviar apenas os avisos internos já permitidos. Nenhuma consulta ou ação ganha escopo por causa do parâmetro `visao`. O catálogo mostra um único destino WhatsApp; os controles de governança, feature flags, validações e auditoria das operações existentes permanecem nos serviços e Server Actions atuais.

## Interface e compatibilidade

- O título **WhatsApp** permanece na barra superior. A área de conteúdo começa pelas abas e uma explicação curta, sem título grande duplicado.
- Abas em links acessíveis, com seleção na URL, mesmo padrão visual de `/equipe`, foco e overflow horizontal em telas estreitas. A aba da diretoria é omitida quando o papel não pode acessá-la.
- Cada aba carrega somente seu próprio conteúdo e consultas. Oficial conserva conexão Meta, teste e atalho de mensagens automáticas; Diretoria conserva pareamento QR e roteamento de avisos.
- Ações WAHA revalidam a nova URL canônica; imports existentes das Server Actions não mudam. Links antigos chegam à aba correspondente.
- Estados de carregamento, conexão pendente/indisponível, falha e acesso negado seguem os componentes e contratos existentes.

## Verificação

Checar TypeScript, lint direcionado, testes de navegação/permissão e build; inspecionar autenticado as duas abas e o redirecionamento antigo. Registrar resultado no relatório do harness e no controle UX. A revisão transversal mobile UX-M1.10 permanece pendente.

## Refinamento de densidade — 26/09/2026

- O aviso visual “Proteção de dados” saiu da aba Oficial; nenhuma filtragem, validação ou regra de acesso foi alterada.
- A aba Diretoria passou de `max-w-4xl` alinhado à esquerda para uma grade `w-full max-w-7xl mx-auto`, preenchendo o espaço disponível e ficando centralizada em telas largas. Os cartões de conexão, roteamento e mensagens continuam na mesma ordem.
- Em `/integrations/meta`, saíram o card introdutório duplicado “Marketing Meta”, o card que direcionava ao número corporativo e o aviso explicativo sobre `leadgen`. O painel principal mantém o status da conexão, as ações e os ativos. O aviso de acesso somente leitura permanece para quem não pode configurar.
- Validação deste refinamento: TypeScript, ESLint dos três componentes tocados, 13 testes de navegação/visão Meta e build Next passaram. Navegador autenticado confirmou os blocos removidos e a largura sem overflow em 320, 390 e 430 px. Evidência local: `reports/agent/verification/2026-09-26-integration-ui-cleanup.md`.
