# Dados do cliente e painel do lead no Lite

Pedido do Vinicios em 21/10/2026, dentro da P3. Mostrar todos os dados cadastrais
e comerciais existentes do lead autorizado ao corretor, no desktop e no celular.
Preservar contato antes do aceite, escopo de carteira/tenant, origem/campanha e
classificação internas conforme política vigente. Nenhum acesso novo ou banco real.

Reprodução: client-info.test.ts e identity-zone.test.tsx produziram 2 falhas e
5 sucessos; lead-social-layout.test.tsx confirmou a falta do tema no portal.
Comandos e logs: reports/agent/broker-lead-data-red.log e broker-lead-sheet-red.log.

Causas verificadas: o normalizador ignora aliases em português; o card depende
de uma projeção parcial; o modo panel omite beneficiários; o sheet perde tokens
Arc ao ser montado fora da árvore do Lite. Corrigir reutilizando os componentes
existentes, sem dependências ou motion novo, e testar dados/privacidade/portal.

Implementação: `client-info.ts` reconhece os campos canônicos e aliases em português,
mantém respostas completas, listas de idades e booleanos. `ClientInfoCard` combina
a projeção comercial com os dados cadastrais disponíveis e protege o contato por
posse e aceite. A projeção da rota inclui plano, resumo, cidade, vidas e urgência.
O painel usa `PeopleDataSection` para reapresentar os beneficiários existentes.
O sheet recebe o escopo `arc-venancor`, nome acessível para fechar e a altura
`--app-dvh`, preservando o aviso superior e o mecanismo de rolagem compartilhado.
Rótulos e valores longos quebram linha no espaço disponível.

Validação: 17 testes em 5 arquivos passaram, incluindo dados completos, aliases,
observações longas, posse/aceite, tema do portal e retorno de foco. Log:
`reports/agent/broker-lead-data-focused.log`. ESLint dirigido sem erros, com quatro
avisos `any` preexistentes na rota. `git diff --check` passou. O harness completo
registra 0 achados de segurança; os avisos arquitetural e de desempenho são o
tamanho preexistente da rota (58 KB), sem ampliar consultas. O lint global falha
em 952 ocorrências de encoding em três arquivos fora desta alteração. O primeiro
harness fast foi interrompido por contenção de memória com o full/build; o full
continua como validação geral. TypeScript e build em andamento.

Controle e auditoria: não cria mutação, endpoint, parâmetro de tenant, novo acesso
ou exportação. Mantém os controles existentes de experiência Lite e visualização
pelo super-admin, a autorização da rota e a auditoria das operações existentes.
Não altera regras de distribuição, de aceite, nem de exposição de origem e campanha.
QA visual autenticado e publicação pendentes. Não publicado.
