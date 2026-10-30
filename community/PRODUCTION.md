# Produção: entrada, publicação e operação

Este guia descreve a entrada pública e a operação dos dois ambientes. Integrar código não publica nem copia bancos: cada publicação Node.js exige o pacote validado e autorização para o domínio correto. `server.js` e `npm start` continuam como entrada estática local e alternativa de retorno; `.hostinger/site.json` permanece exclusivo da homologação.

O bootstrap da homologação continua no mesmo caminho e usa configuração própria. Ele recusa as origens `nichodev.com` e `www.nichodev.com`: esses alvos exigem a nova entrada protegida, mesmo se a variável de liberação estiver definida.

## Pacote único e validado

Execute **Preparar pacote da comunidade** (`community-package.yml`) manualmente na `main`, escolhendo `homologacao`. O workflow executa o CI completo do mesmo commit e gera ZIP, SHA-256 e `RELEASE.txt`. Não envia arquivos à hospedagem. O ZIP contém apenas arquivos versionados; o verificador bloqueia caminhos e formatos comuns de bancos, dados locais e credenciais. Isso não substitui revisar os arquivos versionados para evitar segredos em outros formatos. Confira o hash antes de enviar. O artefato da prévia do CI não substitui este pacote completo.

O alvo `producao` permanece bloqueado enquanto a variável de repositório `COMMUNITY_PRODUCTION_RELEASES_ENABLED` não for `true`. Mesmo liberado, ele **só prepara o pacote**. A ativação no servidor exige uma autorização separada. Não configure credenciais ou um deploy Git automático neste preparo.

## Entrada do domínio principal

Na Hostinger, quando autorizado: Node.js **24**, Express, raiz `.`, saída `.`, build `check`, entrada `scripts/start-community-production.js`. Esta entrada recusa iniciar sem:

- `COMMUNITY_PUBLIC_RELEASE=enabled` e `NODE_ENV=production`.
- `APP_ORIGIN=https://nichodev.com`, sem barra final.
- `COMMUNITY_DATA_DIR=/home/USUARIO/domains/nichodev.com/community-private`, usando o diretório real da conta obtido pelo sistema (`os.userInfo().homedir`). O LiteSpeed pode apresentar a pasta do domínio em `os.homedir()`, portanto esse valor não define a raiz da conta. A entrada rejeita outros caminhos e um diretório que seja atalho para os dados da homologação.
- `TRUSTED_PROXY` com IPs/CIDRs explicitamente verificados do proxy da Hostinger. Não usar `true`, contagem de saltos presumida ou redes universais. A origem do tráfego deve ser conferida no transporte real antes de liberar o ambiente.
- O transporte LiteSpeed pode usar socket Unix e ainda apresentar `remoteAddress` de loopback ao Express. Configure os IPs efetivamente observados; o tipo do socket, sozinho, não define a confiança. Compare o endereço escolhido em requisições normais e com `X-Forwarded-For` falso antes de ativar produção.

O servidor exige uma pasta própria, mas não consegue identificar um banco de homologação copiado manualmente para ela: **não copie o SQLite da homologação**. Produção começa com banco novo e vazio, criado na primeira inicialização autorizada. Se houver dados reais que devam ser migrados, faça outro plano explícito de migração, com backup e conferência. Não sincronize bancos SQLite entre ambientes.

## Dados e administração separados

- Homologação mantém seu domínio, sua pasta privada, suas contas, seus arquivos e suas variáveis atuais.
- Produção usa pasta privada `700`, banco `600`, contas próprias e administrador cadastrado/confirmado no domínio público. Não promova automaticamente `teste123` nem contas técnicas.
- Cada ambiente usa agenda local e envio criptografado próprios, distinguindo as cópias. Fazer restauração isolada, incluindo os registros e arquivos existentes, e guardar o kit de recuperação fora da hospedagem.
- Uma única instância/processo usa o SQLite. Confirmar RAM, disco e comportamento dos limites sob carga antes de liberar cadastros públicos.

## Sequência de ativação e retorno

