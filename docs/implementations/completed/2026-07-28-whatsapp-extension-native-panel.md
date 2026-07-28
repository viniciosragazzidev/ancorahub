# Painel nativo da extensão no WhatsApp Web — 28/07/2026

## Objetivo

Exibir o CorreTop Assistant somente quando a conversa aberta corresponder a um lead atribuído ao usuário conectado e à sua unidade, usando âncoras estáveis do WhatsApp Web e um painel acoplado ao slot lateral nativo.

## Entrega

- O adaptador usa os `data-testid` do WhatsApp Web e só lê telefone/JID que já esteja visível; ele nunca clica para revelar dados.
- O painel é montado em `drawer-right`, isolado por Shadow DOM, recolhível, e não toca no compositor de mensagens.
- Conversas sem telefone, sem lead ou sem autorização permanecem silenciosas: não há card branco, aviso técnico nem vazamento de existência de dados.
- A autorização do gateway agora exige simultaneamente o mesmo usuário atribuído e a mesma unidade da sessão. Não existe exceção visual para os papéis de gestor ou diretor.
- Corretor, Gestor e Diretor encontram a extensão em Configurações. Todos podem baixar e conectar um dispositivo; somente o Diretor habilita/desabilita a política da empresa.
- Um diálogo de ajuda explica instalação, ativação, escopo e limites sem pedir que o corretor execute comandos.

## Validações

- `npm test -- --run src/features/browser-extension/lead-context.test.ts` — 3 testes aprovados.
- `npm run type-check` — aprovado.
- `npm run build` — aprovado; recriou `public/downloads/corretop-assistant.zip` e compilou o Next.js.

## Riscos e rollback

O DOM do WhatsApp pode mudar. Se os seletores deixarem de funcionar, o painel fica oculto e o WhatsApp continua utilizável. O rollback pode restaurar apenas os arquivos do content script; a política server-side mais restritiva deve permanecer.
