# Publicar o pacote de VST3

O workflow [Compilar plugin de áudio](../.github/workflows/plugin.yml) compila o Guitar FX e o Deluxe 65 Amp, executa os testes e envia um pacote Windows e outro Linux como artefatos do GitHub Actions. Os artefatos expiram após 14 dias; o workflow não publica o GitHub Release.

## Versões

- `project(... VERSION ...)` em [`plugin/CMakeLists.txt`](CMakeLists.txt) identifica a versão do pacote distribuído.
- Cada chamada `juce_add_plugin(... VERSION ...)` identifica a versão individual do plugin. O Guitar FX e o Deluxe 65 Amp podem evoluir em ritmos diferentes.
- O botão **DOWNLOAD VST** aponta para `/releases/latest`; por isso, cada release deve incluir os dois bundles para preservar ambos os downloads.

## Processo

1. Confirme que a mudança altera o DSP, os controles ou o bundle e justifica uma versão nova. Alterações apenas documentais ou de CI não precisam de release com binários idênticos.
2. Atualize a versão do pacote em `project(... VERSION ...)` e as versões individuais dos plugins afetados em `juce_add_plugin(... VERSION ...)`.
3. Prepare as notas no formato abaixo. Descreva somente mudanças presentes no código e validadas; não anuncie correção de áudio que os testes não cobrem.
4. Integre a mudança em `main` e aguarde uma execução bem-sucedida do workflow nos dois sistemas operacionais. Registre o SHA do commit validado.
5. Baixe os artefatos `NichodevVST3-windows-latest` e `NichodevVST3-ubuntu-latest` da execução desse mesmo commit. Confira que cada pacote contém os bundles completos `Nichodev Guitar FX.vst3` e `Nichodev Deluxe 65 Amp.vst3`, com as versões individuais declaradas no CMake. ZIPs de releases antigos que só incluíam o Guitar FX não servem como pacote da suite.
6. Crie o GitHub Release com o título `Nichodev VST3 Suite vX.Y.Z` e a tag `vX.Y.Z` apontada para o commit validado. Anexe `NichodevVST3-windows-latest.zip` e `NichodevVST3-ubuntu-latest.zip` e use as notas revisadas.
7. Abra o release publicado e confirme que os dois arquivos podem ser baixados. A página inicial aponta para `/releases/latest`, então não é preciso publicar os bundles na Hostinger.

## Modelo das notas

```text
Esta versão [corrige/adiciona/melhora] [resumo curto da mudança]:
- [Mudança funcional validada]
- [Outra mudança relevante, se houver]
- Inclui builds VST3 para Windows e Linux.
```

O pacote pode ser recuperado dos artefatos temporários por até 14 dias. Depois desse prazo, execute novamente o workflow com um commit validado para gerar os arquivos.
