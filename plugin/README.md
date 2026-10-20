# Nichodev Guitar FX (VST3)

Pedaleira nativa para o Guitar FX LAB, pensada para uso como efeito em um DAW. O plugin aceita áudio mono/estéreo, salva seus parâmetros no projeto e expõe os controles ao sistema de automação do host.

## Pedais e amp

A cadeia inclui os 15 efeitos do Guitar FX LAB: NS-2 (gate), CS-3 (compressor), BD-2 (overdrive), DS-1 (distortion), GE-7 (EQ), CH-1 (chorus), BF-3 (flanger), PH-3 (phaser), FZ-5 (fuzz), OCTAFUZZ, VB-2 (vibrato), TR-2 (tremolo), DD-8 (delay), RV-6 (reverb) e SHIMMER. Cada pedal tem liga/desliga, controle principal e posição reordenável. Inclui MASTER, AMP GAIN, AMP TONE, presets Clean Pixel, 8-Bit Blues, Arcade Crunch, Boss Battle e Space Delay, randomização e reset.

Os controles e o fluxo correspondem à pedaleira do site. A geração de áudio foi reimplementada em JUCE e usa aproximações nativas; por isso não é uma comparação idêntica amostra por amostra ao Web Audio do navegador. Afinador, entrada de microfone/dispositivo, gravação e importação de arquivos continuam sendo recursos específicos do site.

## Compilar com o JUCE que você baixou

Requisitos: CMake 3.22+, compilador C++17 e as dependências de interface/áudio do JUCE para o sistema operacional. Aponte `JUCE_LOCAL_PATH` para a pasta raiz extraída do JUCE:

```sh
cmake -S plugin -B build/plugin -DJUCE_LOCAL_PATH=/caminho/para/JUCE -DCMAKE_BUILD_TYPE=Release
cmake --build build/plugin --config Release --target NichodevGuitarFX_VST3
```

No PowerShell:

```powershell
cmake -S plugin -B build/plugin -DJUCE_LOCAL_PATH="C:/caminho/para/JUCE" -DCMAKE_BUILD_TYPE=Release
cmake --build build/plugin --config Release --target NichodevGuitarFX_VST3
```

Se `JUCE_LOCAL_PATH` for omitido, o CMake baixa JUCE 9.0.4. O bundle VST3 aparece em `build/plugin/NichodevGuitarFX_artefacts/Release/VST3/` (ou no diretório de configuração correspondente).

O plugin usa JUCE 9; confirme a licença aplicável antes de distribuir builds. Consulte a [licença JUCE 9](https://juce.com/legal/juce-9-licence/).
