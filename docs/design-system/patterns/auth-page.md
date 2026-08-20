# AUTH_PAGE

Use para autenticação, recuperação de acesso e confirmação de identidade. É uma superfície de segurança, não um funil comercial.

## Composição

Identidade do produto → objetivo simples → campos rotulados → ação primária → ajuda segura → links de retorno.

- Mensagens de erro não revelam se um e-mail/telefone existe.
- Estados de bloqueio, expiração e indisponibilidade explicam a próxima ação sem expor detalhes internos.
- Foco inicial e ordem de teclado seguem o fluxo de autenticação.

## Estados obrigatórios

default, inválido, enviando, sucesso, erro seguro, sessão expirada, bloqueado, indisponível e suporte alternativo.
