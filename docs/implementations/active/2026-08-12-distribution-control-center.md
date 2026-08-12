# Central de controle de distribuição

## Objetivo

Evoluir `/leads/distribuicao` como centro operacional único para filas, exceções, regras e explicação de decisões, preservando o motor de distribuição existente.

## Decisão de domínio

- A distribuição pós-qualificação deixa de escolher um corretor por caminho próprio: após resolver o destino de qualificação, ela coloca o lead na fila e usa o mesmo processador das demais entradas.
- A primeira entrega reutiliza as entidades existentes de fila, política, plantão, tentativas e eventos; não cria grupos paralelos ou uma segunda linguagem de regras.

## Escopo

- Gestão de filas por unidade, ativação, estratégia e capacidade.
- Simulador sem efeito colateral e histórico explicável.
- Central visual com estados de carregamento, vazio, erro, sucesso e acesso restrito.
- Integração da qualificação ao processador único.
- Regra de entrada por campanha Meta: uma campanha sincronizada pode apontar para uma fila ativa antes do fallback da Página, sem duplicar capacidade ou atribuição.

## Pendências conscientemente fora desta onda

- Grupos reutilizáveis de corretores/unidades e fallback em cadeia exigem novas entidades relacionais e migração própria.
- Redistribuição por cronômetro continua no job existente; políticas específicas por fila serão ampliadas em onda posterior.

## Validações

- `npm run db:check`: schema e migração 0115 consistentes.
- Testes focados da distribuição, intake e Meta Lead Ads: 17 cenários aprovados.
- Harness completo: arquitetura, segurança, type-check, 304 testes e build de produção aprovados. O lint geral continua falhando por 327 erros preexistentes fora deste recorte; nenhum erro novo de encoding foi encontrado.

## Reversão

- Pausar a regra por campanha desabilita sua entrada sem remover campanha ou fila; apagar a migration remove apenas os vínculos novos.
- Desfazer a interface e o resolvedor faz o intake retornar à regra por Página, sem alterar leads já atribuídos.
