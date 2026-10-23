# nichodev.com

Site estático com ferramentas de áudio para navegador e um plugin VST3 para uso em DAWs.

## Ferramentas

- [Voice Studio](voz.html): processamento de voz e áudio no navegador.
- [Guitar FX LAB](guitarra.html): cadeia de efeitos para guitarra.
- [MIXMASTER](mixmaster.html): editor de áudio.
- [Onda sonora](onda/): página interativa acessada pelo ícone animado no rodapé.
- **Nichodev Guitar FX VST3**: versão nativa da pedaleira para Windows e Linux.

O botão **DOWNLOAD VST** na página inicial abre a [página do release mais recente](https://github.com/nichodevs/nichodev.com/releases/latest). Os arquivos de instalação estão em **Assets**. Para detalhes, instalação e compilação, consulte [plugin/README.md](plugin/README.md).

## Estrutura

- Páginas HTML e estilos principais na raiz.
- `js/`: lógica das ferramentas de áudio e navegação.
- `assets/cursors/`: cursores retrô.
- `onda/`: página, estilos e animação do easter egg.
- `plugin/`: projeto JUCE/CMake do VST3, assets, testes DSP e testes do processador.
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

`npm ci` instala as versões registradas no `package-lock.json`. `npm run check` valida referências e arquivos do site. Os testes E2E abrem as páginas no Chromium e verificam os atalhos da inicial, a largura em telas móveis, o foco de teclado e a interação da onda. `npm start` inicia o servidor Express na porta 3000 (ou na porta definida por `PORT`); o endpoint `/health` verifica o servidor.

## VST3

A implementação nativa e suas instruções estão em [plugin/README.md](plugin/README.md). O GitHub Actions compila o VST3 para Windows e Linux e executa os testes DSP e de integração do processador quando há alterações no plugin.

## Publicação

- **Releases do VST3:** os ZIPs anexados a um GitHub Release são os downloads permanentes; o botão do site aponta para o release mais recente. O workflow de build gera artefatos temporários, retidos por 14 dias, mas não cria o release. Consulte o [processo de release do plugin](plugin/RELEASING.md).
- **Site:** o workflow `Publicar site na Hostinger` roda no GitHub Actions quando arquivos do site mudam em pushes para `main`, manualmente ou diariamente às 09:00 UTC (06:00 em Brasília). Ele valida o site e publica por SFTP na Hostinger usando os secrets `HOSTINGER_HOST`, `HOSTINGER_USERNAME`, `HOSTINGER_PASSWORD` e `HOSTINGER_KNOWN_HOSTS`. Esse workflow publica o site; as builds do plugin são distribuídas nos releases do GitHub.
