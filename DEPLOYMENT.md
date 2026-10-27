# Publicação do site

O site é publicado na Hostinger pelo workflow [Publicar site na Hostinger](.github/workflows/deploy.yml). Este documento descreve quando ele roda e o que revisar ao adicionar arquivos ao site.

## Quando o deploy roda

- **Push para `main`:** quando a alteração inclui arquivos HTML ou CSS na raiz, `assets/**`, `js/**`, `onda/**`, `robots.txt` ou o próprio `.github/workflows/deploy.yml`.
- **Manual:** `workflow_dispatch` publica o branch escolhido na execução do GitHub Actions; selecione `main` para publicar a versão integrada.
- **Agendado:** uma publicação diária às 09:00 UTC (06:00 em Brasília).

Arquivos fora desses filtros, como o README da raiz, `plugin/**` e `tests/**`, não acionam o deploy por push. Documentação dentro de um caminho incluído, como `onda/README.md`, aciona o workflow. O workflow de validação do site é separado e pode rodar sem publicar.

As execuções compartilham o grupo `hostinger-production`: somente um envio pode escrever em `public_html` por vez. Uma execução já iniciada termina antes da próxima, evitando interrupção no meio do upload e sobrescrita por envios simultâneos.

## Validações e envio

O job de publicação depende de **Validar site**, chamado como workflow reutilizável no mesmo commit da execução. Ele instala as dependências do lockfile e executa `npm run check` e `npm run test:e2e`. Qualquer falha impede o job SFTP, inclusive em execuções manuais e agendadas. Os PRs usam esse mesmo workflow de validação; a publicação faz sua própria validação antes do envio, sem uma segunda execução independente por push.

Após a validação, o job SFTP confere os secrets de conexão e envia uma lista explícita de arquivos para a pasta pública do domínio. Depois, faz requisições HTTP às páginas e assets publicados.

Antes do primeiro arquivo, o cliente tenta criar as pastas e depois verifica cada destino com falhas fatais habilitadas. Isso permite reutilizar diretórios existentes sem esconder falhas de acesso ou de upload.

O envio e a lista de URLs verificadas estão em `deploy.yml`. A validação em `scripts/validate-site.js` compara os arquivos locais referenciados pelas páginas e CSS com os arquivos declarados no envio SFTP.

## Ao adicionar ou renomear arquivos do site

1. Adicione o arquivo à lista `put` do workflow, mantendo o destino com o mesmo caminho relativo.
2. Inclua o caminho nos filtros de `push.paths` se uma alteração nele precisar publicar imediatamente. O agendamento diário continuará cobrindo o site inteiro enviado pelo workflow.
3. Se criar uma página HTML nova, inclua-a na lista `pages` de `scripts/validate-site.js`; seus assets referenciados passam a ser verificados pela validação.
4. Inclua a URL nos checks HTTP pós-deploy do workflow.
5. Rode `npm run check` e `npm run test:e2e` antes de integrar a alteração.

O envio usa os secrets `HOSTINGER_HOST`, `HOSTINGER_USERNAME`, `HOSTINGER_PASSWORD` e `HOSTINGER_KNOWN_HOSTS`. Os bundles VST3 não são publicados na Hostinger; eles são anexados aos GitHub Releases.
