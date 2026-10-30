# Comunidade: backend de homologação

A comunidade usa Express já instalado, SQLite e criptografia nativa do Node.js. Não adiciona dependências. O site estático e seu servidor habitual continuam separados; esta aplicação **não é publicada pelo SFTP**.

## Rodar para homologar

Recomendado: Node.js 24.22 ou superior dentro da linha 24 LTS. Na raiz:

```sh
npm ci
npm run preview:community
```

Abra http://127.0.0.1:3200/comunidade/. O endereço `/` abre o site e suas ferramentas. Os dados ficam em `.data/community/community.sqlite`, fora das pastas servidas e ignorados pelo Git. Reiniciar o servidor preserva os dados. Encerrar o processo torna a prévia local indisponível; não apague a pasta enquanto precisar dos dados de homologação.

## O que é real nesta entrega

- **Avaliações:** envio anônimo opcional, comentário e e-mail opcionais, confirmação somente depois de gravar no banco. Somente administradores consultam e classificam as avaliações; retenção de 90 dias.
- **Contas:** login único, de 3 a 24 caracteres ASCII (letras, números e `_`), sem exigir e-mail ou nome real. Senha de 15 a 128 caracteres, sem regras de símbolos: prefira uma frase. Senhas recebem scrypt com salt; chaves de recuperação e tokens são guardados como hashes.
- **Cadastro:** conta permanece inativa até a confirmação de que a chave foi guardada. Cancelar remove o cadastro pendente; a etapa expira em 30 minutos. A chave aparece uma vez, com cópia e download. Não há senha administrativa inicial.
- **Recuperação:** exige usuário e chave. Substitui senha e chave, encerra todas as sessões e pede novo login. Alterar a senha exige a atual e também encerra as sessões. Trocar só a chave exige a senha atual.
- **Presets:** parâmetros completos, validados e versionados de Voz ou Guitarra do navegador. Nas ferramentas deste servidor, **SALVAR MEU TIMBRE** captura os ajustes; **ABRIR NA FERRAMENTA** oferece aplicação explícita. Também é possível baixar/importar o JSON, favoritar e criar uma cópia privada. Presets VST3 têm processamento diferente e não são aceitos.
- **Criações:** autor pode editar, excluir e mudar visibilidade. Privadas são acessíveis ao autor e à administração. Não listadas usam um link com chave; qualquer pessoa com o link pode repassá-lo. Gerar outro link ou editar a criação invalida o anterior. Públicas só aparecem após moderação; editar retira a aprovação.
- **Áudio:** prévia WAV real, PCM16 ou float32, mono/estéreo, 8 a 96 kHz, até 120 segundos e 10 MB. Limites: 100 criações e 50 MB de áudio por conta, 500 MB de áudio no ambiente. Upload sem criação é removido depois de 24 horas. Não são aceitos projetos editáveis completos na nuvem.
- **Exemplo:** o projeto MIDI baixado e a prévia usam o mesmo andamento, notas e sintetizador compartilhado com o MIXMASTER. Importar o backup substitui o projeto aberto: guarde o trabalho anterior.

A interface mantém o foco ao favoritar e classificar avaliações. Falhas de envio/salvamento permanecem no formulário, sem mensagem de sucesso.

## Administrador e backup

Cadastre e confirme sua conta normalmente. No terminal do servidor, selecione a pasta de dados e promova apenas o usuário responsável. Não envie senha ou chave pelo chat.

```powershell
$env:COMMUNITY_DATA_DIR = 'C:\caminho-privado\dados-comunidade'
node community/manage.js admin SEU_USUARIO
node community/manage.js backup 'C:\backups-privados\comunidade.sqlite'
```

Para a configuração local padrão, a pasta é `.data/community` na raiz. No Linux, configure a mesma variável no ambiente e use caminhos absolutos Linux. O painel aparece após atualizar/entrar na conta promovida.

O backup usa a API nativa do SQLite, preservando consistência com o banco aberto. Mantenha backups fora das pastas públicas, com acesso restrito, e nunca os envie como artefatos do CI. Para restaurar, pare o processo e substitua a pasta de dados por uma pasta contendo somente o backup renomeado `community.sqlite`; não misture arquivos WAL/SHM antigos. Guarde a pasta anterior até verificar a restauração.

Para ensaiar a recuperação na Hostinger, sem substituir o banco ativo, use Node.js 24 e informe a pasta do site:

```sh
node scripts/test-restore.cjs /home/USUARIO/domains/DOMINIO
```

O verificador copia `community-private/latest.sqlite` para uma pasta privada temporária, confere integridade, referências e todos os registros e bytes de áudio, e inicia o código já publicado em `hbuilds/current/nodejs` somente em `127.0.0.1`, numa porta livre. Testa leitura, escrita descartável e permissões na cópia, preserva o backup original e remove a cópia ao encerrar. O log contém somente totais e resultados, sem senhas, chaves, comentários ou áudios. O teste não troca o banco ativo nem exige uma publicação do site; execute com espaço livre para duas cópias adicionais do backup.

