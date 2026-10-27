# Publicação do site

O site é publicado na Hostinger pelo workflow [Publicar site na Hostinger](.github/workflows/deploy.yml). Este documento descreve quando ele roda e o que revisar ao adicionar arquivos ao site.

## Quando o deploy roda

- **Push para `main`:** quando a alteração inclui arquivos de `public/**` ou o próprio `.github/workflows/deploy.yml`. Arquivos Markdown são excluídos desse gatilho.
- **Manual:** `workflow_dispatch` publica o branch escolhido na execução do GitHub Actions; selecione `main` para publicar a versão integrada.
- **Agendado:** uma publicação diária às 09:00 UTC (06:00 em Brasília).

Documentação, `plugin/**` e `tests/**` não acionam o deploy por push. Isso inclui o README de `public/onda/`. O workflow de validação do site é separado e pode rodar sem publicar.

As execuções compartilham o grupo `hostinger-production`: somente um envio pode escrever em `public_html` por vez. Uma execução já iniciada termina antes da próxima, evitando interrupção no meio do upload e sobrescrita por envios simultâneos.

## Validações e envio

O job de publicação depende de **Validar site**, chamado como workflow reutilizável no mesmo commit da execução. Ele instala as dependências do lockfile e executa `npm test`, `npm run check` e `npm run test:e2e`. Qualquer falha impede o job SFTP, inclusive em execuções manuais e agendadas. Os PRs usam esse mesmo workflow de validação; a publicação faz sua própria validação antes do envio, sem uma segunda execução independente por push.

Após a validação, o job SFTP confere os secrets de conexão e envia uma lista explícita de arquivos de `public/` para a pasta pública do domínio. O prefixo `public/` existe apenas no repositório: `public/voz.html` é enviado como `voz.html`, preservando `/voz.html` e as demais URLs. Depois, faz requisições HTTP às páginas e assets publicados.

Antes do primeiro arquivo, o cliente tenta criar as pastas e depois verifica cada destino com falhas fatais habilitadas. Isso permite reutilizar diretórios existentes sem esconder falhas de acesso ou de upload.

O envio e a lista de URLs verificadas estão em `deploy.yml`. A validação em `scripts/validate-site.js` lê as páginas e CSS em `public/` e segue imports relativos estáticos ou dinâmicos com caminho literal e compara as fontes locais com os destinos declarados no envio SFTP.

## Ao adicionar ou renomear arquivos do site

1. Crie o arquivo dentro de `public/` e adicione-o à lista `put` do workflow. A origem inclui `public/`; o destino usa o caminho relativo dentro dessa pasta.
2. Os arquivos de `public/**` já são cobertos pelo filtro de push, com Markdown excluído. O agendamento diário e a execução manual continuam publicando a lista completa de arquivos do site.
3. Se criar uma página HTML nova, inclua seu caminho relativo a `public/` na lista `pages` de `scripts/validate-site.js`; seus assets referenciados passam a ser verificados pela validação.
4. Inclua a URL nos checks HTTP pós-deploy do workflow.
5. Ao alterar módulos do MIXMASTER, atualize os tokens `?v=` das importações e do script no HTML em conjunto, mantendo a mesma URL para cada módulo compartilhado.
6. Rode `npm test`, `npm run check` e `npm run test:e2e` antes de integrar a alteração.

O envio usa os secrets `HOSTINGER_HOST`, `HOSTINGER_USERNAME`, `HOSTINGER_PASSWORD` e `HOSTINGER_KNOWN_HOSTS`. Os bundles VST3 não são publicados na Hostinger; eles são anexados aos GitHub Releases.
