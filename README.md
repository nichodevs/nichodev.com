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
- `.github/workflows/`: validação de pull requests e publicação na Hostinger.
- Os arquivos HTML principais e seus estilos ficam na raiz para manter diretos os caminhos do site estático.

## Desenvolvimento e validação

Requer Node.js e npm.

```sh
npm install
npm run check
npm start
```

`npm start` inicia o servidor local Express na porta 3000 (ou na porta definida por `PORT`). O endpoint `/health` verifica o servidor.

## Publicação

O workflow `Publicar site na Hostinger` publica em pushes para `main`, pode ser iniciado manualmente e também roda diariamente às 06:00 no horário de Brasília. Cada execução valida o site, envia os arquivos por SFTP e confere os endereços publicados.
