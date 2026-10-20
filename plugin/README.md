# Nichodev Guitar FX (VST3)

Primeira versão nativa do Guitar FX LAB para uso como efeito em um DAW. O plugin recebe o áudio da faixa e oferece Drive, Tone, Mix e Output. Os parâmetros podem ser automatizados pelo host e são salvos com o projeto.

## Compilar

Requisitos: CMake 3.22+, compilador C++17 e as dependências de interface/áudio do JUCE para o sistema operacional. O CMake baixa JUCE 9.0.4 durante a configuração.

```sh
cmake -S plugin -B build/plugin -DCMAKE_BUILD_TYPE=Release
cmake --build build/plugin --config Release --target NichodevGuitarFX_VST3
```

O bundle VST3 aparece em `build/plugin/NichodevGuitarFX_artefacts/Release/VST3/` (ou no diretório de configuração correspondente).

## Escopo desta primeira versão

- Efeito de áudio mono/estéreo para guitarra.
- Saturação soft-clip com controle de Drive.
- Filtro de Tone, controle paralelo Mix e nível de saída.
- Parâmetros automáveis e estado persistido no projeto do DAW.
- Interface nativa JUCE com identidade visual arcade do nichodev.com.

O Guitar FX LAB do navegador tem uma pedaleira maior, afinador, gravação e presets. Esses recursos ainda precisam ser portados e serão adicionados em etapas posteriores. O plugin usa JUCE 9, cuja licença deve ser escolhida e observada antes de distribuir builds. Consulte a [licença JUCE 9](https://juce.com/legal/juce-9-licence/).
