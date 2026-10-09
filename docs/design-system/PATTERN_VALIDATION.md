> **DESCONTINUADO (2026-10-09).** O único design system do CRM é o do modo Lite: [`docs/design-system/lite/LITE_CHAT_DESIGN_SYSTEM.md`](/docs/design-system/lite/LITE_CHAT_DESIGN_SYSTEM.md). Este documento fica só como histórico; não use seus valores.

# Validação de Pattern Blueprint

## Declaração obrigatória

Antes de criar ou refatorar uma página, registrar no `.agent/pattern-registry.json`:

```json
{
  "pattern": "LIST_PAGE",
  "route": "/exemplo",
  "status": "DECLARED",
  "exceptions": []
}
```

Uma exceção exige regra do contrato afetada, justificativa, dono, expiração e plano de convergência.

## Checklist de revisão

1. O blueprint corresponde ao objetivo primário da página.
2. Seus estados obrigatórios existem ou a ausência está registrada como exceção.
3. As ações são operáveis, autorizadas e têm feedback.
4. Foundations, primitives e composição seguem seus contratos.
5. Teclado, foco, leitor de tela, reflow e reduced motion foram revisados.

## Automação futura

`npm run design:patterns:validate` valida o JSON, a presença dos blueprints oficiais e o formato das rotas classificadas. Ele não bloqueia rotas legadas que ainda não foram classificadas.

No futuro, o validador pode comparar o registry às rotas de `src/app/` e falhar apenas para rotas novas/refatoradas declaradas no escopo do PR. Não habilitar bloqueio global até existir baseline confiável; o registry atual é a baseline documental.
