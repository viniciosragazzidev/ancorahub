# Reestruturação do cadastro Lead/Cliente

## Entregue nesta fase

- Componente compartilhado `PersonRecordDetails` para Lead e Cliente.
- Fatos organizados de registro, documentos, consentimento LGPD e dependentes.
- Biblioteca documental agrupada em Identificação, Dependentes, Proposta e contratação, Pós-venda e Outros.
- Contagem real de requisitos atendidos por categoria.
- Preservação das ações atuais de upload, substituição e revisão.

## Próximas fases

1. Perfil central de pessoa com CPF, data de nascimento, endereço e preferências.
2. Dependentes reutilizáveis entre Lead e Cliente.
3. Categorias persistidas e versionamento documental.
4. Abas compartilhadas de dados pessoais, dependentes, documentos, vendas e histórico.
5. Eventos de aniversário, vencimento e renovação para automações controladas.

As categorias exibidas agora são uma camada de compatibilidade. Não substituem a futura classificação persistida no banco.
