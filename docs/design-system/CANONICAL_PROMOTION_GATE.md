# Promotion Gate

Um candidato só é `CANONICAL_READY` quando todos os itens abaixo tiverem evidência no PR/registro:

- [ ] API pública revisada contra todos os consumidores.
- [ ] Variantes fechadas e aliases legados documentados.
- [ ] Foundations oficiais mapeadas sem valor arbitrário novo.
- [ ] Default, hover, focus, active, disabled, loading/erro quando aplicável.
- [ ] Teclado, nome acessível, aria e reduced motion validados.
- [ ] Responsividade declarada.
- [ ] Teste de interação no seam público passa.
- [ ] Galeria interna renderizada e revisão visual observada.
- [ ] Baseline visual aprovado explicitamente.
- [ ] Destino de migração e enforcement de nova dívida registrados.

Enquanto qualquer item estiver pendente, o status obrigatório é `CANONICAL_CANDIDATE`, `HARDENING` ou `REVIEW_REQUIRED`.
