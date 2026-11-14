# Mascote da Âncora Saúde · arquivos-fonte

Documentação completa: `docs/design-system/MASCOTE.md`.

- `referencias/`: pranchas e sequências aprovadas, as do dossiê de 14/11/2026. São imagens achatadas, sem camadas.
  - 01: propostas A, B e C; a A foi a escolhida.
  - 02: poses e expressões.
  - 03: modelo de produção v1.0.
  - 04: sequência com a âncora, só como referência.
  - 05: sequência aprovada no fundo branco.
- `reserva/`: recortes em PNG com fundo transparente, que deram origem a `public/mascote/*.webp`.
  - `positivo.png`: vem da proposta A, prancha 01.
  - `repouso.png`: primeiro quadro da sequência 05.
- `rive/`: onde vai o projeto da Rive (RML ou `.rev`) quando as camadas vetoriais existirem. Para criar com a Rive CLI, rode `rive create design/mascote/rive/mascote`. O contrato que o app espera está em `MASCOTE.md` §3.
