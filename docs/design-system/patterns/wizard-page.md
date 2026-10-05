# WIZARD_PAGE

Use quando a ordem das etapas é relevante e o usuário precisa de progresso verificável. Não use para uma lista curta de campos independentes.

## Composição

Objetivo e saída → indicador textual de etapa/progresso → conteúdo de uma etapa → ações anterior/próxima/concluir → resumo final.

- O progresso não depende apenas de cor.
- A etapa atual, bloqueios e requisitos aparecem em texto.
- Cada transição preserva dados válidos; saída segura informa impacto quando houver dados não salvos.

## Estados obrigatórios

início, em progresso, bloqueado, validação inválida, salvando, concluído, erro recuperável, sem permissão e indisponível.

## Não usar

Não esconder uma decisão irreversível atrás de “próximo”; explique-a antes da confirmação.
