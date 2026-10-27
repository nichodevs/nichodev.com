# Nichodev Deluxe 65 Amp (VST3)

Amplificador virtual independente para guitarra, com interface 8-bit e processamento nativo para DAWs VST3. Ele complementa o Nichodev Guitar FX e pode ser usado sozinho ou depois dos pedais na cadeia da DAW.

## Modelo e canais

O timbre é inspirado em combos valvulados americanos de 22 W de meados dos anos 1960. O caminho de sinal combina saturação assimétrica de pré-amplificador, compressão de fonte de alimentação, estágio de potência macio, equalização e uma resposta de caixa C-12K-style de 12 polegadas. O perfil fixo representa duas válvulas 6V6 na potência e estágios 12AX7/12AT7 no pré-amplificador.

O seletor oferece dois canais:

- **Normal / Clean**: volume com saturação suave e resposta mais limpa.
- **Vibrato / Dirty**: maior ganho, duas etapas de saturação e acesso ao reverb de mola e ao vibrato de afinação.

Cada canal tem duas entradas selecionáveis. **Input I** usa o nível normal; **Input II** aplica aproximadamente -6 dB na entrada. Os quatro botões de canal/entrada são formados pelas duas seleções, como no painel do amplificador de referência.

## Controles

- **Normal Volume**: volume e saturação suave do canal Clean; em zero, silencia esse canal.
- **Vibrato Drive**: intensidade da saturação do canal Dirty.
- **Master**: volume de saída e intensidade de saturação do estágio de potência 6V6.
- **Bass, Middle e Treble**: controle tonal de três bandas.
- **Bright**: reforça a região de agudos.
- **Spring Reverb**: tanque algorítmico com reflexões e cauda; fica associado ao canal Vibrato.
- **Pitch Vibrato**: modulação de tempo de atraso, que altera a afinação do sinal. Não é tremolo de volume.
- **Vibrato Depth** e **Vibrato Rate**: profundidade e velocidade do vibrato, de 0,5 a 8 Hz.

Todos os controles e seletores são parâmetros do host, salvos no projeto da DAW e disponíveis para automação. O plugin aceita entrada mono ou estéreo e não recebe MIDI.

## Download e instalação

Use um pacote `NichodevVST3-*` de Windows ou Linux de um [release que anuncie a suite](https://github.com/nichodevs/nichodev.com/releases), contendo `Nichodev Deluxe 65 Amp.vst3` e `Nichodev Guitar FX.vst3`. O release v0.1.6 contém apenas o Guitar FX. Para testar builds ainda não publicados, obtenha os dois bundles nos artefatos de uma execução bem-sucedida da `main` no [workflow dos plugins](https://github.com/nichodevs/nichodev.com/actions/workflows/plugin.yml); os artefatos expiram após 14 dias. Extraia o arquivo e copie o bundle completo do Deluxe 65 Amp para uma pasta VST3 reconhecida pela DAW; não copie somente a pasta `Contents`. Depois, faça uma nova varredura de plugins.

## Limites do modelo

Este é um modelo DSP independente e inspirado em um amplificador clássico, não uma simulação circuito a circuito, uma medição de resposta de impulso ou uma emulação oficial. A marca Nichodev não é afiliada nem endossada pela Fender ou pela Jensen. O filtro de caixa aproxima a resposta de um alto-falante de 12 polegadas no estilo C-12K; não inclui um IR proprietário.
