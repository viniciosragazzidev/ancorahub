# PDF da escala: orientação e conteúdo

## Alterações

- Removido o código do corretor impresso antes do nome no quadro.
- Recortes com um tipo de plantão usam página A4 em retrato e escala de conteúdo 1,25×.
- Removida a tabela “Resumo por corretor” do fim do documento.
- Atualizada a descrição da exportação no diálogo para não prometer códigos.

A definição de “um plantão” usa a quantidade de tipos/colunas que efetivamente aparecem no recorte. Recortes com vários tipos preservam A4 paisagem.

## Validação

- `npm run build`: aprovado; compilação, TypeScript e geração das 130 páginas concluídos. O Next registrou os avisos dinâmicos esperados de rotas que usam `headers` durante a geração estática.
- `npm run agent:docs`: aprovado; 18 referências verificadas.
- Testes automatizados não executados.
