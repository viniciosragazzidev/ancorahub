# Call Âncora: celular como receptor do computador, por cabo

Estudo de viabilidade e plano, 22/11/2026. Ainda sem código. Continua o plano `2026-11-19-call-ancora.md`: discador próprio, só o plano do chip, sem VoIP.

Decisão do dono (22/11/2026): **a ligação entre o celular e o computador é por cabo.** Os computadores da Âncora não têm Bluetooth.

## 1. O pedido

O celular Android da Âncora fica escondido atrás do computador, ligado a ele por cabo. O corretor usa um fone com microfone no computador:

- ouve no fone do computador o áudio da ligação feita pelo chip do celular;
- fala no microfone do computador e a voz vai para a ligação, nos dois sentidos ao mesmo tempo, como num VoIP;
- para ele, tudo acontece no CRM do computador: iniciar, atender, ver o estado e desligar.

As duas formas continuam valendo: **fone no celular** (como hoje) ou **fone no computador** (novo).

## 2. O limite do Android que decide tudo

Desde o Android 10, nenhum app comum consegue **ler** o áudio de uma ligação de operadora (`VOICE_CALL`, `VOICE_DOWNLINK` e `VOICE_UPLINK` exigem `CAPTURE_AUDIO_OUTPUT`, que só app de sistema tem). E **nenhum** app, nem de sistema, tem API pública para **colocar** áudio na voz que vai para o cliente. O que vai para a ligação é o que o modem recebe da rota de áudio ativa: o microfone do aparelho, o fone com fio, um fone USB ou um fone Bluetooth.

Ser o discador padrão, o que o app já é, não muda isso. Dá controle sobre a ligação e sobre **para onde** o áudio vai, mas não sobre o áudio em si.

Conclusão: o app não pode "pegar o som e mandar pelo cabo USB como dados". O computador precisa **parecer um fone com fio** para o celular, e o próprio Android leva a ligação até ele.

## 3. Caminhos por cabo avaliados

| Caminho | Funciona? | Por quê |
|---|---|---|
| **Cabo de áudio: a saída de fone do celular ligada às entradas e saídas de som do computador** (recomendado) | Sim, nos dois sentidos | O celular acha que tem um fone com microfone plugado e manda a ligação para ele, com o cancelamento de eco do próprio celular. O cabo leva o som do cliente até a entrada do computador, e a voz do corretor sai do computador e entra no "microfone" do celular. Não depende de app nem de permissão: é o mesmo caminho de um fone com fio. |
| Cabo USB de dados com ADB (ex.: scrcpy com `voice-call-downlink`) | Só metade | Como o ADB roda com mais permissão, alguns aparelhos deixam **ouvir** a ligação no computador pelo USB. Mas a voz do computador não chega ao cliente, porque não existe como colocar áudio na ligação (seção 2). Também exige depuração USB ligada sempre. Descartado. |
| Celular como "placa de som USB" do computador (modo acessório de áudio, AOA 2.0) | Não | O Android removeu esse modo na versão 8. |
| Rede pelo cabo USB (ancoragem) e WebRTC entre o app e o CRM | Não | Esbarra no mesmo bloqueio: o app não lê nem coloca áudio na ligação. |
| Adaptador Bluetooth USB no computador | Funcionaria | Fora pelo pedido do dono: a conexão é por cabo. Fica registrado como alternativa se o cabo der problema. |
| VoIP, tronco SIP ou gateway GSM | Fora | Já descartados: custo por minuto ou compra de equipamento e bloqueio de chip. |

## 4. Arquitetura escolhida

```
                 COMPUTADOR (Windows)                                   CELULAR (atrás do computador)
  Fone do corretor ── placa de som 1                                    App Call Âncora (discador padrão)
  (USB ou P2)          │                                                 │
                       │  Windows "Escutar este dispositivo"             │
                       ├─ som do cliente: entrada (placa 2) → fone 1     │
                       └─ voz do corretor: microfone 1 → saída (placa 2) │
                                     placa de som 2  ◄── cabos de áudio ──►  entrada de fone do celular
                                                                            (P2 do aparelho, ou adaptador USB-C
                                                                             de áudio com carga)
  Navegador: CRM /call-ancora ── HTTPS ──► AncoraHub (Coolify) ◄── HTTPS (já existe) ── App
                                            sessão, fila, comandos e estado
```

