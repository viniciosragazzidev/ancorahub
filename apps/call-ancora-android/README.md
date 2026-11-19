# Call Âncora: prova do discador (Android)

App Android mínimo, só para testar no celular de verdade. Ele:

- vira o **discador padrão** do aparelho;
- liga para um número digitado, **sem precisar tocar em "ligar" no discador do sistema**;
- mostra, ao vivo, cada estado que o Android informou sobre a ligação (`DIALING`, `CONNECTING`, `RINGING`, `ACTIVE`, `DISCONNECTED` com a causa), com o horário e os milissegundos desde o pedido de ligação;
- deixa **copiar ou enviar** esse registro (WhatsApp, e-mail etc.).

O objetivo é medir, na operadora real, como o estado `ACTIVE` se comporta. Ainda não conversa com o CRM: isso é a etapa 2 (casca Capacitor e pareamento). Plano completo em `docs/implementations/active/2026-11-19-call-ancora.md`.

## 1. Preparar o computador (uma vez só)

1. Instale o **Android Studio** (gratuito): https://developer.android.com/studio
2. Abra o Android Studio uma vez e siga o assistente. Ele baixa o **Android SDK** sozinho.
3. Em *Settings > Languages & Frameworks > Android SDK*, confira se está marcado o **Android 15 (API 35)** em *SDK Platforms* e o **Android SDK Build-Tools** e **Platform-Tools** em *SDK Tools*.

O projeto usa Gradle 8.10.2, Android Gradle Plugin 8.7.3 e Kotlin 2.1.0. Funciona com Java 17 ou 21.

## 2. Gerar o APK

**Jeito mais fácil:** no Android Studio, *File > Open* e escolha a pasta `apps/call-ancora-android`. Espere sincronizar e use *Build > Build App Bundle(s) / APK(s) > Build APK(s)*.

**Pelo terminal:** o repositório não traz o `gradle-wrapper.jar` (é um binário). Crie o wrapper uma vez, dentro de `apps/call-ancora-android`:

```
gradle wrapper --gradle-version 8.10.2
```

(Se não tiver o `gradle` instalado, abrir a pasta no Android Studio uma vez também cria o wrapper.)

Depois, sempre que quiser gerar o APK:

```
gradlew assembleDebug        (Windows)
./gradlew assembleDebug      (Mac/Linux)
```

O arquivo sai em `app/build/outputs/apk/debug/app-debug.apk`.

Se o Gradle reclamar que não acha o SDK, crie `local.properties` nesta pasta com a linha `sdk.dir=C\:\\Users\\SEU_USUARIO\\AppData\\Local\\Android\\Sdk` (o Android Studio cria esse arquivo sozinho).

## 3. Instalar no celular

**Por cabo USB:**
1. No celular: *Configurações > Sobre o telefone*, toque 7 vezes em *Número da versão* para liberar as opções de desenvolvedor. Depois ligue *Depuração USB*.
2. Ligue o cabo e aceite a pergunta no celular.
3. No computador: `adb install -r app/build/outputs/apk/debug/app-debug.apk`

**Sem cabo:** mande o `app-debug.apk` para o celular (WhatsApp, Drive, e-mail), abra o arquivo e permita "instalar apps desta fonte". O Play Protect pode avisar que o app é desconhecido: toque em *Instalar mesmo assim*.

## 4. Deixar como discador padrão

1. Abra o **Call Âncora**.
2. Toque em **Tornar discador padrão** e confirme.
3. A faixa do topo fica verde: "Este app é o discador padrão".

Para voltar ao discador normal depois: *Configurações > Apps > Apps padrão > App de telefone* e escolha o discador do aparelho.

Enquanto for o padrão, **todas** as ligações do aparelho (inclusive recebidas) passam pela tela simples do Call Âncora: atender, desligar, mudo e viva-voz.

## 4.0 Conectar ao AncoraHub (etapa 2)

1. No computador, entre no AncoraHub e abra **Call Âncora**. Toque em **Iniciar**: aparece um QR (vale 2 minutos, uso único).
2. No celular, no cartão **Conectar ao AncoraHub**, toque em **Ler QR code** (o app pede a câmera só agora) e aponte para o QR.
3. Aparece "Conectado à conta de <nome>". O token do celular fica guardado criptografado; **Desconectar** apaga.

O app só aceita QR do CRM de produção (`https://crm.ancorasaude.cloud`) ou de endereços de desenvolvimento (localhost, emulador, IP da rede local).

**Segurança:** a fila de demonstração tem números fictícios e **nunca é discada**. O app só disca contatos que o servidor marcou como discáveis, e isso só acontece com a **Lista de teste (ligação real)**, que só administradores da plataforma veem na tela web. Para testar de verdade: na web, cole os números na Lista de teste e toque em "Usar como fila".

Com o celular conectado e a lista de teste ativa: toque em **Começar ligações**. Cada evento da ligação (discando, em ligação, encerrada com o motivo) aparece ao vivo na web. Ligação atendida: classifique na web (Com interesse / Sem interesse). Ligação que não chegou a ser atendida vira "Não atendeu" sozinha. Com **Discagem automática** ligada na web, a próxima ligação começa sozinha depois da contagem; desligada, toque em **Ligar para o próximo**. Pausar e "Segure para encerrar" ficam no celular.

A fila local (abaixo) continua em **Modo teste local**, recolhido.

## 4.1 Preparar o celular (obrigatório)

