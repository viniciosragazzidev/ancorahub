# Pesquisa — discador automático para leads no AncoraHub

**Data:** 2026-09-30  
**Escopo:** avaliar arquitetura, esforço, custos variáveis e cuidados regulatórios para chamadas de saída a leads. Pesquisa exploratória; nenhuma integração foi implementada e nenhuma decisão de fornecedor foi tomada.

## Conclusão

É viável. A infraestrutura de telefonia não precisa ser construída pelo AncoraHub: um provedor CPaaS/telefonia pode cuidar da conexão com a rede pública, números, roteamento e mídia. O AncoraHub ficaria responsável por selecionar leads, autorizar a chamada, mostrar o softphone, guardar eventos e resultados e controlar a fila.

O esforço é **médio para um discador sequencial com um corretor e uma chamada por vez**; é **alto para um discador preditivo**, que liga para várias pessoas em paralelo e transfere as atendidas. A recomendação para uma primeira versão é “preview/power dialer”: o corretor vê o lead, inicia ou confirma cada chamada e só então segue para o próximo. Não começar com discagem preditiva.

## Como funcionaria

```text
Corretor abre a fila de leads atribuídos
  → escolhe/valida o próximo lead e inicia a chamada
  → o navegador usa um softphone WebRTC do provedor
  → o provedor completa a chamada para a rede telefônica
  → callbacks assíncronos atualizam toque, atendimento, falha e encerramento
  → o AncoraHub grava duração, resultado e próxima ação na atividade do lead
  → o corretor registra a disposição e avança para o próximo lead
```

Uma implementação normal teria estes blocos:

1. **Provedor de voz:** conta comercial, número de origem/caller ID e tarifas por destino/minuto. O provedor fornece APIs/SIP e a conexão à rede telefônica.
2. **Softphone no navegador:** microfone, saída de áudio, estado da conexão, silenciar e desligar. O SDK de voz da Twilio, por exemplo, permite chamadas de entrada e saída pelo navegador; a própria documentação também requer recursos e código no servidor, incluindo tokens de acesso e endpoint para instruções de voz.
3. **Backend do AncoraHub:** valida sessão, permissão, lead, tenant e preferências de contato; cria a tentativa; solicita a chamada ao provedor; nunca envia segredos permanentes ao navegador.
4. **Webhooks de status:** endpoint autenticado/verificado recebe eventos do provedor e atualiza a tentativa de forma idempotente. A Twilio documenta callbacks assíncronos para estados e encerramento da chamada.
5. **Histórico e operação:** tentativa, horário, duração, estado final, corretor, resultado (atendeu, caixa postal, ocupado, sem resposta, número inválido), notas, retorno agendado, tentativas máximas e lista de não ligar.

Uma ligação pelo link `tel:` seria um atalho simples para abrir o aplicativo de telefone do dispositivo, mas não é um discador integrado: por si só, não fornece ao CRM controle de áudio, estados confiáveis, callbacks nem custos consolidados.

## O que já existe no AncoraHub

- Os leads já têm telefone e escopo de tenant em `src/shared/db/schema.ts`.
- A distribuição já usa jobs e processamento recuperável em `src/features/lead-distribution/jobs.ts`; ações de distribuição passam `tenantId` do contexto do servidor em `src/features/lead-distribution/actions.ts`.
- A busca por `Twilio`, `Telnyx`, `VoIP`, SIP, softphone, voice SDK e discador não encontrou integração de telefonia de saída existente em `src/` nem no `package.json` consultado.

Isso favorece integrar uma camada de telefonia ao domínio já existente de leads e atividades, mas não significa que o projeto já tenha áudio, números, contratos de telefonia, callbacks de chamadas ou governança de gravações. A integração precisa ser uma capacidade isolada, por tenant, auditável, configurável e desligável pelo Super-admin.

## Esforço relativo

| Escopo | Complexidade | Principais pontos |
|---|---|---|
| Clique para ligar com resultado lançado manualmente | Baixa | Atalho ao telefone do usuário; controle e telemetria limitados. |
| Softphone e uma chamada por vez | Média | Áudio no navegador, permissões de microfone, tokens curtos, webhooks, falhas de rede, estados e histórico. |
| Power dialer sequencial | Média/alta | Fila por corretor, pausa, callback, re-tentativas, regras de horário, limites, idempotência e disposição antes de avançar. |
| Discador preditivo/múltiplas linhas | Alta | Concorrência, previsão de disponibilidade, chamadas atendidas sem agente, pacing, cancelamento, operação em tempo real e mais risco regulatório/reputacional. |

