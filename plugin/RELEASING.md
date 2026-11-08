# Publicar o pacote de VST3

O workflow [Compilar plugin de áudio](../.github/workflows/plugin.yml) compila Guitar FX, Deluxe 65 Amp e 8bituner, executa os testes e envia um pacote Windows e outro Linux como artefatos do GitHub Actions. Em pushes para `main`, após os dois sistemas passarem, publica um GitHub Release com os dois ZIPs completos e dois ZIPs exclusivos do afinador. PRs apenas compilam e testam. As proteções são exercitadas no Linux: versão/notas inválidas, rascunho, release incompleto, tag órfã, bundle ou binário do afinador ausente e preservação de versões publicadas. O CI também carrega o VST3 do 8bituner em um host JUCE e guarda uma captura do editor nativo por sistema.

## Versões e notas

- `project(... VERSION ...)` em [`plugin/CMakeLists.txt`](CMakeLists.txt) identifica a versão do pacote e a tag `vX.Y.Z`.
- Cada chamada `juce_add_plugin(... VERSION ...)` identifica a versão individual do plugin. O Guitar FX e o Deluxe 65 Amp podem evoluir em ritmos diferentes.
- As notas ficam em `plugin/releases/vX.Y.Z.md`. O CI exige uma versão `X.Y.Z` válida e notas não vazias antes da compilação.
- O botão **DOWNLOAD VST** abre a [página de downloads](https://nichodev.com/downloads.html). Os botões de Windows/Linux usam `/releases/latest/download/` com os nomes fixos dos ZIPs; cada release deve manter esses nomes e incluir os três bundles. Os ZIPs `8bituner-windows-latest.zip` e `8bituner-ubuntu-latest.zip` contêm somente `8bituner.vst3`.

## Processo automático

1. Confirme que a mudança altera o DSP, os controles ou o bundle e justifica uma versão nova. Alterações apenas documentais ou de CI não precisam de binários com versões novas.
2. Aumente a versão do pacote em `project(... VERSION ...)` e as versões individuais dos plugins afetados em `juce_add_plugin(... VERSION ...)`.
3. Crie `plugin/releases/vX.Y.Z.md` no formato abaixo. Descreva somente mudanças presentes no código e validadas; não anuncie correção de áudio que os testes não cobrem.
4. Abra o PR e confira os builds e testes nos dois sistemas operacionais.
5. Integre a mudança em `main`. Após os dois builds e testes passarem novamente, o job **Publicar release VST3** baixa os artefatos dessa mesma execução, confere os três bundles, o binário nativo do afinador e a integridade dos quatro ZIPs e cria `Nichodev VST3 Suite vX.Y.Z`, com a tag no commit compilado.
6. Abra o release e confirme `NichodevVST3-windows-latest.zip`, `NichodevVST3-ubuntu-latest.zip`, `8bituner-windows-latest.zip` e `8bituner-ubuntu-latest.zip`. Os botões existentes acompanham `/releases/latest/download/`; não é necessário enviar os bundles para a Hostinger.

O token tem escrita em conteúdo apenas no job de publicação da `main`. As publicações são serializadas. Se a versão já tiver release publicado com os quatro ZIPs, o job termina sem substituir arquivos. Uma tag sem release, um rascunho ou um release incompleto interrompe o job para conferência manual.

## Se a publicação falhar

Confira primeiro o log do job **Publicar release VST3**. Para uma falha temporária de rede ou permissão, corrija a causa e reexecute o job que falhou.

Se houver um rascunho ou tag parcial, confira seu commit antes de completar a publicação. Não substitua arquivos de uma versão já publicada: corrija a versão e as notas em um novo PR quando os binários precisarem mudar.

Os artefatos temporários são retidos por 14 dias. Para concluir manualmente um release, use os dois pacotes de uma execução bem-sucedida da `main` no mesmo commit, preservando `Nichodev Guitar FX.vst3`, `Nichodev Deluxe 65 Amp.vst3` e `8bituner.vst3`. Os ZIPs exclusivos do afinador devem conter somente seu bundle completo. ZIPs de releases anteriores não servem como pacote desta versão.

## Modelo das notas

```text
Esta versão [corrige/adiciona/melhora] [resumo curto da mudança]:
- [Mudança funcional validada]
- [Outra mudança relevante, se houver]
- Inclui builds VST3 para Windows e Linux.
```
