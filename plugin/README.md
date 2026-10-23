# Nichodev Guitar FX (VST3)

Plugin nativo de efeitos para guitarra, feito com JUCE 9.0.4 e destinado a DAWs compatíveis com VST3. Aceita áudio mono ou estéreo, salva o estado no projeto da DAW e expõe os parâmetros ao sistema de automação do host. Não recebe nem gera MIDI.

## Recursos

A cadeia tem 15 efeitos: NS-2 (gate), CS-3 (compressor), BD-2 (overdrive), DS-1 (distortion), GE-7 TILT, CH-1 (chorus), BF-3 (flanger), PH-3 (phaser), FZ-5 (fuzz), OCTAFUZZ, VB-2 (vibrato), TR-2 (tremolo), DD-8 (delay), RV-6 (reverb) e SHIMMER. UP/DN movem cada pedal na cadeia; a ordem é salva junto com o estado do plugin.

Também inclui controles MASTER, AMP GAIN e AMP TONE, cinco presets (Clean Pixel, 8-Bit Blues, Arcade Crunch, Boss Battle e Space Delay), RANDOM e RESET. Os controles contínuos e os estados liga/desliga dos pedais são suavizados em 20 ms para reduzir estalos ao ajustar parâmetros, automatizar controles ou trocar de preset. Os buffers de atraso são alocados apenas para os efeitos que os utilizam; quando um pedal temporal fica em bypass, seu estado avança com entrada silenciosa para não congelar áudio antigo no buffer.

## Som e limitações

Os efeitos são aproximações nativas, não emulações oficiais nem uma correspondência idêntica ao processamento Web Audio do Guitar FX LAB. O GE-7 TILT oferece um controle de inclinação tonal; não é um equalizador gráfico de sete bandas. Afinador, seleção de microfone/dispositivo, gravação e importação de arquivos são recursos do site, não deste plugin.

## Download e instalação

Baixe o arquivo para seu sistema na [página do release mais recente](https://github.com/nichodevs/nichodev.com/releases/latest), na seção **Assets**. Extraia o arquivo e copie o bundle `.vst3` para uma pasta VST3 reconhecida pela DAW. No Windows, a pasta comum é `C:\Program Files\Common Files\VST3`; no Linux, use `~/.vst3` ou a pasta VST3 do sistema. Depois, solicite à DAW uma nova varredura de plugins.

## Compilar

Requisitos: CMake 3.22 ou superior, compilador C++17 e dependências de áudio/interface do JUCE para o sistema operacional. O workflow [plugin.yml](../.github/workflows/plugin.yml) mostra as dependências usadas no Ubuntu CI.

Com JUCE já baixado, aponte `JUCE_LOCAL_PATH` para a pasta raiz:

```sh
cmake -S plugin -B build/plugin -DJUCE_LOCAL_PATH=/caminho/para/JUCE -DCMAKE_BUILD_TYPE=Release
cmake --build build/plugin --config Release --target NichodevGuitarFX_VST3
```

No PowerShell:

```powershell
cmake -S plugin -B build/plugin -DJUCE_LOCAL_PATH="C:/caminho/para/JUCE" -DCMAKE_BUILD_TYPE=Release
cmake --build build/plugin --config Release --target NichodevGuitarFX_VST3
```

Sem `JUCE_LOCAL_PATH`, o CMake baixa JUCE 9.0.4. O bundle gerado fica em `build/plugin/NichodevGuitarFX_artefacts/Release/VST3/` (ou na pasta de configuração correspondente).

## Testes DSP

Os testes unitários cobrem a reordenação de pedais, a configuração do preset Space Delay, ecos de impulso do DD-8/RV-6, drenagem de buffers em bypass, limites dos buffers, mistura gradual entre sinal seco e processado e bloqueio de DC. Para executá-los:

```sh
cmake --build build/plugin --config Release --target NichodevGuitarFXDSPTests
ctest --test-dir build/plugin --build-config Release --output-on-failure
```

O GitHub Actions compila o plugin e executa esses testes em Windows e Linux. Os testes são verificações determinísticas dos utilitários DSP; não substituem a avaliação auditiva do plugin em diferentes DAWs e taxas de amostragem.

## Licenças

A distribuição do plugin deve seguir os termos aplicáveis da [licença JUCE 9](https://juce.com/legal/juce-9-licence/). A fonte tipográfica incluída está em `Assets/Pixel.ttf`; seu texto de licença está em `Assets/OFL.txt`.
