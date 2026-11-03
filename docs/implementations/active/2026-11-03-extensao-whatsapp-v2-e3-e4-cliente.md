# Extensão WhatsApp v2: interface E3 e cliente E4

Data: 03/11/2026. Branch: `feat/ext-v2-ui`, base do merge `0c595280`.
Integração do servidor E3 e da inbox E4: merge `107d90f3`.

## Implementação

- E3: gaveta Lite lista as ofertas pendentes com contador, temperatura, plantão, telefone mascarado e prazo; recusa pede confirmação e explica o pulo. A aceitação respeita `foraDoPlantao`, mostra `expired`, `already_assigned` e `outside_duty`, e mantém o aceite quando o WhatsApp não confirma a abertura.
- A abertura usa o fluxo nativo de nova conversa, busca o telefone, exige correspondência exata com a conversa ativa e só preenche a saudação se o composer estiver vazio. Não clica em enviar. Em falha, mostra retry e link `web.whatsapp.com/send` validado pelo worker.
- O contexto prefere `proximoPasso` e lê `nextAction` como fallback. O contador de prazo roda só enquanto a gaveta está aberta.
- E4: a aba aberta envia pulso pela porta a cada 20 s; o worker faz singleflight, limita chamadas da inbox a no máximo uma a cada 19 s e usa `chrome.alarms` a cada minuto quando não há porta conectada. Respostas 304 preservam cursor; `Retry-After` em segundos ou data agenda a próxima tentativa.
- Eventos usam tipos allowlisted, ids processados persistem por geração, textos de notificações são genéricos, o badge mostra ofertas pendentes e um único alarme avisa no último minuto. O toast dentro do WhatsApp tem ação explícita; clicar numa notificação apenas foca o WhatsApp e abre/destaca a oferta.
- Som via documento offscreen é opcional e começa desligado. Manifest MV3 atualizado para `0.2.0`; build gera PNGs de ícone e `offscreen/audio.js`.

## Verificação

- `npx tsc --noEmit`: passou.
- Vitest mockado: 32 testes em `inbox-state.test.ts`, `ofertas-panel.test.tsx`, `whatsapp-adapter.test.ts`, `gaveta.test.tsx` e `gaveta-indisponivel.test.tsx`: passaram.
- `npm run build:extension`: passou. Bundle resultante: painel 245,7 KB não comprimido; worker 16,5 KB; content script 21,6 KB; offscreen 0,6 KB.
- `node scripts/ui/capture-extension-offers.mjs`: passou com fixture sintética, sem dados reais. Prints claros/escuros em `tmp/ext-ui/ofertas-claro.png`, `ofertas-escuro.png`, `aviso-claro.png` e `aviso-escuro.png`.
- `git diff --check`: passou. Não rodei a suíte completa nem testes que tocam banco.

## Limites para QA

- O pulso de 20 s, o alarme sem aba, o clique de notificação e a restauração após suspensão precisam ser validados no Chrome com a extensão carregada.
- O cliente não altera `credencial.ts` nem `sessao-token.ts`; todas as chamadas usam a geração e a rotação já existentes no worker.