Não é recomendável implementar operadora, SIP/PBX e roteamento PSTN do zero. O custo de engenharia e operação (disponibilidade, qualidade de áudio, sinalização, carrier, caller ID e suporte) não parece justificável para o AncoraHub quando um provedor pode entregar essa camada como serviço.

## Brasil: regulação e privacidade

- A página atual da Anatel, atualizada em 28/08/2026, informa que o uso do prefixo 0303 foi tornado facultativo pelo Acórdão nº 201/2025. A mesma decisão exige autenticação para assinantes que originem mais de 500 mil chamadas em um mês, contabilizando números vinculados ao mesmo assinante/CNPJ. O volume e o enquadramento das chamadas precisam ser confirmados com o provedor e assessoria jurídica antes de produção.
- Há divergência documental que merece atenção: a página brasileira de voz da Twilio ainda mostra uma exigência de 0303 baseada na regra de 2022, enquanto a página atual da Anatel registra a alteração de 2025. Não tomar a página antiga do fornecedor como parecer regulatório; pedir confirmação escrita do provedor para a configuração e o volume do AncoraHub.
- Telefone, histórico de contato e eventual gravação podem ser dados pessoais quando ligados a uma pessoa identificável. A LGPD exige que finalidade, base legal, acesso, segurança e retenção sejam definidos. Para o MVP, gravação e transcrição podem ficar fora do escopo; se forem necessárias, planejar aviso, acesso restrito, prazo de retenção e exclusão antes de ativá-las.
- Controles de produto recomendados: registrar preferências/opt-out, horário permitido, limite de tentativas, pausa manual, bloqueio de duplicadas e auditoria de quem iniciou cada chamada. Não iniciar chamadas apenas porque um lead foi atribuído; deixar isso explícito e controlado pelo corretor/campanha.

## Custos indicativos

A telefonia normalmente traz cobrança variável por minuto/destino, número e recursos opcionais (por exemplo gravação ou transcrição). Como uma referência, a página de preços da Twilio para o Brasil, consultada nesta pesquisa e indicada como atualizada em agosto de 2026, exibe US$ 0,0310/min para chamadas locais, US$ 0,0663/min para chamadas móveis, US$ 0,0040/min para Browser/App e número local por US$ 4,25/mês. Esses valores são apenas uma referência publicada por um fornecedor, sujeitos a alteração; a conta real depende do fluxo de chamada, impostos, número, forma de cobrança de cada perna e contrato. Solicitar uma simulação com o tráfego esperado antes de escolher fornecedor.

## Caminho recomendado para validar

1. Definir se a necessidade é clique para ligar, sequência de chamadas para leads atribuídos, ou chamadas em massa/preditivas. A hipótese mais segura para começar é sequência de leads atribuídos, com confirmação do corretor a cada ligação.
2. Levantar chamadas/minutos por mês, número de corretores simultâneos, destinos fixos/móveis, caller ID desejado e necessidade de gravação.
3. Comparar 2–3 fornecedores por disponibilidade de número/caller ID no Brasil, custos de cada perna, SDK web, webhooks assinados, suporte, portabilidade e condições regulatórias.
4. Pilotar com uma fila pequena e sem gravação: uma chamada ativa por corretor, limites de tentativa, opt-out, registro de resultado, retry seguro de webhook e desligamento central pelo Super-admin.
5. Medir custo/minuto, taxa de atendimento, chamadas sem resposta, duração até a disposição e impacto na produtividade antes de considerar modo progressivo/preditivo.

## Alternativa: Asterisk autogerenciado numa VPS

Também é viável, especialmente porque a produção do AncoraHub já usa serviços separados no Coolify/VPS e o projeto já documenta o padrão de um serviço de integração isolado, autenticado e sem acesso direto ao banco. A documentação arquitetural descreve frontend e API em VPSs distintas e, para WAHA, uma VPS dedicada acessada por relay privado autenticado (ver `docs/architecture/system_design.md` e `docs/adr/0037-waha-cadence-relay.md`). Isso é um bom precedente de implantação — não significa que telefonia já esteja implementada.

O Asterisk seria o **PBX/engine de chamadas**, não a operadora. Para ligar para telefones públicos ainda será necessário contratar um ITSP/tronco SIP, com número/caller ID e tarifação de chamadas; a documentação PJSIP do Asterisk mostra a configuração de registro e endpoint de um provedor. A VPS hospeda o Asterisk, mas não torna as chamadas à rede móvel/fixa gratuitas.

Uma integração segura ficaria assim:

