# Nichodev Guitar FX (VST3)

Primeira versão nativa do Guitar FX LAB para uso como efeito em um DAW. O plugin recebe o áudio da faixa e oferece Drive, Tone, Mix e Output. Os parâmetros podem ser automatizados pelo host e são salvos com o projeto.

## Compilar com o JUCE que você baixou

Requisitos: CMake 3.22+, compilador C++17 e as dependências de interface/áudio do JUCE para o sistema operacional. Aponte `JUCE_LOCAL_PATH` para a pasta raiz extraída do JUCE:

```sh
cmake -S plugin -B build/plugin -DJUCE_LOCAL_PATH=/caminho/para/JUCE -DCMAKE_BUILD_TYPE=Release
cmake --build build/plugin --config Release --target NichodevGuitarFX_VST3
```

No PowerShell, por exemplo:

```powershell
cmake -S plugin -B build/plugin -DJUCE_LOCAL_PATH="C:/caminho/para/JUCE" -DCMAKE_BUILD_TYPE=Release
cmake --build build/plugin --config Release --target NichodevGuitarFX_VST3
```

Se `JUCE_LOCAL_PATH` for omitido, o CMake baixa JUCE 9.0.4. O bundle VST3 aparece em `build/plugin/NichodevGuitarFX_artefacts/Release/VST3/` (ou no diretório de configuração correspondente).

## Escopo desta primeira versão

- Efeito de áudio mono/estéreo para guitarra.
- Saturação soft-clip com controle de Drive.
- Filtro de Tone, controle paralelo Mix e nível de saída.
- Parâmetros automáveis e estado persistido no projeto do DAW.
- Interface nativa JUCE com identidade visual arcade do nichodev.com.

O Guitar FX LAB do navegador tem uma pedaleira maior, afinador, gravação e presets. Esses recursos ainda precisam ser portados e serão adicionados em etapas posteriores. O plugin usa JUCE 9; confirme a licença aplicável antes de distribuir builds. Consulte a [licença JUCE 9](https://juce.com/legal/juce-9-licence/).
