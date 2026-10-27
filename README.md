# nichodev.com

Site estático com ferramentas de áudio para navegador e plugins VST3 para uso em DAWs.

## Ferramentas

- [Voice Studio](voz.html): processamento de voz e áudio no navegador.
- [Guitar FX LAB](guitarra.html): cadeia de efeitos para guitarra.
- [MIXMASTER](mixmaster.html): editor de áudio.
- [Onda sonora](onda/): página interativa acessada pelo ícone animado no rodapé.
- **Nichodev Guitar FX VST3**: cadeia nativa de 15 pedais para Windows e Linux.
- **Nichodev Deluxe 65 Amp VST3**: amplificador 8-bit inspirado em combos valvulados de 22 W, com canais Normal/Clean e Vibrato/Dirty, reverb de mola e vibrato de afinação.

O botão **DOWNLOAD VST** na página inicial abre a [página do release mais recente](https://github.com/nichodevs/nichodev.com/releases/latest). Os ZIPs da suite incluem os bundles completos do Guitar FX e do Deluxe 65 Amp, mas releases anteriores podem conter só o Guitar FX: o v0.1.6, por exemplo, não inclui o amplificador. Para o Deluxe, escolha um release que anuncie a suite ou os artefatos de uma execução bem-sucedida da `main` no [workflow dos plugins](https://github.com/nichodevs/nichodev.com/actions/workflows/plugin.yml). Esses artefatos são temporários e expiram após 14 dias. Para instalação e compilação, consulte [plugin/README.md](plugin/README.md) e o [guia do Deluxe 65 Amp](plugin/DELUXE_65.md); para diagnóstico no Reaper e em outras DAWs, veja o [guia de troubleshooting](plugin/TROUBLESHOOTING.md).

## Estrutura

- Páginas HTML e estilos principais na raiz.
- `js/`: lógica das ferramentas de áudio e navegação.
- `assets/cursors/`: cursores retrô.
- `onda/`: página, estilos e animação do easter egg.
- `plugin/`: projeto JUCE/CMake dos dois VST3, assets, testes DSP e testes do processador.
- `scripts/validate-site.js`: valida referências, sintaxe e cobertura dos arquivos do site.
- `tests/e2e/`: testes de navegação, responsividade e teclado com Playwright.
- `.github/workflows/`: validação do site, compilação/testes do plugin e publicação do site.

## Desenvolvimento do site

Requer Node.js 24 ou superior e npm.

```sh
npm ci
npm run check
npx playwright install chromium
npm run test:e2e
npm start
```

`npm ci` instala as versões registradas no `package-lock.json`. `npm run check` valida referências e arquivos do site. Os testes E2E abrem as páginas no Chromium e verificam navegação, largura em telas móveis, foco de teclado e a onda. Backups importados do MIXMASTER aceitam linhas do tempo de até 24 horas; a exportação WAV mantém o limite de dez minutos. Os testes também cobrem a importação de backups do MIXMASTER, a preservação dos envelopes de volume nas edições e o gate NS-2 em áudio renderizado com `OfflineAudioContext`. `npm start` inicia o servidor Express na porta 3000 (ou na porta definida por `PORT`); o endpoint `/health` verifica o servidor.

## VST3

A implementação nativa e suas instruções estão em [plugin/README.md](plugin/README.md). O GitHub Actions compila o Guitar FX e o Deluxe 65 Amp para Windows e Linux e executa os testes DSP e de integração quando há alterações no plugin.

## Publicação

- **Releases do VST3:** os ZIPs anexados a um GitHub Release são os downloads permanentes; o botão do site aponta para o release mais recente. Após os dois builds e testes passarem em um push para `main`, o workflow publica automaticamente um release para a versão do pacote, com os dois ZIPs e notas correspondentes. Versões já publicadas são preservadas. Os artefatos das Actions continuam temporários, retidos por 14 dias. Consulte o [processo de release do plugin](plugin/RELEASING.md).
- **Site:** o workflow `Publicar site na Hostinger` publica por SFTP em pushes para `main` que alterem páginas HTML/CSS da raiz, `assets/`, `js/`, `onda/`, `robots.txt` ou o próprio workflow de deploy; também pode ser iniciado manualmente e roda diariamente às 09:00 UTC (06:00 em Brasília). Ele executa `npm run check` e uma verificação HTTP após o envio, mas não roda os testes E2E. Veja os [detalhes do deploy](DEPLOYMENT.md), inclusive os arquivos que precisam ser atualizados quando uma página ou asset novo for adicionado. As builds do plugin são distribuídas nos releases do GitHub.