### Como o som anda

1. **Cliente → corretor:** o celular manda o som da ligação para a "saída de fone". O cabo leva à **entrada** (microfone ou linha) de uma placa de som do computador. O Windows repassa essa entrada para o fone do corretor com o recurso nativo **"Escutar este dispositivo"** (Propriedades do microfone > Escutar), sem instalar nada.
2. **Corretor → cliente:** o microfone do fone do corretor é repassado, também por "Escutar este dispositivo", para a **saída** dessa mesma placa ligada ao celular. O cabo leva ao "microfone" do celular, que manda para a ligação.

Para isso o computador precisa de **duas saídas de som separadas**: uma ligada ao celular e outra para o fone do corretor. O jeito simples:

- as entradas P2 da própria placa-mãe (rosa = microfone, verde = saída) ficam ligadas ao celular;
- o corretor usa um **fone USB**, ou um fone P2 ligado a uma **placa de som USB** simples.

O navegador e o servidor nunca tocam no áudio. Sem gravação, como já combinado.

### O cabo no lado do celular

- **Celular com entrada P2 de fone:** um cabo "divisor de fone" (P2 de 4 polos para dois P2, microfone e fone) liga direto às duas entradas do computador. A porta USB fica livre para carregar.
- **Celular só com USB-C:** um **adaptador USB-C de áudio com carga** (saída P2 com microfone + entrada de carga) e o mesmo divisor. Sem a passagem de carga, o celular não carrega enquanto estiver ligado ao computador.

### Ajustes que precisam ser feitos uma vez

- **Volume:** a saída de som do computador é forte demais para um microfone de celular. Deixar o volume dessa saída baixo ou usar um cabo atenuador; o teste da fase 0 acha o nível certo.
- **O celular reconhecer o microfone:** o celular só usa o "microfone" do cabo se detectar um fone **com microfone**. Uma saída de computador ligada direto pode ser vista como "fone sem microfone", e aí o celular volta para o microfone dele. Se isso acontecer, entra um atenuador com resistor no lugar do microfone (peça barata). **É o principal ponto a validar na fase 0.**
- **Zumbido:** carregar o celular pela USB do próprio computador enquanto o áudio também vai ao computador pode gerar zumbido (laço de terra). Se aparecer, carregar o celular por um carregador de tomada ou usar um isolador de terra P2.
- **Windows:** desligar os "aprimoramentos" de som e a redução automática de volume em comunicações nas duas placas.

### O que precisa comprar (uma vez, por estação, sem contrato)

- Cabo divisor de fone P2 (4 polos para 2) e um cabo P2–P2, ou dois.
- Se o celular não tiver P2: adaptador USB-C de áudio com carga.
- Se o corretor não tiver fone USB: uma placa de som USB simples.
- Se precisar: atenuador ou isolador de terra P2.

### Trocar entre "fone no computador" e "fone no celular"

Com um fone com fio plugado, o Android **sempre** usa esse fone: não deixa escolher o alto-falante de ouvido do aparelho por software. Na prática:

- **Fone no computador:** cabo ligado. É o modo padrão da estação.
- **Fone no celular:** tirar o cabo e plugar o fone no celular. O app percebe a troca e avisa o CRM ("Áudio no celular").
- **Viva-voz do celular:** pode ser escolhido pelo CRM a qualquer hora, como plano de emergência.

O CRM mostra onde o áudio está, mas a troca entre computador e fone do celular é física (trocar o cabo pelo fone).

## 5. Integração com o CRM