1. Concluir privacidade, moderação, apresentação pública, redirecionamento de `www` para a origem canônica e validação do proxy. A entrada pública altera a apresentação e a indexação; o bootstrap de homologação mantém seus avisos e `noindex`.
2. Preparar o pacote da `main` validada e registrar commit, hash, entrada e configurações atuais, versão anterior e plano de dados. Não substituir nem remover a pasta privada existente de qualquer ambiente.
3. Com autorização, **desativar o workflow SFTP Publicar site na Hostinger**, incluindo agenda e disparos manuais, antes de trocar a entrada pública. Ele não atualiza o backend e não deve concorrer com a publicação Node.js completa. Manter o deploy Git direto da Hostinger desativado. A partir daí, cada atualização usa o pacote completo validado e publicação Node.js autorizada; a automação de envio é uma etapa futura.
4. Criar/configurar a pasta privada e as variáveis próprias de produção; publicar somente no alvo explicitamente aprovado. Não copiar `.env` da homologação nem usar valores mascarados como credenciais.
5. Conferir site e ferramentas atuais, HTTPS, login/recuperação, presets, paletas em sessões distintas, privacidade das criações, administrador e persistência após reinício. Verificar backups e restauração antes da abertura pública.
6. Em falha, fechar novos acessos à comunidade e restaurar a versão/entrada anterior. Preservar o banco novo e fazer backup antes de qualquer restauração de dados. Uma volta ao site estático não exige apagar o banco. Reativar SFTP somente depois de confirmar o retorno ao modelo estático; não restaurar automaticamente variáveis ou banco da homologação.

Alterações nos arquivos do repositório não mudam DNS, runtime, entrada, agendas ou variáveis reais por si só. A configuração da hospedagem e a publicação seguem as ações explícitas acima.

## Lançamento e operação

A autorização de lançamento deve preceder a configuração real. A base de produção é nova; não importa usuários, áudios, paletas ou contas técnicas da homologação. Para o primeiro administrador, configure `COMMUNITY_BOOTSTRAP_USER=nichodevadm` e um `COMMUNITY_BOOTSTRAP_TOKEN` aleatório privado. Só esse usuário, com convite correto no cabeçalho, consegue se cadastrar. A conta convidada recebe a função administrativa, mas permanece sem acesso até confirmar que guardou a chave de recuperação. Sem administrador ativo, a entrada pública exige esse convite. Após o cadastro confirmado, remova ambas as variáveis para liberar cadastros normais. Nunca registre o token em logs, no Git ou no chat; abra o convite privado no navegador do responsável. O diagnóstico `COMMUNITY_PROXY_PROBE_TOKEN` também é temporário: sem ele, a rota operacional responde 404.

O site público mostra o acesso à comunidade somente quando a API informa `publicRelease=true`. A interface de produção remove os avisos de homologação e permite indexar a página inicial e os documentos públicos; APIs e ferramentas integradas continuam com `noindex`. Privacidade e regras ficam acessíveis no cadastro e no rodapé. Exclusão exige senha e usuário, remove dados associados e sessões e protege o último administrador. A exportação não inclui hashes, senhas ou chaves; os links de áudio exigem login.

O backup externo de produção usa `backup:producao/` dentro do remote criptografado já configurado. A homologação preserva seu destino anterior. O mesmo kit de recuperação consegue listar a pasta com `rclone lsf backup:producao/` e baixar com `rclone copyto backup:producao/ARQUIVO copia.sqlite`. A pasta continua criptografada no R2 e a regra de retenção do bucket se aplica às duas áreas. Após upload, download e integridade aprovados, a rotina grava `offsite/last-success.json`; ele não contém credenciais.

Instale `scripts/monitor-community.cjs` na pasta privada de produção e agende a cada cinco minutos. Ele verifica resposta, leitura do banco, espaço livre e confirmação de backup local/externo em até 36 horas. Envia falha, lembrete no máximo horário e recuperação a `development@nichodev.com` pelo transporte PHP da hospedagem. Teste com `--test-alert` e confirme recebimento. Esse monitor não consegue alertar se a hospedagem inteira estiver fora do ar. O workflow **Verificar comunidade pública** complementa a conferência por fora a cada 15 minutos: habilite `COMMUNITY_PRODUCTION_MONITOR_ENABLED=true` somente após a troca. Falhas desse workflow usam as notificações configuradas na conta GitHub; não se deve prometer entrega por e-mail sem conferir essas preferências. Desative o monitor externo durante um retorno intencional ao site estático.

`node scripts/test-community-load.cjs` mede 96 consultas com concorrência oito e quatro tentativas simultâneas de login num banco descartável e socket privado. Confirma respostas válidas e limitação da derivação de senhas. Os tempos e RAM reportados são uma medição pontual, não uma garantia de capacidade sustentada. Execute também no plano real antes da abertura e acompanhe recursos após o lançamento.

