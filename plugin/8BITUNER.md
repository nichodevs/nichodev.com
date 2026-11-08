# 8bituner

Afinador cromático de guitarra, em VST3 independente, com interface verde e tipografia pixelada. Funciona offline em DAWs VST3 de 64 bits, em Windows e Linux x86_64.

## Instalar e usar

1. Baixe o ZIP exclusivo para [Windows](https://github.com/nichodevs/nichodev.com/releases/latest/download/8bituner-windows-latest.zip) ou [Linux](https://github.com/nichodevs/nichodev.com/releases/latest/download/8bituner-ubuntu-latest.zip).
2. Extraia e copie o bundle completo `8bituner.vst3` para uma pasta VST3 reconhecida pela DAW, preservando a pasta `Contents`. Locais comuns: `C:\Program Files\Common Files\VST3` e `~/.vst3`.
3. Faça uma nova varredura e adicione **8bituner** à faixa de entrada da guitarra. Escolha a entrada na DAW e ative o processamento/monitoramento da faixa.
4. Posicione o afinador antes dos pedais e do amplificador. Toque uma corda por vez e aguarde a nota estabilizar.

## Controles e leitura

- Nota e oitava usam a notação científica: **E2** é o Mi grave da guitarra padrão.
- A frequência aparece em hertz; cents negativos pedem aumentar a afinação e positivos pedem diminuir.
- **AFINADO** aparece dentro de ±2 cents. Essa faixa visual não garante precisão de dois cents em gravações reais.
- **A4** ajusta a referência de Lá de 430 a 450 Hz; o padrão é 440 Hz.
- **SILENCIAR SAIDA** reduz a saída em 10 ms. O sinal de entrada continua sendo analisado. O bypass da DAW libera o áudio, mesmo quando o mute está salvo como ativo.
- Referência e mute aceitam automação e são salvos no projeto da DAW.
- O painel pode ser ampliado de 560 × 420 até 840 × 630, preservando a proporção.

## Processamento e limites

A detecção YIN analisa uma nota por vez entre **55 e 1.500 Hz**. Há filtragem e redução da taxa de amostragem apenas na análise; o áudio de saída permanece direto, sem alteração quando o mute está desligado e sem latência adicional declarada. A atualização visual depende de uma janela de sinal, portanto não é instantânea.

O canal com maior energia é usado em estéreo: a entrada somente à direita funciona e canais com fases invertidas não se cancelam por soma. A tarefa de áudio envia amostras por uma fila de memória fixa, sem esperar pela análise. Em sobrecarga, amostras da análise podem ser descartadas sem bloquear o áudio. Silêncio, ruído sem nota e interrupção de entrada limpam a leitura.

Os testes cobrem sinais sintéticos, desafinação, harmônicos com decaimento e ruído em diferentes taxas; o CI também carrega o VST3 real em um host JUCE, testa controles/estado/áudio e gera uma imagem do editor. Esses testes não substituem avaliação com guitarra física em interfaces de áudio e DAWs reais. Acordes, distorção intensa, captação ruidosa e sinais muito fracos podem dificultar a leitura.

O plugin tem identificador e bundle próprios; pode ser instalado sem Guitar FX e Deluxe 65 Amp. Não há pacote macOS nesta versão. Os termos JUCE e a licença da fonte são os mesmos da [suite](README.md#licenças).
