# WhatsApp já conectado: acesso pelo celular

## Pedido e contrato

O corretor deve poder abrir o WhatsApp no app do celular depois de conectar sua
sessão. A exigência de computador se aplica ao pareamento inicial/novo QR,
nunca ao uso da sessão conectada. Sem nova integração, dependência, credencial,
permissão ou alteração de regras de distribuição. Mantidas as Server Actions,
autorização derivada da sessão, auditoria e governança existentes.

## Diagnóstico reproduzível

Comando: `node node_modules/vitest/vitest.mjs run src/components/whatsapp/whatsapp-connect-dialog.test.tsx --maxWorkers 1 --reporter verbose`.

O teste inicial falhou porque “Conexão somente pelo computador” continuava
presente com `status=ready`. Evidência: `reports/agent/verification/whatsapp-mobile-red.log`.
Hipóteses verificadas: (1) aviso sem condição de estado; (2) controles conectados
sob container desktop-only; (3) estado persistido atrasado confundido com novo
pareamento no mobile. Inspeção e testes confirmaram os três pontos. A abertura
externa ainda usava `_blank` para o esquema nativo, criando contexto desnecessário.
O cenário mínimo não precisa de conta ou serviço real: componente real e respostas
sintéticas de ações. O teste evita depender de cache/latência do provedor.

## Correção

- `src/components/whatsapp/whatsapp-connect-dialog.tsx`: aviso apenas fora de
  `ready`; controles de chat/desconexão visíveis no celular quando conectado.
- Abrir no celular reconcilia a sessão existente por polling, sem toast de
  bloqueio nem `start`. Nenhuma sessão nova é criada; geração/renovação de QR,
  inclusive automática, permanece bloqueada no mobile.
- “Abrir WhatsApp Web ou app” usa `whatsapp://send` com `_self` no celular;
  desktop mantém WhatsApp Web em aba protegida com `noopener,noreferrer`.
- Mesmos Button, Dialog e PairingCallout, sem novo token ou animação.

## Validação

- Nove testes focados passaram: sessão pronta, sessão atrasada, abertura nativa,
  ativação/desativação do chat, desconexão, ausência de sessão, proteção contra
  reinício automático no celular e caminhos de desktop.
- Browser QA com componente/CSS reais e ações simuladas: 390px (ready, stale,
  idle) e 1280px (ready), controles visíveis, sem overflow horizontal, abertura
  externa correta, zero erros JS e zero chamadas de criação de sessão.
- Evidências: `reports/agent/verification/whatsapp-mobile-green.log` e
  `reports/agent/verification/whatsapp-mobile/results.json`, com screenshots.
- Harness fast passou: `reports/agent/verification/2026-10-02T19-31-39.095Z.md`.
  A suíte conjunta passou com 1.384 testes (18 ignorados); type-check passou.
- Lint focado: zero erros e três avisos preexistentes no conjunto das duas tarefas
  (`reports/agent/verification/roster-and-whatsapp-targeted-lint.log`).
- Harness full: oito etapas passaram, incluindo type-check, testes e build.
  Evidência: `reports/agent/verification/2026-10-02T19-43-10.334Z.md` e log
  `reports/agent/verification/roster-and-whatsapp-full.log`. O resultado global
  permanece com falha apenas no lint, pelo erro preexistente de regra inexistente
  `eslint(nextjs/no-img-element)` em `src/lib/pdf-primitives.tsx:248`.
- Os diagnósticos de tamanho do diálogo e demais arquivos já existentes não
  representam nova fronteira de dados ou dependência introduzida nesta correção.
- Limite: teste local verifica a entrega ao esquema nativo; a abertura final do
  WhatsApp instalado depende de homologação em Android/iOS/PWA reais. Não houve
  conexão, desconexão ou envio em conta real.

## Risco e rollback

Correção de apresentação e navegação de baixo risco. Reverter somente este patch
do diálogo restaura o comportamento anterior; sem migration ou alteração de dados.
Uma regressão semelhante seria evitada testando estado da sessão junto ao viewport,
com CSS real (jsdom sozinho não interpreta as classes responsivas).
