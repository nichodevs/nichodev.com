# Publicar uma versão do VST3

O workflow [Compilar plugin de áudio](../.github/workflows/plugin.yml) compila e testa o VST3 em Windows e Linux. Ele envia os bundles como artefatos da execução do GitHub Actions, com retenção de 14 dias; não cria nem publica um GitHub Release.

1. Confirme que a mudança altera o plugin e justifica uma nova versão. Alterações apenas em documentação ou CI não precisam gerar um release com binários idênticos.
2. Atualize `project(... VERSION ...)` em [`plugin/CMakeLists.txt`](CMakeLists.txt) e confirme que a versão corresponde à tag `vX.Y.Z` que será publicada.
3. Prepare as notas da versão no formato abaixo. Descreva somente mudanças presentes no código e validadas; não anuncie uma correção de áudio quando a mudança foi apenas em testes ou CI.
4. Integre a alteração em `main` e aguarde uma execução bem-sucedida do workflow do plugin nos dois sistemas operacionais. Anote o SHA do commit dessa execução.
5. Na execução do mesmo commit, baixe os artefatos `NichodevGuitarFX-windows-latest` e `NichodevGuitarFX-ubuntu-latest`. Confira que cada pacote contém o bundle `Nichodev Guitar FX.vst3`.
6. Crie um GitHub Release com o título `Nichodev Guitar FX vX.Y.Z` e a tag `vX.Y.Z` apontada para o commit validado. Use as notas revisadas e anexe `NichodevGuitarFX-windows-latest.zip` e `NichodevGuitarFX-ubuntu-latest.zip`.
7. Abra o release publicado e confirme que os dois ativos podem ser baixados. O site aponta para `/releases/latest`, então não é necessário publicar os binários do plugin na Hostinger.

## Modelo das notas

```text
Esta versão [corrige/adiciona/melhora] [resumo curto da mudança]:
- [Mudança funcional validada]
- [Outra mudança relevante, se houver]
- Inclui builds VST3 para Windows e Linux.
```

O artefato temporário da Action pode ser usado para recuperar os bundles por até 14 dias. Depois desse prazo, faça uma nova execução bem-sucedida para gerar os arquivos novamente.