Ao abrir, o app confere tudo o que precisa e mostra o cartão **Preparar o celular**. Toque em cada item (ou em "Liberar o próximo") até todos ficarem com ✓:

1. discador padrão do aparelho;
2. fazer ligações;
3. ler o estado do telefone;
4. mostrar a notificação da ligação (Android 13 ou mais novo);
5. abrir a chamada com o celular bloqueado (Android 14 ou mais novo, abre os ajustes);
6. serviço de chamadas do app;
7. sinal da operadora (o app avisa: "Desligue o modo avião", "Coloque um chip" ou "Sem sinal da operadora"). Se o sinal cair no meio da fila, ela pausa e volta sozinha quando o sinal voltar.

Se uma permissão foi negada de vez, o botão vira "Abrir ajustes". **Ligar e a fila ficam travados até tudo estar liberado.**

Durante a ligação aparece uma notificação fixa (com Desligar). Ligação recebida com a tela apagada abre a tela de chamada direto.

## 4.2 Fila de teste e discagem automática

Cole vários números no cartão **Fila de teste** (um por linha) e toque em "Adicionar à fila". Com **Discagem automática** ligada, "Iniciar fila" liga para o primeiro; quando a ligação cai, a tela mostra "Próxima ligação em 3…" com **Pausar** e **Pular**, e o próximo número é discado sozinho. No fim aparece "Fila concluída" com o total, as atendidas e o tempo em ligação. Para parar tudo, **segure** "Encerrar sessão".

Proteções do chip: pelo menos 3 s entre ligações e no máximo 60 por hora (ao bater o limite, a fila pausa). A fila não disca se houver outra ligação em andamento ou chegando. Cada passo automático entra no registro (`AUTO_PROXIMA`, `PAUSADA`, `PULADA`, `RETOMADA`, `LIMITE_ATINGIDO`, `FILA_CONCLUIDA`, `SESSAO_ENCERRADA`), com o intervalo desde o fim da ligação anterior.

## 5. O que testar e mandar de volta

Faça **5 ligações**, uma de cada tipo. Antes de cada uma, toque no cenário em "O que você espera que aconteça?" (Atendida, Não atende, Caixa postal, Ocupado, Desliga na hora):

1. **atendida**: alguém atende, conversa uns segundos e você desliga;
2. **não atendida**: deixa tocar até cair sozinha, sem caixa postal;
3. **caixa postal**: liga para um número que cai na caixa postal;
4. **número ocupado**: liga para quem está em outra ligação (ou que recusa na hora);
5. **desligada pelo outro lado**: a pessoa atende e ela desliga primeiro.

Depois toque em **Enviar** e mande o registro para o Vinicios. Se der, diga também a operadora do chip e o modelo do celular (o registro já tenta incluir os dois).

O que queremos descobrir: em cada caso, **quando o `ACTIVE` aparece** (na hora do atendimento ou já enquanto chama?), e qual **causa** (`REMOTE`, `BUSY`, `MISSED`, `LOCAL`...) vem no `DISCONNECTED`.

## Limites conhecidos

- **Sem gravação nem transcrição.** Desde o Android 10, nenhum app de terceiros acessa o áudio da ligação, nem sendo o discador padrão.
- **`ACTIVE` pode não significar "atendeu".** Em algumas operadoras, a caixa postal ou o "chamando" já aparecem como `ACTIVE`. Por isso o teste. No sistema final, a palavra final é a classificação do corretor.
- O app não manda nada para a internet nem grava em disco. O registro some ao fechar o app pelo gerenciador de tarefas.
- Fora da Play Store: é um APK de teste, assinado com a chave de depuração.

## Estrutura

- `app/src/main/java/br/com/ancorasaude/callancora/MainActivity.kt`: tela da prova (número, discador padrão, ligar, registro).
- `CallService.kt`: `InCallService` que recebe as ligações e os estados.
- `CallBus.kt`: barramento em memória entre o serviço e as telas, e o formato do registro.
- `InCallActivity.kt`: tela de chamada mínima, aparece por cima da tela de bloqueio.
- `Timeline.kt` e `Labels.kt`: transformam o registro técnico na linha do tempo em português da tela. O texto de Copiar/Enviar continua o registro técnico.
- `Readiness.kt`: checklist do que o celular precisa liberar.
- `AutoDialer.kt`: sessão de ligações, contagem, pausa, limites do chip.
- `NumberSource.kt`: de onde vêm os números. Hoje `LocalQueueSource` (fila do celular); na etapa 2, `CrmQueueSource` pega o próximo número no CRM.
- `CallPlacer.kt`: único ponto que disca; recusa sem o papel de discador padrão.
- `CallNotifier.kt`: notificação fixa da ligação e tela cheia para ligação recebida.
- `CrmApi.kt`, `CrmSession.kt`, `CrmQueueSource.kt`, `CrmPanel.kt`, `DeviceStore.kt`: pareamento por QR, sessão do CRM e token criptografado.
- `AppFonts.kt`: baixa Plus Jakarta Sans e JetBrains Mono pelo Google Play Services (sem arquivo de fonte no APK). Sem Play Services, fica a fonte do sistema.

## Visual

Segue o AncoraHub Lite: azul-marinho `#002B73`, azul `#0B5ED7`, verde `#00B26B`, mascote e ícone do Call Âncora (`res/drawable-nodpi`, também usado no ícone do app). Só tema claro por enquanto.
