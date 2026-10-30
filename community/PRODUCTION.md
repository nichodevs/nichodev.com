# Preparação de produção — ainda não ativada

Integrar este documento, a entrada e o workflow não publica a comunidade, não altera a Hostinger e não copia o banco. `server.js`, `npm start`, `.hostinger/site.json` e a entrada da homologação permanecem iguais. A aplicação pública continua estática até uma publicação expressamente autorizada.

O bootstrap da homologação continua no mesmo caminho e com a configuração atual. Ele recusa as origens `nichodev.com` e `www.nichodev.com`: esses alvos exigem a nova entrada protegida, mesmo se a variável de liberação estiver definida.

## Pacote único e validado

Execute **Preparar pacote da comunidade** (`community-package.yml`) manualmente na `main`, escolhendo `homologacao`. O workflow executa o CI completo do mesmo commit e gera ZIP, SHA-256 e `RELEASE.txt`. Não envia arquivos à hospedagem. O ZIP contém apenas arquivos versionados; o verificador bloqueia caminhos e formatos comuns de bancos, dados locais e credenciais. Isso não substitui revisar os arquivos versionados para evitar segredos em outros formatos. Confira o hash antes de enviar. O artefato da prévia do CI não substitui este pacote completo.

O alvo `producao` permanece bloqueado enquanto a variável de repositório `COMMUNITY_PRODUCTION_RELEASES_ENABLED` não for `true`. Mesmo liberado, ele **só prepara o pacote**. A ativação no servidor exige uma autorização separada. Não configure credenciais ou um deploy Git automático neste preparo.

## Entrada futura do domínio principal

Na Hostinger, quando autorizado: Node.js **24**, Express, raiz `.`, saída `.`, build `check`, entrada `scripts/start-community-production.js`. Esta entrada recusa iniciar sem:

- `COMMUNITY_PUBLIC_RELEASE=enabled` e `NODE_ENV=production`.
- `APP_ORIGIN=https://nichodev.com`, sem barra final.
- `COMMUNITY_DATA_DIR=/home/USUARIO/domains/nichodev.com/community-private`, usando o diretório real do usuário da hospedagem. A entrada rejeita outros caminhos e um diretório que seja atalho para os dados da homologação.
- `TRUSTED_PROXY` com IPs/CIDRs explicitamente verificados do proxy da Hostinger. Não usar `true`, contagem de saltos presumida ou redes universais. Esta revisão não identificou os endereços confiáveis; isso continua sendo uma pendência de infraestrutura.

O servidor exige uma pasta própria, mas não consegue identificar um banco de homologação copiado manualmente para ela: **não copie o SQLite da homologação**. Produção começa com banco novo e vazio, criado na primeira inicialização autorizada. Se houver dados reais que devam ser migrados, faça outro plano explícito de migração, com backup e conferência. Não sincronize bancos SQLite entre ambientes.

## Dados e administração separados

- Homologação mantém seu domínio, sua pasta privada, suas contas, seus arquivos e suas variáveis atuais.
- Produção terá pasta privada `700`, banco `600`, contas próprias e administrador cadastrado/confirmado no domínio público. Não promova automaticamente `teste123` nem contas técnicas.
- Os backups atuais apontam à homologação e devem continuar assim. Antes de abrir produção, configurar agenda local e envio criptografado próprios, distinguindo as cópias dos ambientes. Fazer restauração isolada, incluindo paletas, criações e áudio; guardar o kit de recuperação fora da hospedagem.
- Uma única instância/processo usa o SQLite. Confirmar RAM, disco e comportamento dos limites sob carga antes de liberar cadastros públicos.

## Sequência da futura ativação e retorno

1. Concluir privacidade, moderação, apresentação pública, redirecionamento de `www` para a origem canônica e validação do proxy. O código atual mantém avisos de homologação e `noindex`; esta preparação não resolve esses itens.
2. Preparar o pacote da `main` validada e registrar commit, hash, entrada e configurações atuais, versão anterior e plano de dados. Não substituir nem remover a pasta privada existente de qualquer ambiente.
3. Com autorização, **desativar o workflow SFTP Publicar site na Hostinger**, incluindo agenda e disparos manuais, antes de trocar a entrada pública. Ele não atualiza o backend e não deve concorrer com a publicação Node.js completa. Manter o deploy Git direto da Hostinger desativado. A partir daí, cada atualização usa o pacote completo validado e publicação Node.js autorizada; a automação de envio é uma etapa futura.
4. Criar/configurar a pasta privada e as variáveis próprias de produção; publicar somente no alvo explicitamente aprovado. Não copiar `.env` da homologação nem usar valores mascarados como credenciais.
5. Conferir site e ferramentas atuais, HTTPS, login/recuperação, presets, paletas em sessões distintas, privacidade das criações, administrador e persistência após reinício. Verificar backups e restauração antes da abertura pública.
6. Em falha, fechar novos acessos à comunidade e restaurar a versão/entrada anterior. Preservar o banco novo e fazer backup antes de qualquer restauração de dados. Uma volta ao site estático não exige apagar o banco. Reativar SFTP somente depois de confirmar o retorno ao modelo estático; não restaurar automaticamente variáveis ou banco da homologação.

Esta preparação não muda DNS, runtime, entrada, agendas ou variáveis reais. Cada alteração na hospedagem permanece para a etapa de ativação autorizada.
