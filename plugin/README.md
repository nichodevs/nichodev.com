# Nichodev VST3 Suite

Pedaleira, amplificador e afinador nativos para DAWs de 64 bits com suporte a VST3, feitos com JUCE 9.0.4 e interface em 8 bits. Os pacotes publicados atendem Windows e Linux x86_64; a compatibilidade do build Linux depende da distribuição e da DAW. Ainda não há pacote para macOS.

| Plugin | Função |
| --- | --- |
| **Nichodev Guitar FX** | Cadeia reordenável de 15 pedais e controles de amplificador |
| **Nichodev Deluxe 65 Amp** | Amplificador independente com canais Normal/Clean e Vibrato/Dirty |
| **8bituner** | Afinador cromático independente para guitarra, com saída silenciável |

O [release v0.3.0](https://github.com/nichodevs/nichodev.com/releases/tag/v0.3.0) contém Guitar FX **0.1.8**, Deluxe 65 Amp **0.1.2** e 8bituner **0.1.0**, conforme [CMakeLists.txt](CMakeLists.txt). A versão do pacote é independente da versão de cada plugin; ao preparar um novo release, atualize esta referência.

Os três aceitam áudio mono ou estéreo, salvam o estado no projeto da DAW e expõem parâmetros para automação do host. Não recebem nem geram MIDI. O Deluxe pode ser usado sozinho ou depois do Guitar FX; os controles completos estão no [guia do amplificador](DELUXE_65.md). Instalar os VST3 não exige Node.js nem iniciar o site.

## Download e instalação

1. Abra a [página de downloads](https://nichodev.com/downloads.html) e escolha Windows ou Linux. Ela oferece os links diretos do release mais recente e instruções curtas para o Reaper ou outra DAW VST3. Os mesmos ZIPs estão em **Assets** do [release no GitHub](https://github.com/nichodevs/nichodev.com/releases/latest):

   | Sistema | Arquivo |
   | --- | --- |
   | Windows | `NichodevVST3-windows-latest.zip` |
   | Linux | `NichodevVST3-ubuntu-latest.zip` |

   Para instalar **somente o afinador**, baixe [8bituner para Windows](https://github.com/nichodevs/nichodev.com/releases/latest/download/8bituner-windows-latest.zip) ou [8bituner para Linux](https://github.com/nichodevs/nichodev.com/releases/latest/download/8bituner-ubuntu-latest.zip).

2. Extraia o ZIP. Os pacotes completos contêm `Nichodev Guitar FX.vst3`, `Nichodev Deluxe 65 Amp.vst3` e `8bituner.vst3`. Os ZIPs exclusivos do afinador contêm apenas `8bituner.vst3`.
3. Copie os bundles desejados para uma pasta VST3 reconhecida pela DAW:

   | Sistema | Pasta comum |
   | --- | --- |
   | Windows | `C:\Program Files\Common Files\VST3` |
   | Linux | `~/.vst3` |

   A pasta compartilhada do Windows pode exigir permissão de administrador. Preserve toda a estrutura de cada bundle, incluindo `Contents`; se escolher outra pasta, adicione-a à busca da DAW.
4. Remova cópias duplicadas das pastas verificadas pela DAW e faça uma nova varredura de plugins.

Releases antigos podem ter somente o Guitar FX. Para builds ainda não publicados, use os artefatos de uma execução bem-sucedida da `main` no [workflow dos plugins](https://github.com/nichodevs/nichodev.com/actions/workflows/plugin.yml); esses artefatos expiram após 14 dias. Os ZIPs anexados aos releases permanecem disponíveis.

Se o plugin não aparecer, ficar sem som ou gerar estalos, siga o [guia de instalação e diagnóstico](TROUBLESHOOTING.md).

## Guitar FX

A cadeia oferece NS-2 (gate), CS-3 (compressor), BD-2 (overdrive), DS-1 (distortion), GE-7 TILT, CH-1 (chorus), BF-3 (flanger), PH-3 (phaser), FZ-5 (fuzz), OCTAFUZZ, VB-2 (vibrato), TR-2 (tremolo), DD-8 (delay), RV-6 (reverb) e SHIMMER. **UP/DN** reordenam os pedais; a ordem é salva no estado do plugin.

O painel inclui **MASTER**, **AMP GAIN**, **AMP TONE**, **RANDOM**, **RESET** e cinco presets: Clean Pixel, 8-Bit Blues, Arcade Crunch, Boss Battle e Space Delay.

Os parâmetros contínuos e os estados dos pedais são suavizados em 20 ms. Os coeficientes de gate, compressor e filtros são preparados conforme a taxa de amostragem; o PH-3 usa uma tabela de coeficientes preparada fora do processamento de cada amostra.

Os buffers são alocados apenas para os efeitos temporais, conforme o maior atraso de cada um. Em bypass, avançam com entrada silenciosa para descartar áudio antigo sem alocação, bloqueio ou limpeza em lote no callback de áudio.

## Deluxe 65 Amp

O canal **Normal/Clean** oferece volume e saturação suave; **Vibrato/Dirty** tem maior ganho, reverb de mola e vibrato de afinação. Cada canal possui entradas I e II, com atenuação aproximada de 6 dB na segunda entrada.

A troca de canais usa uma transição suavizada de 20 ms. Nas posições extremas, somente a saturação do canal audível é calculada; durante a transição, ambos os caminhos são processados. Consulte [DELUXE_65.md](DELUXE_65.md) para os controles, o modelo DSP e seus limites.

## 8bituner

Afinador cromático monofônico de **55 a 1.500 Hz**, com referência de Lá entre 430 e 450 Hz e silenciamento de saída. Insira-o na faixa da guitarra, antes dos pedais e do amplificador, e toque uma corda por vez. Consulte o [guia do 8bituner](8BITUNER.md) para controles, funcionamento e limites.

## Som e limites

Os efeitos são aproximações DSP independentes e não oficiais. O Guitar FX LAB do navegador usa Web Audio e pode soar diferente do VST3. O GE-7 TILT oferece inclinação tonal, sem as sete bandas de um equalizador gráfico.

O Guitar FX não inclui afinador: use o 8bituner independente ou a ferramenta do [site](../README.md). Seleção de dispositivo, gravação e importação de arquivos são feitas pela DAW ou pelo site. O Guitar FX declara até 60 segundos de cauda para acomodar reverb seguido de alto ganho; hosts que usam esse metadado podem acrescentar esse tempo à renderização.

Os testes automatizados verificam regressões, mas a avaliação auditiva em DAWs e interfaces continua necessária.

## Compilar

Execute os comandos a partir da raiz do repositório. Requisitos: CMake 3.22 ou superior, compilador C++17 e dependências de áudio/interface do JUCE para seu sistema. A primeira configuração baixa JUCE 9.0.4 e precisa de internet. O [workflow do plugin](../.github/workflows/plugin.yml) lista as dependências Linux usadas no CI.

Para compilar os três VST3:

```sh
cmake -S plugin -B build/plugin -DCMAKE_BUILD_TYPE=Release
cmake --build build/plugin --config Release --target NichodevGuitarFX_VST3 NichodevDeluxe65_VST3 Nichodev8bituner_VST3
```

Para usar uma instalação local do JUCE, informe sua pasta raiz na configuração:

```powershell
cmake -S plugin -B build/plugin -DJUCE_LOCAL_PATH="C:/caminho/para/JUCE" -DCMAKE_BUILD_TYPE=Release
```

Os bundles ficam em:

- `build/plugin/NichodevGuitarFX_artefacts/Release/VST3/`
- `build/plugin/NichodevDeluxe65_artefacts/Release/VST3/`
- `build/plugin/Nichodev8bituner_artefacts/Release/VST3/`

A pasta de configuração pode variar conforme o gerador e a configuração escolhidos. O build não instala os plugins automaticamente na DAW.

## Testes automatizados

```sh
cmake --build build/plugin --config Release --target NichodevGuitarFXDSPTests NichodevGuitarFXProcessorTests NichodevDeluxe65DSPTests Nichodev8bitunerDSPTests Nichodev8bitunerHostTests
ctest --test-dir build/plugin --build-config Release --output-on-failure
```

No Linux, instale também `xvfb` para o teste que abre a interface nativa. As cinco suítes cobrem:

- **Guitar FX DSP:** presets, reordenação, cadeia Space Delay, ecos do DD-8/RV-6, bypass, isolamento dos canais, entradas inválidas, buffers, mistura gradual e bloqueio de DC. Comparam gate, compressor, EQ e PH-3 em 44,1, 48, 96 e 192 kHz e verificam o decaimento após a cauda declarada.
- **Processador Guitar FX:** aplicação de preset, parâmetros do host e resposta atrasada pelo `processBlock` real do JUCE, além da restauração de estado e ordem.
- **Deluxe DSP:** canais e sua transição, entradas atenuadas, estabilidade entre taxas, Clean em volume zero, continuidade do vibrato ao cruzar profundidade zero, variação de afinação e cauda do reverb.

- **8bituner DSP:** cordas padrão e desafinação em sete taxas de amostragem, harmônicos, ruído, sinais fracos, silêncio, DC, entradas inválidas, reset, notas e calibração.
- **8bituner host:** carrega o VST3 compilado, confere áudio direto e mute, entradas estéreo, automação, estado, bypass, reabertura mono e renderização do painel em `build/plugin/8bituner-preview.png`.

O [GitHub Actions](../.github/workflows/plugin.yml) compila os três plugins e executa essas suítes em Windows e Linux. No Linux, também testa as proteções do workflow de release com `python3 plugin/tests/release_workflow_tests.py`.

## Releases e versões

As versões da suite e de cada plugin são declaradas em [CMakeLists.txt](CMakeLists.txt). Em um push para `main` que altere `plugin/**` ou o workflow, com Markdown excluído dos gatilhos, os dois builds e testes precisam passar para a publicação automática. PRs apenas compilam e testam.

Um release já publicado com os dois ZIPs é preservado. Alterações apenas documentais mantêm as versões dos binários e não acionam os builds. Mudanças no código, assets, CMake ou no workflow continuam executando a validação nativa. O [guia de release](RELEASING.md) descreve versionamento, notas e recuperação de falhas.

## Licenças

A distribuição deve seguir os termos aplicáveis da [licença JUCE 9](https://juce.com/legal/juce-9-licence/). A fonte incluída está em `Assets/Pixel.ttf`, com licença em [Assets/OFL.txt](Assets/OFL.txt).

[Voltar ao README do repositório](../README.md)