## Homologação online na Hostinger

[Abrir a comunidade em homologação](https://cornflowerblue-lapwing-604910.hostingersite.com/comunidade/).

A aplicação da comunidade é separada do nichodev.com. O alvo está registrado em [`.hostinger/site.json`](../.hostinger/site.json); esse arquivo aponta exclusivamente para a homologação Node.js. O site principal mantém seu fluxo próprio de publicação por SFTP.

O código publicado corresponde ao commit `729687b79d77860f21b8051eede09f87b7794c79`. Foram usados Express, Node.js 24, o bootstrap `scripts/preview-community.js` e `npm run check` antes da publicação. A entrega usa um ZIP dos arquivos versionados do GitHub, sem banco, credenciais ou `node_modules`. O deploy automático da comunidade a cada push não foi ativado.

Os dados ficam em `/home/USUARIO/domains/DOMINIO/community-private`, fora de `public_html` e de `hbuilds/versions`, com diretório privado de permissão `700`. Cadastro, recuperação de senha, cookies seguros e autorização de áudio foram verificados online. A conta técnica, seu preset e os bytes do WAV permaneceram disponíveis após reiniciar a aplicação e após publicar novamente.

O backup consistente `latest.sqlite` fica na mesma pasta privada. O primeiro arquivo passou no `PRAGMA quick_check`, e o comando já disponível em `community/manage.js` está agendado para **03:00 UTC / 00:00 de Brasília, diariamente**. Ele mantém a última cópia no mesmo plano: não substitui retenção de versões nem uma cópia externa. A promoção de administrador é uma execução pontual do CLI, nunca uma concessão recorrente. A chave SSH temporária usada na configuração foi revogada após o uso.

As contas da prévia local e da hospedagem são separadas. Para atualizar a homologação, use um commit validado, mantenha as variáveis e o diretório privado existentes, publique na mesma aplicação e confira novamente os dados. Não substitua a pasta de dados pelo conteúdo do pacote.

## Preparar outra instalação Node.js

Preparar uma aplicação Node.js separada requer autorização para a publicação e acesso ao painel de hospedagem. Nenhuma configuração da Hostinger é alterada ao executar estes comandos localmente.

- Entrada usada na Hostinger: `scripts/preview-community.js`; instalação: `npm ci --omit=dev`; comando: `npm run start:community`.
- `NODE_ENV=production`.
- `APP_ORIGIN=https://comunidade-homologacao.seu-dominio` com a origem exata, sem barra final. A proteção de origem depende dessa configuração.
- `COMMUNITY_DATA_DIR` obrigatório: caminho absoluto persistente e privado, fora de `public/`, `prototypes/community/` e da pasta substituída em cada deploy. Confirmar com o provedor que ela sobrevive a reinícios e novas publicações.
- `PORT` fornecida pelo serviço; a aplicação escuta em `0.0.0.0` em produção. HTTPS é obrigatório para cookies seguros. Confirmar o cabeçalho/encaminhamento do proxy antes de configurar `TRUSTED_PROXY`; o padrão não confia em cabeçalhos enviados pelo cliente. Não use confiança irrestrita. Sem a configuração correta, usuários atrás do proxy podem compartilhar o mesmo limite por IP.
- Use uma instância/processo e disco persistente local. Reserve memória para até duas autenticações scrypt simultâneas (aproximadamente 256 MB só para derivação), além do Node e do banco; 512 MB é um ponto inicial a medir. Autenticações excedentes recebem erro temporário.
- Restrinja a homologação a avaliadores antes de abrir cadastros ao público. Confirme HTTPS, persistência após redeploy, promoção do administrador e restauração de backup no ambiente hospedado.

`shortcut: SQLite atende uma única instância pequena; migrar armazenamento e limites distribuídos antes de múltiplas réplicas ou crescimento que exceda esta homologação.`

Há limites por IP, validação de origem, corpos limitados sem descompressão, CSP, cookies HttpOnly/SameSite e autorização no servidor. Isso não substitui testes de carga, revisão de segurança independente, política de privacidade e operação de backups antes de abrir o serviço ao público.

## Validar

```sh
npm test
npm run check
npm run test:community
npx playwright install chromium firefox webkit
npm run test:preview
npm run test:e2e
```

Os testes da API usam bancos isolados e verificam confirmação, senhas/chaves, revogação, privacidade, moderação, concorrência de edição, WAV, limites e persistência/backup. A interface é exercitada em Chromium, Firefox e WebKit, inclusive falha de envio, integração de presets, foco, upload e exemplo no editor. As credenciais dos testes são fictícias e os bancos são removidos ao final. O WebKit fornecido pelo Playwright para Windows não oferece áudio/Web Audio: somente os dois cenários novos que precisam desses recursos são marcados como não executados nesse ambiente. No CI Linux, eles são obrigatórios, sem essa exceção. Os testes não validam os recursos e o proxy de uma instalação Hostinger ainda não provisionada.
