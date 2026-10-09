> **DESCONTINUADO (2026-10-09).** O único design system do CRM é o do modo Lite: [`docs/design-system/lite/LITE_CHAT_DESIGN_SYSTEM.md`](/docs/design-system/lite/LITE_CHAT_DESIGN_SYSTEM.md). Este documento fica só como histórico; não use seus valores.

# Regras de Acessibilidade

## Obrigatório agora

- HTML semântico, foco visível, navegação por teclado, rótulos de formulário e contraste adequado.
- Estados de carregamento, vazio, erro, sucesso, permissão negada e indisponibilidade quando aplicáveis.
- Ícones interativos têm nome acessível; informação crítica não depende exclusivamente de cor ou motion.
- Revisar leitor de tela, zoom, viewport estreito e `prefers-reduced-motion` antes de encerrar mudança de UI.

## Limites da fonte

`design.md` não fornece razões de contraste, foco, tamanho mínimo de alvo, regras ARIA, anúncio de erro ou política de dados em tabela. Esses itens são **MISSING** e estão em DG-006; as regras mínimas acima decorrem das normas vigentes do projeto, não de valores visuais inventados.
