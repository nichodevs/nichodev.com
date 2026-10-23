# Publicar uma versão do VST3

O workflow [Compilar plugin de áudio](../.github/workflows/plugin.yml) compila e testa o VST3 em Windows e Linux. Ele envia os bundles como artefatos da execução do GitHub Actions, com retenção de 14 dias; não cria nem publica um GitHub Release.

1. Atualize `project(... VERSION ...)` em `CMakeLists.txt` e confirme que o código e as notas da versão correspondem ao novo número.
2. Integre a alteração em `main` e aguarde uma execução bem-sucedida do workflow do plugin nos dois sistemas operacionais.
3. Na execução correspondente ao commit que será publicado, baixe os artefatos `NichodevGuitarFX-windows-latest` e `NichodevGuitarFX-ubuntu-latest`. Confira que cada pacote contém o bundle `Nichodev Guitar FX.vst3`.
4. Crie um GitHub Release com a tag `vX.Y.Z`, apontada para o commit validado, e anexe os arquivos com os nomes `NichodevGuitarFX-windows-latest.zip` e `NichodevGuitarFX-ubuntu-latest.zip`.
5. Abra a página do release e confirme que os dois ativos podem ser baixados. O site aponta para `/releases/latest`, então não é necessário publicar os binários do plugin na Hostinger.

O artefato temporário da Action pode ser usado para recuperar os bundles por até 14 dias. Depois desse prazo, faça uma nova execução bem-sucedida para gerar os arquivos novamente.
