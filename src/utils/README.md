# Utilitários compartilhados

Este diretório reúne código técnico reutilizável entre domínios, páginas e
serviços do CorreTop. Cada categoria possui sua própria documentação em
`docs/`.

## Limites

- Não colocar regras de negócio específicas de um domínio aqui.
- Não colocar queries, autorização, contexto de tenant ou acesso direto ao banco.
- Não colocar segredos, tokens ou integrações externas sem um adaptador explícito.
- Utilitários devem ser determinísticos, testáveis e independentes de uma página.

Autenticação, banco, armazenamento e features continuam nos diretórios próprios.
