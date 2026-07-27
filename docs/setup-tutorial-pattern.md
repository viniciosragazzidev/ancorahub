# Padrão de tutoriais de configuração

Use este padrão sempre que uma capacidade exigir duas ou mais ações do cliente.

## Regra de produto

O ponto de entrada deve usar um botão com a forma `Iniciar configuração de...`.
Esse botão abre o componente reutilizável `SetupTutorialDrawer`, que apresenta:

- uma mensagem curta de boas-vindas e contexto;
- cards de exemplo para cada etapa;
- somente a primeira etapa incompleta liberada;
- etapas futuras visíveis, porém bloqueadas;
- progresso derivado do estado real da capacidade;
- retomada no passo correto depois que o usuário voltar da área de configuração;
- estado final de sucesso quando todas as etapas estiverem concluídas.

## Implementação

O esqueleto fica em `src/components/setup/setup-tutorial-drawer.tsx`.
Cada tutorial deve fornecer `steps` com IDs estáveis, descrições, destinos e
`completedStepIds` derivados de consultas ou ações autorizadas no servidor. Não use
estado local como fonte de verdade para concluir uma etapa.

Quando uma etapa levar para outra rota, inclua um retorno interno validado, como:
`/settings/recurso?returnTo=/origem?setup=recurso`. A rota de origem deve reabrir o
drawer somente quando receber o marcador de retomada e deve mostrar sucesso apenas
quando a consulta real confirmar a conclusão.

## Apresentação visual

O tutorial usa um dialog centralizado, com overlay escuro e `backdrop-blur`, em vez de
um drawer lateral. O botão continua usando o padrão `Iniciar configuração de...` e
todos os tutoriais reaproveitam `SetupTutorialDialog` (com alias legado
`SetupTutorialDrawer`). O dialog preserva etapas bloqueadas, retomada, progresso real
e estado final de sucesso.

## Primeiro caso: WhatsApp em `/conversas`

O fluxo implementado usa:

1. Conectar o WhatsApp: sessão pronta (`status === "ready"`).
2. Ativar o chat interno: sessão pronta e `chatInternoAtivo === true`.

O retorno da configuração é limitado a caminhos internos e o status é consultado
no servidor por tenant e usuário antes de montar o tutorial.

## Como pedir novos tutoriais

Ao solicitar “faça um tutorial para X”, reutilize este componente e entregue:

1. a capacidade e sua rota de entrada;
2. as etapas reais e a ação que consolida cada uma;
3. a consulta server-side que identifica cada conclusão;
4. a rota de retorno para retomada;
5. os estados de carregando, erro, bloqueado e sucesso.

Não crie um drawer, card de passo ou indicador de progresso local para uma nova
capacidade sem antes evoluir o componente compartilhado.