1. **Estado do áudio** no estado do celular que o CRM já lê: rota atual (`computador` = fone com fio detectado, `viva-voz`, `celular`) e se está no mudo.
2. **Comandos novos** na rota `control`: `speaker_on`, `speaker_off`, `mute`, `unmute`, `hangup` e `answer`. Hoje ela aceita `pause`, `resume`, `skip` e `end`. O app aplica com `setAudioRoute` até o Android 13 e `requestCallEndpointChange` no 14 ou mais novo, ambos permitidos ao discador padrão.
3. **Tela `/call-ancora`** (padrão Lite e densidade enxuta): no cartão da ligação ativa, um selo "Áudio no computador" ou "no celular", o botão de mudo e o Desligar que já existe. O viva-voz fica no menu `⋯`. Se o cabo sair no meio da ligação: "O cabo do computador saiu: a ligação foi para o celular". Troca de saída é feedback nível 1 (visual, sem som).
4. **Ligação recebida** (o cliente retornando para o chip): o CRM mostra "Chamada recebida" com Atender e Recusar. O celular manda o evento de tocando na hora e o CRM consulta mais rápido enquanto houver chamada tocando, para o Atender não ficar atrasado com a consulta de 1 s.
5. **O que hoje só existe no celular** (Pausar, "Segure para encerrar", checklist) precisa ter equivalente no CRM ou ficar resolvido na instalação, porque ninguém vai tocar no aparelho.
6. **Laboratório** (`/dev/laboratorio`): o roteiro simulado ganha o selo de áudio, o mudo e o cabo saindo no meio da ligação.
7. **Painel do diretor:** por estação, "Áudio no computador" ou "no celular".

## 5A. "Celular Call Âncora": o app vira a cara do aparelho

Pedido do dono (22/11/2026): ao abrir, o app ocupa o celular e impede, ou pelo menos dificulta, que o corretor saia dele e use o aparelho para outras coisas.

| Nível | O que trava | O que exige |
|---|---|---|
| **1. Launcher (tela inicial)** | O botão Início sempre volta para o Call Âncora; não há gaveta de apps | Declarar o app como `HOME` e escolhê-lo como tela inicial. Fácil de desfazer: a barra de notificações e os Ajustes continuam abertos. |
| **2. Fixar tela** | Início e Recentes ficam travados até o gesto de desafixar | Recurso comum do Android. Quem conhece o gesto sai (pode pedir PIN, mas sai). |
| **3. Modo quiosque com o app como dono do dispositivo (Device Owner)** (recomendado) | Barra de status, notificações, Início, Recentes e Ajustes bloqueados; só os apps da lista abrem; sem desinstalar, sem instalar outros, sem redefinir de fábrica pelo menu | O app vira "dono do dispositivo" (`DevicePolicyManager`, `startLockTask` com lista de apps permitidos). Gratuito, sem MDM pago. Exige **celular zerado e sem conta Google** na hora de ativar, com um comando ADB feito uma vez pelo cabo USB (`dpm set-device-owner`). |

Recomendado: **nível 3**, porque o aparelho é da Âncora e dedicado. Ganhos extras para o celular escondido:

- conceder sozinho as permissões do checklist (ligar, estado do telefone, notificação), sem ninguém tocar na tela;
- tela sem bloqueio e sempre acesa enquanto carrega (`setKeyguardDisabled`, `STAY_ON_WHILE_PLUGGED_IN`);
- o app abre sozinho depois de reiniciar;
- bloquear instalar apps, depuração USB, redefinição pelo menu e troca de discador padrão.

Saída de emergência: no app, "Sair do modo Call Âncora" só com PIN do diretor (ou comando do diretor pelo CRM), para manutenção. Desfazer de vez: o próprio app remove o modo dono, ou redefinir de fábrica.

Cuidados:
- O modo dono **não** ativa num celular já em uso com conta: precisa zerar antes. Fazer isso na entrega do aparelho.
- Atualizar o app depois passa a ser pelo próprio app (baixando do AncoraHub) ou por ADB pelo cabo.
- Alguns fabricantes (Samsung, Xiaomi) têm telas próprias que escapam do quiosque em versões antigas; testar no modelo escolhido.

## 6. Riscos

