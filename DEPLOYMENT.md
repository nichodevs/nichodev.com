# Publicação do site

O site é publicado na Hostinger pelo workflow [Publicar site na Hostinger](.github/workflows/deploy.yml). Este documento descreve quando ele roda e o que revisar ao adicionar arquivos ao site.

Em 30/10/2026 foi removido o deploy Git direto da Hostinger para `nichodev.com`: ele acompanhava `main` sem aguardar o CI e concorria com o SFTP. O site existente mantém `server.js` e seus dados; somente o gatilho direto foi removido. O SFTP abaixo é o fluxo de publicação do site. Não reative o deploy Git em paralelo. O backend da comunidade continua exclusivo da homologação, sem mudança de domínio, entrada ou banco em produção.

## Quando o deploy roda

- **Push para `main`:** quando a alteração inclui arquivos de `public/**` ou o próprio `.github/workflows/deploy.yml`. Arquivos Markdown são excluídos desse gatilho.
- **Manual:** `workflow_dispatch` publica o branch escolhido na execução do GitHub Actions; selecione `main` para publicar a versão integrada.
- **Agendado:** uma publicação diária às 09:00 UTC (06:00 em Brasília).

Documentação, `plugin/**` e `tests/**` não acionam o deploy por push. Isso inclui o README de `public/onda/`. O workflow de validação do site é separado e pode rodar sem publicar.

As execuções compartilham o grupo `hostinger-production`: somente um envio pode escrever em `public_html` por vez. Uma execução já iniciada termina antes da próxima, evitando interrupção no meio do upload e sobrescrita por envios simultâneos.

## Validações e envio

O job de publicação depende de **Validar site**, chamado como workflow reutilizável no mesmo commit da execução. Ele instala as dependências do lockfile e executa `npm test`, `npm run check`, `npm run test:community`, `npm run test:e2e` e `npm run test:preview`. O runner prepara uma saída de áudio virtual PulseAudio, e os cenários essenciais usam perfis temporários normais para permitir persistência de blobs no WebKit. O Playwright executa a suíte completa no Chromium e os cenários essenciais de navegação, importação, reprodução e armazenamento em Firefox/WebKit. Qualquer falha em um dos três motores impede o job SFTP, inclusive em execuções manuais e agendadas. Diagnósticos de falhas (traces e capturas) são guardados por sete dias nos artefatos do workflow. Os PRs usam esse mesmo workflow de validação; a publicação faz sua própria validação antes do envio, sem uma segunda execução independente por push.

Após a validação, o job SFTP confere os secrets de conexão e envia uma lista explícita de arquivos de `public/` para a pasta pública do domínio. O prefixo `public/` existe apenas no repositório: `public/voz.html` é enviado como `voz.html`, preservando `/voz.html` e as demais URLs. Depois, faz requisições HTTP às páginas e assets publicados.

Antes do primeiro arquivo, o cliente tenta criar as pastas e depois verifica cada destino com falhas fatais habilitadas. Isso permite reutilizar diretórios existentes sem esconder falhas de acesso ou de upload.

O envio e a lista de URLs verificadas estão em `deploy.yml`. A validação em `scripts/validate-site.js` lê as páginas e CSS em `public/` e segue imports relativos estáticos ou dinâmicos com caminho literal e compara as fontes locais com os destinos declarados no envio SFTP.

## Ao adicionar ou renomear arquivos do site

1. Crie o arquivo dentro de `public/` e adicione-o à lista `put` do workflow. A origem inclui `public/`; o destino usa o caminho relativo dentro dessa pasta.
2. Os arquivos de `public/**` já são cobertos pelo filtro de push, com Markdown excluído. O agendamento diário e a execução manual continuam publicando a lista completa de arquivos do site.
3. Se criar uma página HTML nova, inclua seu caminho relativo a `public/` na lista `pages` de `scripts/validate-site.js`; seus assets referenciados passam a ser verificados pela validação.
4. Inclua a URL nos checks HTTP pós-deploy do workflow.
5. Ao alterar módulos do MIXMASTER, atualize os tokens `?v=` das importações e do script no HTML em conjunto, mantendo a mesma URL para cada módulo compartilhado.
6. Mantenha o sitemap, a URL canônica e os metadados sociais coerentes ao adicionar páginas. Inclua imagens de compartilhamento e sitemap nos uploads e checks HTTP; não publique URLs de preview no sitemap.
7. Rode `npm test`, `npm run check` e `npm run test:e2e` antes de integrar a alteração.

O envio usa os secrets `HOSTINGER_HOST`, `HOSTINGER_USERNAME`, `HOSTINGER_PASSWORD` e `HOSTINGER_KNOWN_HOSTS`. Os bundles VST3 não são publicados na Hostinger; eles são anexados aos GitHub Releases.

## Comunidade em homologação Node.js

As ferramentas integradas usam `/comunidade/ferramentas/voz.html` e `/comunidade/ferramentas/guitarra.html`. Essas rotas só existem no backend: a Hostinger prioriza arquivos físicos de `public/` e não executa a injeção do backend em `/voz.html` ou `/guitarra.html`. Os testes reproduzem essa prioridade. As páginas integradas reutilizam os templates públicos, ajustam os caminhos dos recursos e autorizam os scripts inline existentes por nonce, mantendo a política de segurança. O site público permanece sem os controles da comunidade.

A [homologação online da comunidade](https://cornflowerblue-lapwing-604910.hostingersite.com/comunidade/) usa uma aplicação Node.js separada. O alvo de `.hostinger/site.json` pertence a essa aplicação, enquanto o nichodev.com continua com o fluxo SFTP. O backend e a interface da comunidade não integram os uploads SFTP. Consulte [community/README.md](community/README.md) para executar e preparar uma aplicação Node.js separada, com HTTPS, disco persistente privado, administrador e backup. A publicação dessa aplicação precisa de autorização própria. O sintetizador MIDI compartilhado em `public/js/mixmaster/midi-synth.js` é um asset do site estático e permanece incluído nos uploads e nas verificações HTTP.
