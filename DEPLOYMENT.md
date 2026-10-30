# Publicação do site e da comunidade

O domínio principal usa Node.js 24, Express e a entrada protegida `scripts/start-community-production.js`. Site, ferramentas e comunidade são publicados juntos por pacote completo. O workflow SFTP **Publicar site na Hostinger** está desativado, e o deploy Git direto da Hostinger também permanece desativado. Nenhum deles deve concorrer com a publicação Node.js.

## Preparar e publicar

1. Integre o PR após o CI aprovado. **Preparar pacote da comunidade** só aceita a `main`; escolha `producao` ou `homologacao` explicitamente. Produção exige `COMMUNITY_PRODUCTION_RELEASES_ENABLED=true` no repositório.
2. O workflow chama a validação completa do mesmo commit: dependências do lockfile, validador, API, carga isolada, site e interface da comunidade. Chromium recebe a suíte completa do site; Firefox/WebKit executam os cenários essenciais e a interface da comunidade. O runner prepara áudio virtual. Uma falha impede o pacote.
3. Baixe o artefato completo com ZIP, `SHA256SUMS` e `RELEASE.txt`. Confira commit, alvo e hash. A prévia do CI não substitui esse pacote. Não inclua banco, `.env`, rclone.conf, chaves ou `node_modules`.
4. Registre a versão atual e preserve uma cópia para retorno. Com autorização para o domínio escolhido, envie o ZIP e publique como Express, Node.js 24, raiz e saída `.`, build `check`. Use a entrada protegida em produção e `scripts/preview-community.js` na homologação.
5. Preserve todas as variáveis reais e a pasta privada do ambiente. A API de variáveis substitui o conjunto inteiro; valores mascarados não são credenciais utilizáveis. Não copie bancos nem contas de teste entre ambientes.
6. Confira saúde, entrada, ferramentas, apresentação, privacidade e dados depois do reinício. Em produção, confira também o redirecionamento de `www` preservando caminho e consulta. Após o deploy, execute `node scripts/route-public-html.cjs` na versão publicada para encaminhar as páginas HTML pelo Node. O comando confere e guarda somente as cópias físicas idênticas, preserva as fontes e não toca no banco. Confira o nonce dos scripts e o redirecionamento de `www`, inclusive `/onda/`, conforme [PRODUCTION.md](community/PRODUCTION.md).
7. Confira backup local, recibo externo e monitoramento. Cada publicação é explícita; preparar um pacote não envia arquivos à Hostinger.

A [homologação](https://cornflowerblue-lapwing-604910.hostingersite.com/comunidade/) continua independente da [produção](https://nichodev.com/comunidade/). `.hostinger/site.json` aponta somente para a homologação. O procedimento de dados, convite administrativo, backup, restauração e retorno está em [community/PRODUCTION.md](community/PRODUCTION.md).

## Ao alterar arquivos públicos

- Mantenha arquivos do site em `public/`. Suas URLs continuam sem esse prefixo: `public/voz.html` é servido em `/voz.html`.
- Adicione páginas novas à lista `pages` de `scripts/validate-site.js` e atualize os metadados, sitemap e testes de navegação/SEO. Não inclua URLs de homologação no sitemap público.
- Atualize os tokens `?v=` em conjunto ao alterar módulos compartilhados do MIXMASTER, usando a mesma URL para cada módulo.
- O validador ainda confere a lista explícita de assets do workflow SFTP legado. Mantenha-a coerente ao criar ou renomear assets enquanto essa verificação existir; isso não reativa o envio.
- Use o CI do PR e o workflow de pacote. Falhas guardam traces e capturas por sete dias; pacotes e prévias expiram conforme a retenção do artefato.

As ferramentas integradas usam `/comunidade/ferramentas/voz.html` e `/comunidade/ferramentas/guitarra.html`, pois a Hostinger prioriza arquivos físicos sobre rotas Node.js. Elas reutilizam os templates públicos, ajustam caminhos e autorizam scripts inline existentes por nonce. As ferramentas na raiz continuam disponíveis sem a ponte da comunidade.

## Fluxo SFTP legado e retorno

O workflow `deploy.yml` continua versionado para referência e eventual retorno ao modelo estático. Seus gatilhos de push, agenda e execução manual não publicam enquanto estiver desativado. Reative-o somente após restaurar e validar a entrada estática e desativar o monitor público da comunidade; nunca mantenha os dois fluxos escrevendo no mesmo destino. Não reative o deploy Git direto.

Uma volta à entrada estática `server.js` não exige apagar a base da comunidade. Faça backup, preserve o diretório privado, confira a versão e valide `/health`, ferramentas e ausência de novos cadastros. A agenda de backup permanece separada da entrada web. Nunca restaure automaticamente o banco da homologação em produção.

Os VST3 seguem seu [processo de release](plugin/RELEASING.md): os ZIPs são anexados ao GitHub Releases, sem envio à Hostinger.