Depois de qualquer restauração, reaplique solicitações de exclusão pendentes antes de reabrir o serviço. A política e o canal de privacidade descrevem os limites de retenção e os contatos de revisão; não registre dados pessoais nos alertas operacionais.

## Rotinas configuradas em 30/10/2026

| Ambiente | Cópia local (UTC / Brasília) | R2 (UTC / Brasília) | Destino criptografado |
| --- | --- | --- | --- |
| Homologação | 03:00 / 00:00 | 03:10 / 00:10 | `backup:` (raiz) |
| Produção | 03:20 / 00:20 | 03:30 / 00:30 | `backup:producao/` |

A pasta privada de cada domínio fica fora de `public_html` e de `hbuilds/versions`. Produção começou com base vazia; a base de homologação não foi importada. O kit privado de recuperação existente também abre a pasta criptografada de produção; as instruções locais foram complementadas sem copiar credenciais para este repositório. A regra de retenção do bucket é de 30 dias, sujeita ao ciclo de expiração do provedor.

## Encaminhar as páginas públicas pelo Node

A Hostinger atende arquivos da pasta `public/` da aplicação antes do middleware Node.js; a raiz `public_html` pode conter somente a configuração Passenger. Por isso, uma regra colocada apenas nessa raiz não garante o redirecionamento dos HTML. Depois de publicar o pacote validado, execute em `hbuilds/current/nodejs`:

```sh
/opt/alt/alt-nodejs24/root/bin/node scripts/route-public-html.cjs
```

O comando só aceita a versão publicada de nichodev.com. Prepara cópias verificadas dos HTML e da pasta da onda em `server-pages/`, fora da pasta interceptada pela hospedagem. A preparação fica visível somente depois da cópia completa. Em seguida, preserva os originais em `server-pages/.originals/`; nada é apagado e o banco não é aberto. Os demais assets continuam em `public/`. Uma divergência ou destino inesperado interrompe a operação antes de mover os arquivos restantes. O comando pode ser repetido após uma interrupção; não sobrescreve originais preservados.

O renderizador lê os templates no local original ou no local preparado, mantendo as URLs. Ele aplica nonce aos scripts inline sem acrescentar controles da comunidade às ferramentas da raiz. A onda continua com seus recursos na mesma URL. Dados e destinos de backup são proibidos tanto em `public/` quanto em `server-pages/`. Essas pastas preparadas são artefatos de execução, ignorados pelo Git; nunca guarde ali SQLite, credenciais ou configurações privadas.

Confira todas as páginas, áudio, scripts e o redirecionamento de `www` com caminho e consulta. O validador do código roda antes da preparação, sobre os arquivos versionados; depois dela, valide as respostas HTTP e os recursos da aplicação. Cada novo deploy parte novamente do pacote original e exige esse passo. A entrada estática `server.js` também lê os HTML preparados para permitir retorno sem apagar dados. Não reative o SFTP antes de validar o retorno ao modelo estático e desativar o monitor público da comunidade.

## Registro da primeira ativação pública

- Commit do pacote: `3845b8b32a10737614cc2e01cb81bc2c557f7bc1`.
- Workflow do pacote: [41106286217](https://github.com/nichodevs/nichodev.com/actions/runs/41106286217).
- Build publicado: `01a18e10-94bd-7113-ba7e-2b4d1f31ab94`.
- SHA-256 do ZIP: `3cad22ae013b45650b8a8cc268720cf3f20e8130e7d14851d8ea2d62a1e03c29`.
- Verificações de publicação, administração, backup e monitoramento: comunidade e ferramentas integradas acessíveis; nichodevadm confirmado como administrador; backup local e R2 com restauração isolada da conta aprovados; alerta de teste entregue e monitor externo aprovado. O encaminhamento dos HTML públicos é validado separadamente após cada publicação..


## Reforços de segurança — 30/10/2026

No GitHub, grafo de dependências e Dependabot alerts habilitados. No R2 privado, Bucket Lock `community-backups-retention-30-days` habilitado em todo o bucket, com 30 dias, mantendo o lifecycle de 30 dias. Os reforços de código e as condições de publicação estão em [SECURITY.md](SECURITY.md); sua integração no GitHub não significa publicação automática na Hostinger.
