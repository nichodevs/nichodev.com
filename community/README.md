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

## Homologação hospedada na Hostinger

Preparar uma aplicação Node.js separada requer autorização para a publicação e acesso ao painel de hospedagem. Nenhuma configuração da Hostinger é alterada ao executar estes comandos localmente.

- Entrada: `community/server.js`; instalação: `npm ci --omit=dev`; comando: `npm run start:community`.
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
