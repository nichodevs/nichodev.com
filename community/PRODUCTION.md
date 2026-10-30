# Produção: entrada, publicação e operação

Integrar este documento, a entrada e o workflow não publica a comunidade, não altera a Hostinger e não copia o banco. `server.js`, `npm start`, `.hostinger/site.json` e a entrada da homologação permanecem iguais. A aplicação pública continua estática até uma publicação expressamente autorizada.

O bootstrap da homologação continua no mesmo caminho e com a configuração atual. Ele recusa as origens `nichodev.com` e `www.nichodev.com`: esses alvos exigem a nova entrada protegida, mesmo se a variável de liberação estiver definida.

## Pacote único e validado

Execute **Preparar pacote da comunidade** (`community-package.yml`) manualmente na `main`, escolhendo `homologacao`. O workflow executa o CI completo do mesmo commit e gera ZIP, SHA-256 e `RELEASE.txt`. Não envia arquivos à hospedagem. O ZIP contém apenas arquivos versionados; o verificador bloqueia caminhos e formatos comuns de bancos, dados locais e credenciais. Isso não substitui revisar os arquivos versionados para evitar segredos em outros formatos. Confira o hash antes de enviar. O artefato da prévia do CI não substitui este pacote completo.

O alvo `producao` permanece bloqueado enquanto a variável de repositório `COMMUNITY_PRODUCTION_RELEASES_ENABLED` não for `true`. Mesmo liberado, ele **só prepara o pacote**. A ativação no servidor exige uma autorização separada. Não configure credenciais ou um deploy Git automático neste preparo.

## Entrada do domínio principal

Na Hostinger, quando autorizado: Node.js **24**, Express, raiz `.`, saída `.`, build `check`, entrada `scripts/start-community-production.js`. Esta entrada recusa iniciar sem:

- `COMMUNITY_PUBLIC_RELEASE=enabled` e `NODE_ENV=production`.
- `APP_ORIGIN=https://nichodev.com`, sem barra final.
- `COMMUNITY_DATA_DIR=/home/USUARIO/domains/nichodev.com/community-private`, usando o diretório real do usuário da hospedagem. A entrada rejeita outros caminhos e um diretório que seja atalho para os dados da homologação.
- `TRUSTED_PROXY` com IPs/CIDRs explicitamente verificados do proxy da Hostinger. Não usar `true`, contagem de saltos presumida ou redes universais. A origem do tráfego deve ser conferida no transporte real antes de liberar o ambiente.
- O transporte LiteSpeed pode usar socket Unix e ainda apresentar `remoteAddress` de loopback ao Express. Configure os IPs efetivamente observados; o tipo do socket, sozinho, não define a confiança. Compare o endereço escolhido em requisições normais e com `X-Forwarded-For` falso antes de ativar produção.

O servidor exige uma pasta própria, mas não consegue identificar um banco de homologação copiado manualmente para ela: **não copie o SQLite da homologação**. Produção começa com banco novo e vazio, criado na primeira inicialização autorizada. Se houver dados reais que devam ser migrados, faça outro plano explícito de migração, com backup e conferência. Não sincronize bancos SQLite entre ambientes.

## Dados e administração separados

- Homologação mantém seu domínio, sua pasta privada, suas contas, seus arquivos e suas variáveis atuais.
- Produção terá pasta privada `700`, banco `600`, contas próprias e administrador cadastrado/confirmado no domínio público. Não promova automaticamente `teste123` nem contas técnicas.
- Os backups atuais apontam à homologação e devem continuar assim. Antes de abrir produção, configurar agenda local e envio criptografado próprios, distinguindo as cópias dos ambientes. Fazer restauração isolada, incluindo paletas, criações e áudio; guardar o kit de recuperação fora da hospedagem.
- Uma única instância/processo usa o SQLite. Confirmar RAM, disco e comportamento dos limites sob carga antes de liberar cadastros públicos.

## Sequência de ativação e retorno

