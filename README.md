# nichodev.com

Site estático com ferramentas de áudio que funcionam no navegador.

## Páginas

- `index.html`: página inicial e atalhos.
- `voz.html`: Voice Studio.
- `guitarra.html`: Guitar FX LAB.
- `mixmaster.html`: editor MIXMASTER.
- `onda/index.html`: página interativa do easter egg da onda.

## Organização

- `js/`: lógica dos estúdios e navegação.
- `assets/cursors/`: imagens dos cursores retrô.
- `onda/`: página, estilos e animação do easter egg.
- `scripts/validate-site.js`: valida referências, sintaxe e cobertura do deploy.
- `tests/e2e/`: testes de navegação, responsividade e teclado com Playwright.
- `.github/workflows/`: validação de pull requests e publicação na Hostinger.
- Os arquivos HTML principais e seus estilos ficam na raiz para manter diretos os caminhos do site estático.

## Desenvolvimento e validação

Requer Node.js 22 ou superior e npm.

```sh
npm ci
npm run check
npx playwright install chromium
npm run test:e2e
npm start
```

`npm ci` instala as versões registradas no `package-lock.json`. `npm run check` valida referências e arquivos do deploy. Os testes E2E abrem as cinco páginas no Chromium, verificam os atalhos da página inicial, a largura em telas móveis, foco de teclado e interação da onda. `npm start` inicia o servidor Express na porta 3000 (ou na porta definida por `PORT`); o endpoint `/health` verifica o servidor.

## Publicação

O workflow `Publicar site na Hostinger` publica em pushes para `main`, pode ser iniciado manualmente e também roda diariamente às 06:00 no horário de Brasília. Cada execução valida o site, envia os arquivos por SFTP e confere os endereços publicados.
