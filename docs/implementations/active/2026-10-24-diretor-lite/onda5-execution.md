# Onda 5: distribuição e plantões

Base: `origin/feat/diretor-visual-lite` em `d2d80a01`.
Worktree: `C:/Users/kyper/Desktop/Kyper/Projects/ancorahub-diretor-onda5`.
Branch: `feat/diretor-lite-onda5`.

## Entregas

- [x] `/distribuicao`, aba Resumo: diretor usa o gate server-side da empresa e a
  consulta existente de resumo; a versão antiga continua no caminho legado quando
  a chave está desligada.
- [x] `/distribuicao`, aba Entradas e regras: mesmos painéis e ações existentes,
  com uma área ativa por vez e navegação URL acessível.
- [ ] Aba Operação.
- [ ] Aba Filas.
- [ ] Aba Plantões e editor da ocorrência.
- [ ] Aba Saúde.
- [ ] `/distribuicao/dashboard`.
- [ ] Rotas de plantões do escopo 2.5.

O alias `/distribuicao` continua herdando o layout de autorização que bloqueia
gestores. Os novos links e conteúdo ficam no lado do servidor; a navegação recebe
somente valores serializáveis e não recebe JSX nem callbacks do servidor.