```text
Navegador → backend autenticado do AncoraHub → adaptador de telefonia privado → ARI do Asterisk
                                                              Asterisk → tronco SIP/operadora → telefone do lead
Navegador/backend ← eventos ARI via WebSocket ← Asterisk ← estados da chamada
```

- O backend do CRM continuaria decidindo quem pode ligar para qual lead e dentro de qual tenant; criaria uma tentativa de chamada antes de pedir ao Asterisk para originá-la.
- O adaptador de telefonia controlaria o ARI e encaminharia eventos ao CRM. A documentação oficial descreve ARI como REST para controle e WebSocket para eventos; recomenda esconder o ARI atrás do servidor da aplicação, onde ficam segurança, logs e isolamento multi-tenant. Não expor credenciais ARI/AMI no navegador nem deixar o endpoint de controle aberto à internet.
- Para o áudio do corretor, a primeira etapa pode usar telefone SIP/softphone separado: o CRM pede a chamada e o Asterisk toca o ramal do corretor e então conecta o lead. Colocar áudio dentro do navegador exige também configurar WebRTC, PJSIP sobre WSS, certificados TLS, autenticação, mídia/RTP, NAT e permissões de microfone. A documentação Asterisk confirma que WebRTC requer transporte WSS e configuração de certificados; é uma camada adicional, não algo automático por instalar o PBX.
- A segurança operacional é parte do custo: atualizações, firewall, restrição de origens SIP/ARI, dialplan que limite destinos, segredos, monitoramento de fraude/consumo, backups e disponibilidade. O próprio Asterisk alerta que configuração inadequada pode permitir uso não autorizado e gerar cobranças substanciais.

**Esforço estimado:** moderado para piloto com ramal/softphone e uma chamada por vez; médio-alto quando o áudio precisa ficar embutido no CRM; alto para discagem preditiva. Asterisk reduz dependência de um CPaaS e oferece mais controle, mas troca simplicidade gerenciada por responsabilidade de operar PBX, rede e segurança. Para o AncoraHub, eu isolaria Asterisk em VPS própria (ou serviço de voz dedicado), sem acesso ao banco, e manteria o backend do CRM como autoridade.

## Regulação — atualização relevante

A página da Anatel também informa que a Resolução nº 777/2025 prevê autenticação de chamadas para todas as chamadas no país em implantação progressiva dentro de até três anos; no regime específico do Acórdão nº 201/2025, assinantes acima de 500 mil chamadas por mês já têm obrigação explícita de autenticar. O provedor do tronco deve confirmar como oferece autenticação/identificação, caller ID e eventual prefixo para o volume e o tipo de ligação pretendidos. Colocar Asterisk numa VPS não transfere nem remove as obrigações da empresa usuária da telefonia.

### Referências

- [Twilio — Voice JavaScript SDK no navegador](https://www.twilio.com/docs/voice/sdks/javascript)
- [Twilio — arquitetura e requisitos do Voice SDK](https://www.twilio.com/docs/voice/sdks)
- [Twilio — callbacks de status de chamadas](https://www.twilio.com/docs/usage/webhooks/voice-webhooks)
- [Twilio — preços de Voice no Brasil](https://www.twilio.com/pt-br/voice/pricing/br)
- [Twilio — diretrizes de voz para o Brasil](https://www.twilio.com/en-us/guidelines/br/voice)
- [Anatel — telemarketing ativo e prefixo 0303 (texto atualizado em 28/08/2026)](https://www.gov.br/anatel/pt-br/regulado/numeracao/telemarketing-ativo-prefixo-0303)
- [Anatel — autenticação e identificação de chamadas](https://www.gov.br/anatel/pt-br/regulado/acompanhamento-e-controle/autenticacao-e-identificacao-de-chamadas)
- [Lei nº 13.709/2018 — LGPD](https://www.gov.br/pt-br/lgpd/lei-no-13-709-18-lei-geral-de-protecao-de-dados-lgpd-1)
- [Asterisk — ARI e práticas recomendadas para aplicação](https://docs.asterisk.org/Configuration/Interfaces/Asterisk-REST-Interface-ARI/)
- [Asterisk — configuração de WebRTC](https://docs.asterisk.org/Configuration/WebRTC/Configuring-Asterisk-for-WebRTC-Clients/)
- [Asterisk — configuração de tronco/registro PJSIP com provedor](https://docs.asterisk.org/Configuration/Channel-Drivers/SIP/Configuring-res_pjsip/Configuring-Outbound-Registrations/)
- [Asterisk — considerações importantes de segurança](https://docs.asterisk.org/Deployment/Important-Security-Considerations/)
