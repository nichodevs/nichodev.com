# Instalação e diagnóstico do VST3

Este guia ajuda a confirmar a instalação do Nichodev Guitar FX e a reunir informações úteis quando uma DAW não detecta o plugin, não produz áudio ou apresenta estalos. Os nomes dos menus variam entre versões da DAW.

## Instalar ou atualizar

1. Baixe o ZIP de Windows ou Linux na [página do release mais recente](https://github.com/nichodevs/nichodev.com/releases/latest). Use os arquivos em **Assets** para uma instalação permanente; artefatos baixados de uma execução do GitHub Actions expiram após 14 dias.
2. Feche a DAW, extraia o ZIP e copie o bundle completo `Nichodev Guitar FX.vst3` para uma pasta VST3 reconhecida. Preserve a estrutura interna do bundle; não copie apenas `Contents`.
3. No Windows, a pasta compartilhada comum é `C:\Program Files\Common Files\VST3`, que pode exigir permissão de administrador. No Linux, a pasta de usuário comum é `~/.vst3`. Também é possível usar outra pasta gravável, desde que esteja configurada na busca de plugins da DAW.
4. Evite cópias antigas em outras pastas VST3 que a DAW também verifica. Reabra a DAW e faça uma nova varredura dos plugins. Se o VST3 não aparecer, confira as pastas configuradas e solicite uma varredura completa.

## Sem áudio ou Space Delay sem efeito

1. Confirme que há sinal na entrada da track ou no item de áudio e que a track não está muda. Confira também o medidor de saída da track e da DAW.
2. Verifique se o efeito está habilitado na cadeia da DAW e se não há outro plugin, roteamento ou controle de volume interrompendo o sinal.
3. Para isolar o Noise Suppressor, desligue temporariamente o pedal **NS-2** no plugin. Se o sinal voltar, o gate estava fechando para o nível recebido; ajuste o limiar e o nível de entrada antes de reativá-lo.
4. Para testar o preset **Space Delay**, selecione-o novamente e confirme visualmente que **DD-8** e **RV-6** estão ligados e com seus níveis acima de zero. Confira que o NS-2 não está cortando as notas suaves.
5. Compare a reprodução com o plugin habilitado e em bypass. Se o sinal some apenas com o plugin ligado, registre o preset, os pedais ativos e os níveis usados.
6. Salve uma cópia do projeto antes de alterar a cadeia ou os parâmetros, para poder voltar ao estado original.

## Estalos ou interrupções

1. Compare o resultado com a cadeia de efeitos desabilitada e, depois, com apenas uma instância do Nichodev Guitar FX ativa.
2. Anote a taxa de amostragem, o tamanho do buffer, o driver de áudio e o uso de CPU durante a reprodução. Mudar o buffer pode ajudar a diagnosticar a configuração de áudio, mas não identifica sozinho a causa.
3. Faça uma comparação controlada com valores diferentes de buffer e mantenha o mesmo trecho, preset e cadeia. Registre se os estalos mudam, desaparecem ou permanecem.
4. Se os estalos persistirem com o plugin ativo e sumirem em bypass, registre os dados abaixo. Esse resultado indica que o efeito está relacionado à cadeia do plugin e ajuda a reproduzir o caso; não prova sozinho a causa.

## Informações para reproduzir o problema

Ao relatar uma falha, inclua:

- sistema operacional e versão da DAW;
- versão do release instalada e caminho da pasta VST3 que a DAW está verificando;
- driver de áudio, taxa de amostragem e tamanho do buffer;
- preset selecionado, estado do NS-2, DD-8 e RV-6, e níveis de entrada/saída;
- se há sinal no medidor antes do plugin e se o problema muda ao colocar o plugin em bypass;
- passos exatos para reproduzir a falha e se ela ocorre também em um projeto novo.

## Limite dos testes automatizados

Os testes do repositório validam DSP e o caminho `applyPreset` → parâmetros → `processBlock`, mas não clicam na interface, não abrem o bundle em uma DAW e não verificam drivers ou buffers de áudio reais. Uma execução bem-sucedida do CI não substitui esse teste manual no host usado para tocar.