| Risco | Efeito | Como tratar |
|---|---|---|
| Celular não reconhece o cabo como fone **com microfone** | O cliente ouve o microfone do celular, não o corretor | Fase 0 testa antes de qualquer código; se falhar, atenuador com resistor. |
| Volume alto demais na entrada do celular | Voz estourada para o cliente | Volume baixo na saída do computador ou cabo atenuador; nível anotado no guia. |
| Zumbido por laço de terra | Chiado na ligação | Carregar por tomada ou isolador de terra P2. |
| Celular só USB-C sem adaptador com carga | Bateria acaba durante o dia | Comprar adaptador com passagem de carga. |
| Eco | O cliente ouve a própria voz | O cancelamento de eco do celular trata a "saída de fone". Fone fechado do lado do corretor; desligar aprimoramentos e redução de volume no Windows. |
| Latência | Atraso perceptível na conversa | Cabo analógico não soma atraso; o "Escutar este dispositivo" do Windows soma pouco (dezenas de ms). Medir na fase 0. |
| Computador com uma placa de som só | Não dá para separar fone do corretor e cabo do celular | Fone USB ou placa de som USB simples. |
| Troca para "fone no celular" é física | Não dá para trocar só pelo CRM | Aviso claro no CRM; viva-voz do celular como emergência pelo CRM. |
| Comandos pela consulta de 1 s | Atender com atraso | Consulta mais rápida enquanto toca; trocar por SSE só se a fase 3 mostrar necessidade. |
| Quiosque exige celular zerado | Aparelho em uso precisa ser redefinido | Ativar o quiosque na entrega do celular, antes de qualquer conta. |
| Sessão "Call Âncora limpo" mexeu nos mesmos arquivos (`CrmPanel.kt`, `MainActivity.kt`, `call-ancora-workspace.tsx`) | Conflito de merge | Começar as fases 1 e 2 a partir do `preview/3005` com o trabalho dela já juntado. |

## 7. Fases

**Fase 0. Prova sem código (meia hora, no computador e celular reais).**
Ligar o celular às entradas rosa e verde do computador com o divisor (e o adaptador USB-C, se precisar), corretor com fone USB, "Escutar este dispositivo" nos dois sentidos. Fazer uma ligação pelo Call Âncora e conferir: o cliente ouve o corretor (e não o microfone do celular), o corretor ouve o cliente, volume, eco, zumbido e atraso. Testar também tirar o cabo no meio da ligação. Anotar modelo do celular e peças usadas. Se o celular não reconhecer o microfone, testar com atenuador antes de seguir.

**Fase 1. App Android: estado do áudio.**
Ler a rota (`onCallAudioStateChanged` / `onAvailableCallEndpointsChanged`), reportar ao CRM rota, mudo e cabo saindo, aceitar os comandos de viva-voz, mudo, atender e desligar. Teste unitário da regra de rota.

**Fase 2. CRM: selo de áudio, mudo e avisos.**
Comandos novos em `control`, campos de áudio no estado do celular, selo e mudo no cartão da ligação, viva-voz no `⋯`, aviso de cabo, roteiro do laboratório. Testes em `device-routes.test.ts`.

**Fase 3. Chamada recebida pelo CRM.**
Evento de tocando na hora, Atender e Recusar no CRM, consulta rápida enquanto toca.

**Fase 3A. Celular Call Âncora (quiosque).**
Launcher (`HOME`), `DeviceAdminReceiver` com modo dono, `startLockTask` com lista de apps permitidos, permissões concedidas pelo próprio app, tela acesa carregando, sem bloqueio, saída com PIN do diretor. Pode correr em paralelo às fases 1 e 2, porque mexe em outros arquivos (manifesto, receptor novo e tela de entrada). Testar no celular zerado do dono.

**Fase 4. Instalação por estação.**
Guia curto com foto dos cabos (quais entradas, volume, "Escutar este dispositivo", carga), lista de peças aprovadas, status da estação no painel do diretor e teste com duas estações lado a lado.

## 8. Decisões

Seguindo a opção recomendada em cada ponto:

1. Ponte por **cabo de áudio** entre a saída de fone do celular e uma placa de som do computador, com o "Escutar este dispositivo" do Windows. Sem Bluetooth, sem ADB para o áudio.
2. Fone do corretor em fone USB ou placa de som USB, separado da placa ligada ao celular.
3. Modo padrão da estação: áudio no computador. Viva-voz do celular como emergência pelo CRM; fone no celular é troca física.
4. Celular em modo quiosque com o app como dono do dispositivo, saída por PIN do diretor.
5. Fase 0 antes de qualquer código.
