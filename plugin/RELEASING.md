# Publicar o pacote de VST3

O workflow [Compilar plugin de áudio](../.github/workflows/plugin.yml) compila o Guitar FX e o Deluxe 65 Amp, executa os testes e envia um pacote Windows e outro Linux como artefatos do GitHub Actions. Em pushes para `main`, após os dois sistemas passarem, ele publica um GitHub Release para a versão do pacote com os dois ZIPs. PRs apenas compilam e testam. As proteções de publicação são exercitadas com arquivos fictícios no Linux: versão/notas inválidas, rascunho, release incompleto, tag órfã, bundle ausente e preservação de versões publicadas.

## Versões e notas

- `project(... VERSION ...)` em [`plugin/CMakeLists.txt`](CMakeLists.txt) identifica a versão do pacote e a tag `vX.Y.Z`.
- Cada chamada `juce_add_plugin(... VERSION ...)` identifica a versão individual do plugin. O Guitar FX e o Deluxe 65 Amp podem evoluir em ritmos diferentes.
- As notas ficam em `plugin/releases/vX.Y.Z.md`. O CI exige uma versão `X.Y.Z` válida e notas não vazias antes da compilação.
- O botão **DOWNLOAD VST** aponta para `/releases/latest`; cada release inclui os dois bundles para preservar ambos os downloads.

## Processo automático

1. Confirme que a mudança altera o DSP, os controles ou o bundle e justifica uma versão nova. Alterações apenas documentais ou de CI não precisam de binários com versões novas.
2. Aumente a versão do pacote em `project(... VERSION ...)` e as versões individuais dos plugins afetados em `juce_add_plugin(... VERSION ...)`.
3. Crie `plugin/releases/vX.Y.Z.md` no formato abaixo. Descreva somente mudanças presentes no código e validadas; não anuncie correção de áudio que os testes não cobrem.
4. Abra o PR e confira os builds e testes nos dois sistemas operacionais.
5. Integre a mudança em `main`. Após os dois builds e testes passarem novamente, o job **Publicar release VST3** baixa os artefatos dessa mesma execução, confere os dois bundles e a integridade dos ZIPs e cria `Nichodev VST3 Suite vX.Y.Z`, com a tag no commit compilado.
6. Abra o release e confirme os downloads `NichodevVST3-windows-latest.zip` e `NichodevVST3-ubuntu-latest.zip`. O link da página inicial acompanha `/releases/latest`; não é necessário enviar os bundles para a Hostinger.

O token tem escrita em conteúdo apenas no job de publicação da `main`. As publicações são serializadas. Se a versão já tiver release publicado com os dois ZIPs, o job termina sem substituir arquivos. Uma tag sem release, um rascunho ou um release sem os dois arquivos interrompe o job para conferência manual.

## Se a publicação falhar

Confira primeiro o log do job **Publicar release VST3**. Para uma falha temporária de rede ou permissão, corrija a causa e reexecute o job que falhou.

Se houver um rascunho ou tag parcial, confira seu commit antes de completar a publicação. Não substitua arquivos de uma versão já publicada: corrija a versão e as notas em um novo PR quando os binários precisarem mudar.

Os artefatos temporários são retidos por 14 dias. Para concluir manualmente um release, use os dois pacotes de uma execução bem-sucedida da `main` no mesmo commit, preservando os bundles completos `Nichodev Guitar FX.vst3` e `Nichodev Deluxe 65 Amp.vst3`. ZIPs antigos contendo apenas o Guitar FX não servem como pacote da suite.

## Modelo das notas

```text
Esta versão [corrige/adiciona/melhora] [resumo curto da mudança]:
- [Mudança funcional validada]
- [Outra mudança relevante, se houver]
- Inclui builds VST3 para Windows e Linux.
```
