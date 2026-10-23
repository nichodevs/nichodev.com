# Nichodev Guitar FX (VST3)

Plugin nativo de efeitos para guitarra, feito com JUCE 9.0.4 e destinado a DAWs compatíveis com VST3. Aceita áudio mono ou estéreo, salva o estado no projeto da DAW e expõe os parâmetros ao sistema de automação do host. Não recebe nem gera MIDI.

O pacote também compila o amplificador independente [Nichodev Deluxe 65 Amp](DELUXE_65.md), com interface 8-bit, dois canais, reverb de mola e vibrato de afinação.

## Recursos

A cadeia tem 15 efeitos: NS-2 (gate), CS-3 (compressor), BD-2 (overdrive), DS-1 (distortion), GE-7 TILT, CH-1 (chorus), BF-3 (flanger), PH-3 (phaser), FZ-5 (fuzz), OCTAFUZZ, VB-2 (vibrato), TR-2 (tremolo), DD-8 (delay), RV-6 (reverb) e SHIMMER. UP/DN movem cada pedal na cadeia; a ordem é salva junto com o estado do plugin.

Também inclui controles MASTER, AMP GAIN e AMP TONE, cinco presets (Clean Pixel, 8-Bit Blues, Arcade Crunch, Boss Battle e Space Delay), RANDOM e RESET. Os controles contínuos e os estados liga/desliga dos pedais são suavizados em 20 ms para reduzir estalos ao ajustar parâmetros, automatizar controles ou trocar de preset. Os buffers de atraso são alocados apenas para os efeitos temporais e dimensionados pelo maior atraso de cada efeito; em bypass, avançam com entrada silenciosa para descartar áudio antigo sem alocação, bloqueio ou limpeza em lote no callback de áudio.

## Som e limitações

Os efeitos são aproximações nativas, não emulações oficiais nem uma correspondência idêntica ao processamento Web Audio do Guitar FX LAB. O GE-7 TILT oferece um controle de inclinação tonal; não é um equalizador gráfico de sete bandas. Afinador, seleção de microfone/dispositivo, gravação e importação de arquivos são recursos do site, não deste plugin.

## Download e instalação

Baixe o ZIP para seu sistema na [página do release mais recente](https://github.com/nichodevs/nichodev.com/releases/latest), na seção **Assets**. O pacote contém os bundles completos `Nichodev Guitar FX.vst3` e `Nichodev Deluxe 65 Amp.vst3`; copie os plugins que quiser usar para uma pasta VST3 reconhecida pela DAW. Não copie apenas a pasta `Contents` de dentro de um bundle. No Windows, a pasta compartilhada comum é `C:\Program Files\Common Files\VST3` e pode exigir permissão de administrador. No Linux, use `~/.vst3` ou a pasta VST3 do sistema. Se usar outra pasta, adicione-a à lista de busca da DAW. Após instalar, solicite uma nova varredura de plugins. Para evitar carregar uma versão antiga, remova cópias duplicadas das pastas que a DAW verifica.

Se o plugin não aparecer, não produzir áudio ou gerar estalos, siga o [guia de instalação e diagnóstico](TROUBLESHOOTING.md).

Os artefatos baixados diretamente de uma execução do GitHub Actions são temporários e expiram após 14 dias. O workflow de build não publica um GitHub Release; os downloads permanentes dos dois VST3 ficam anexados à versão do conjunto. Veja o [processo de release](RELEASING.md).

## Compilar

Requisitos: CMake 3.22 ou superior, compilador C++17 e as dependências de áudio/interface do JUCE para o sistema operacional. Na primeira configuração, o CMake baixa JUCE 9.0.4 do GitHub, portanto precisa de acesso à internet. O workflow [plugin.yml](../.github/workflows/plugin.yml) mostra as dependências Linux usadas no CI.

O caminho mais curto é deixar o CMake obter o JUCE automaticamente. Para compilar os dois VST3:

```sh
cmake -S plugin -B build/plugin -DCMAKE_BUILD_TYPE=Release
cmake --build build/plugin --config Release --target NichodevGuitarFX_VST3 NichodevDeluxe65_VST3
```

Se já tiver o JUCE no computador ou quiser usar uma cópia local, informe a pasta raiz com `JUCE_LOCAL_PATH`:

```powershell
cmake -S plugin -B build/plugin -DJUCE_LOCAL_PATH="C:/caminho/para/JUCE" -DCMAKE_BUILD_TYPE=Release
cmake --build build/plugin --config Release --target NichodevGuitarFX_VST3 NichodevDeluxe65_VST3
```

Os bundles ficam em `build/plugin/NichodevGuitarFX_artefacts/Release/VST3/` e `build/plugin/NichodevDeluxe65_artefacts/Release/VST3/` (ou nas pastas de configuração correspondentes). Os detalhes de timbre e controles do amplificador estão no [guia Deluxe 65](DELUXE_65.md).

## Testes automatizados

Os testes DSP cobrem a reordenação de pedais, os valores dos cinco presets, a cadeia completa do Space Delay e os ecos do DD-8/RV-6, drenagem de buffers em bypass, isolamento entre canais, controles inválidos, limites dos buffers, mistura gradual entre sinal seco e processado e bloqueio de DC. O teste do processador cria a classe JUCE real, aplica `space`, confere os parâmetros e verifica a resposta atrasada através de `processBlock`. Para executá-los:

```sh
cmake --build build/plugin --config Release --target NichodevGuitarFXDSPTests NichodevGuitarFXProcessorTests NichodevDeluxe65DSPTests
ctest --test-dir build/plugin --build-config Release --output-on-failure
```

O GitHub Actions compila os dois plugins e executa os testes DSP e de integração em Windows e Linux. O teste do Guitar FX cobre `applyPreset` → parâmetros → `processBlock`; os testes do Deluxe Amp exercitam os dois canais, entradas atenuadas, estabilidade em diferentes taxas, cauda do reverb e variação de pitch. Os testes automatizados não substituem a avaliação auditiva em diferentes DAWs e interfaces. Para uma verificação manual organizada do Guitar FX, use o [guia de troubleshooting](TROUBLESHOOTING.md).

## Licenças

A distribuição do plugin deve seguir os termos aplicáveis da [licença JUCE 9](https://juce.com/legal/juce-9-licence/). A fonte tipográfica incluída está em `Assets/Pixel.ttf`; seu texto de licença está em `Assets/OFL.txt`.