1. Concluir privacidade, moderação, apresentação pública, redirecionamento de `www` para a origem canônica e validação do proxy. A entrada pública altera a apresentação e a indexação; o bootstrap de homologação mantém seus avisos e `noindex`.
2. Preparar o pacote da `main` validada e registrar commit, hash, entrada e configurações atuais, versão anterior e plano de dados. Não substituir nem remover a pasta privada existente de qualquer ambiente.
3. Com autorização, **desativar o workflow SFTP Publicar site na Hostinger**, incluindo agenda e disparos manuais, antes de trocar a entrada pública. Ele não atualiza o backend e não deve concorrer com a publicação Node.js completa. Manter o deploy Git direto da Hostinger desativado. A partir daí, cada atualização usa o pacote completo validado e publicação Node.js autorizada; a automação de envio é uma etapa futura.
4. Criar/configurar a pasta privada e as variáveis próprias de produção; publicar somente no alvo explicitamente aprovado. Não copiar `.env` da homologação nem usar valores mascarados como credenciais.
5. Conferir site e ferramentas atuais, HTTPS, login/recuperação, presets, paletas em sessões distintas, privacidade das criações, administrador e persistência após reinício. Verificar backups e restauração antes da abertura pública.
6. Em falha, fechar novos acessos à comunidade e restaurar a versão/entrada anterior. Preservar o banco novo e fazer backup antes de qualquer restauração de dados. Uma volta ao site estático não exige apagar o banco. Reativar SFTP somente depois de confirmar o retorno ao modelo estático; não restaurar automaticamente variáveis ou banco da homologação.

Esta preparação não muda DNS, runtime, entrada, agendas ou variáveis reais. Cada alteração na hospedagem permanece para a etapa de ativação autorizada.

## Lançamento e operação

A autorização de lançamento deve preceder a configuração real. A base de produção é nova; não importa usuários, áudios, paletas ou contas técnicas da homologação. Para o primeiro administrador, configure `COMMUNITY_BOOTSTRAP_USER=nichodevadm` e um `COMMUNITY_BOOTSTRAP_TOKEN` aleatório privado. Só esse usuário, com convite correto no cabeçalho, consegue se cadastrar. A conta convidada recebe a função administrativa, mas permanece sem acesso até confirmar que guardou a chave de recuperação. Sem administrador ativo, a entrada pública exige esse convite. Após o cadastro confirmado, remova ambas as variáveis para liberar cadastros normais. Nunca registre o token em logs, no Git ou no chat; abra o convite privado no navegador do responsável. O diagnóstico `COMMUNITY_PROXY_PROBE_TOKEN` também é temporário: sem ele, a rota operacional responde 404.

O site público mostra o acesso à comunidade somente quando a API informa `publicRelease=true`. A interface de produção remove os avisos de homologação e permite indexar a página inicial e os documentos públicos; APIs e ferramentas integradas continuam com `noindex`. Privacidade e regras ficam acessíveis no cadastro e no rodapé. Exclusão exige senha e usuário, remove dados associados e sessões e protege o último administrador. A exportação não inclui hashes, senhas ou chaves; os links de áudio exigem login.

O backup externo de produção usa `backup:producao/` dentro do remote criptografado já configurado. A homologação preserva seu destino anterior. O mesmo kit de recuperação consegue listar a pasta com `rclone lsf backup:producao/` e baixar com `rclone copyto backup:producao/ARQUIVO copia.sqlite`. A pasta continua criptografada no R2 e a regra de retenção do bucket se aplica às duas áreas. Após upload, download e integridade aprovados, a rotina grava `offsite/last-success.json`; ele não contém credenciais.

Instale `scripts/monitor-community.cjs` na pasta privada de produção e agende a cada cinco minutos. Ele verifica resposta, leitura do banco, espaço livre e confirmação de backup local/externo em até 36 horas. Envia falha, lembrete no máximo horário e recuperação a `development@nichodev.com` pelo transporte PHP da hospedagem. Teste com `--test-alert` e confirme recebimento. Esse monitor não consegue alertar se a hospedagem inteira estiver fora do ar. O workflow **Verificar comunidade pública** complementa a conferência por fora a cada 15 minutos: habilite `COMMUNITY_PRODUCTION_MONITOR_ENABLED=true` somente após a troca. Falhas desse workflow usam as notificações configuradas na conta GitHub; não se deve prometer entrega por e-mail sem conferir essas preferências. Desative o monitor externo durante um retorno intencional ao site estático.

`node scripts/test-community-load.cjs` mede 96 consultas com concorrência oito e quatro tentativas simultâneas de login num banco descartável e socket privado. Confirma respostas válidas e limitação da derivação de senhas. Os tempos e RAM reportados são uma medição pontual, não uma garantia de capacidade sustentada. Execute também no plano real antes da abertura e acompanhe recursos após o lançamento.

Depois de qualquer restauração, reaplique solicitações de exclusão pendentes antes de reabrir o serviço. A política e o canal de privacidade descrevem os limites de retenção e os contatos de revisão; não registre dados pessoais nos alertas operacionais.
