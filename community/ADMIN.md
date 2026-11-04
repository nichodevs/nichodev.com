# Central administrativa

Implementação em preparação, sem publicação automática. O painel abre em `/comunidade/#painel` após login de uma conta da equipe. Backend e interface devem ser publicados no mesmo pacote.

## Acesso e migração

A migração só adiciona tabelas e índices; preserva `users`, as três colunas de `sessions` e os dados existentes. Na primeira abertura de uma base antiga, os administradores existentes recebem papel `admin`; o administrador confirmado mais antigo (desempate pelo ID) recebe `owner`. **Confira o proprietário em homologação e produção antes da abertura.** O bootstrap de uma base nova cria o convidado como proprietário. O comando operacional `manage.js admin` atribui proprietário somente se ainda não houver um; caso contrário atribui administrador, revoga sessões e registra a concessão. Não use esse comando para promover usuários cotidianos.

| Papel | Permissões |
| --- | --- |
| Proprietário | Todos os módulos; atribuir papéis, inclusive outro proprietário |
| Administrador | Usuários membros, recuperação assistida, moderação, estatísticas, operações, configurações, auditoria e avaliações |
| Moderador | Publicações públicas, denúncias e histórico de moderação; sem acesso a usuários, avaliações privadas, recuperação ou operações |

Só proprietários gerenciam outras contas da equipe. Ninguém suspende a própria conta ou muda o próprio papel. O último proprietário não pode excluir a conta. Trocar papel exige conta confirmada e não suspensa e encerra suas sessões. Suspender encerra sessões e impede login e recuperação; não apaga dados nem oculta automaticamente publicações aprovadas. Reativar exige novo login. Bloqueios de publicação duram até 30 dias; zero libera antecipadamente. Eles impedem envio/edição públicos; criações privadas continuam disponíveis.

## Segundo fator

Todas as rotas privilegiadas exigem senha confirmada nos últimos dez minutos **e MFA recente por sessão**. Login com senha não libera o painel. A interface pede configuração TOTP (RFC 6238, SHA-1, seis dígitos, 30 s) por aplicativo autenticador, com senha atual e chave de recuperação. Não há QR externo nem envio do segredo a terceiros: use a chave manual no aplicativo.

A configuração expira em dez minutos se não confirmada. Aceita-se no máximo um passo anterior/posterior, com consumo atômico do passo para impedir repetição entre sessões/processos. Tentativas têm limites por IP e conta. A confirmação entrega oito códigos de emergência, exibidos uma vez e persistidos somente por hash. Um código remove o fator perdido, invalida os demais códigos e outras sessões e exige cadastrar novo fator; não dispensa MFA para usar o painel. Guarde-os fora do site. Senha e chave de recuperação continuam separadas do segundo fator.

O segredo TOTP é cifrado com AES-256-GCM usando chave derivada do segredo persistente de segurança. Ambos estão no SQLite privado: isso protege contra exposição isolada de campos, **não contra roubo integral da base**. Proteção de arquivo, backups criptografados e controle do servidor continuam essenciais. Não há passkeys nesta entrega. Mantenha o relógio do servidor sincronizado. Sem autenticador e sem códigos, recuperação da equipe exige procedimento operacional offline com verificação independente do proprietário; não há botão para um administrador remover o fator de outro.

## Recuperação assistida

O fluxo direto por usuário + chave permanece. A opção assistida é complementar para incidentes: verifica a chave existente no backend, cria solicitação válida por 24 h e encerra as sessões comprometidas. O solicitante guarda ID e token aleatório privado. A equipe vê somente conta, prazo, prova verificada, estado e motivo; nunca recebe chave, token nem senha antiga/nova.

Administrador/proprietário aprova ou recusa com motivo. Só o solicitante com token consegue concluir uma aprovação, definindo senha nova, passando pela consulta de senhas comprometidas e recebendo nova chave. Token é consumido uma vez; troca da chave, expiração, suspensão ou promoção para equipe impede a conclusão. Solicitações são removidas após 30 dias. Não se aceita nome público, conhecimento de publicações, captura de tela ou declaração pessoal como prova. **Sem chave ou outro fator previamente cadastrado não existe recuperação assistida confiável.** Contas da equipe usam o fluxo direto e preservam MFA.

## Moderação e consultas

Listas de contas, avaliações, publicações, denúncias, solicitações, auditoria e históricos usam páginas de 25 por padrão (1–100 por pedido), total e ordenação estável. Busca de usuários por prefixo, com escape de curingas e limite de 24 caracteres. Índices cobrem donos de criações, filas e históricos; não se carregam milhares de registros no navegador.

Publicações públicas são revisadas nas filas pendente/aprovada/oculta. Decisões exigem motivo e versão atual, podem reabrir revisão e geram histórico e notificação ao autor. A contagem de decisões anteriores de ocultação fornece contexto humano; não é classificação automática nem prova de reincidência. Membros podem denunciar publicações públicas aprovadas de outras contas; uma denúncia aberta por conta/criação e limites de envio. Classificar denúncia não altera publicação automaticamente. A revisão do conteúdo ocorre na fila correspondente. Contato para recurso: development@nichodev.com.

## Estatísticas e limites

Estatísticas de 30 dias em UTC: cadastros por dia, contas ativas por dia, retorno exato no sétimo dia de coortes já maduras, presets aplicados declarados pelo navegador, publicações aprovadas e bytes de áudio. A atividade diária usa somente ID/dia (90 dias); última atividade é arredondada para a hora. Aplicações de preset são agregadas por criação/dia, limitadas a uma por conta/preset a cada 24 h, sem registrar quem aplicou no agregado. Não comprovam resultado audível. Não há histórico de navegação, endereço IP ou user agent nas métricas. Não se inventam dados anteriores à instrumentação.

Configurações persistem por ambiente: cadastros/publicações abertos, mensagem, regras, cota por WAV (até o teto de 10 MiB do parser), por conta, no ambiente, limite de criações e recursos de denúncias/recuperação assistida. Percentual de liberação de 0–100 seleciona uma parcela estável de contas pelo hash do ID. Não muda o fluxo direto de recuperação. Limites crescentes são validados, alterações exigem motivo, versão atual e auditoria. Reduzir uma cota não apaga arquivos existentes. Novos envios respeitam a nova cota. Regras são texto simples, nunca HTML executável.

## Operações e auditoria

Painel de backups é somente leitura. Não existe endpoint/botão de restauração. Lê da pasta privada deste ambiente:

- `latest.sqlite`: data do arquivo; presença não comprova integridade.
- `backup-status.json`: última execução de `manage.js backup` cujo destino é exatamente `latest.sqlite`; a rotina verifica integridade na cópia.
- `offsite/last-success.json`: última cópia R2 com download e integridade verificados e domínio correspondente.
- `offsite/status.json`: último resultado R2, inclusive falhas.
- `restore-status.json`: último ensaio isolado de restauração, incluindo limpeza e preservação do original.
- `monitor-state.json`: último resultado do monitor existente.

Recibos ausentes/inválidos aparecem sem confirmação. Falhas e sucesso são registros distintos; um sucesso anterior não apaga uma falha mais nova. Atualize as cópias operacionais dos scripts na pasta privada: publicar somente o Node não atualiza cron/scripts externos. Agendas não são criadas ou alteradas pelo código.

Saúde: p95 dos últimos 256 pedidos da API, erros 5xx/pedidos desde início, pedidos em andamento, RSS do processo, leitura do banco, bytes SQLite/WAL, espaço livre no volume, áudio e sessões vigentes. São métricas do processo, não do plano inteiro. Sessões não são conexões TCP; SQLite usa uma conexão por processo. Resumo agregado `server-health.json` é gravado a cada minuto e não é servido publicamente. O monitor existente consulta resumo recente, latência HTTP, cota de áudio, disco e falhas de recibos; usa o transporte/limite de notificações já configurado. Alertas: p95/HTTP acima de 1 s, RSS acima de 512 MiB, áudio acima de 80%, menos de 1 GiB livre no painel, disco abaixo de 10% no monitor e backups sem confirmação em 36 h. Ajuste operacional após medir o plano; não são SLA nem teste de carga.

Auditoria retida por 365 dias registra ator, ação, alvo, motivo, resultado e horário. Alteração e registro de sucesso são transacionais. Recusas administrativas autenticadas também são registradas sem corpos de pedidos, senhas, códigos ou tokens. Não há exclusão no painel nem alegação de trilha inviolável: quem controla o SQLite/servidor pode alterá-la. Histórico de moderação dura 365 dias, denúncias 180 e notificações 90. Evidências vencidas não contam como histórico completo de toda a vida da conta.

## Validação e publicação

Execute `npm run check`, `npm test`, `npm run test:community` e `npm run test:preview`. Os testes novos cobrem os vetores SHA-1 da RFC, repetição/expiração de MFA, códigos de emergência, 1.100 contas, limites de papéis, suspensão e sessões, recuperação aprovada de uso único, conflito de moderação, motivos/notificações, configurações, métricas e ausência de recibos. Os testes de navegador usam contas e bancos descartáveis.

Antes de publicar: autorização específica, backup consistente e cópia isolada; validar migração/proprietário, MFA com chave guardada e códigos de emergência, atualização dos scripts operacionais, recibos reais, rotas privadas e reabertura. Homologação primeiro, com seus próprios usuários/dados. Nunca copiar banco de homologação para produção. Executar encaminhamento dos HTML públicos conforme `PRODUCTION.md`.

**Retorno:** conservar todas as tabelas adicionadas e o banco atual. Código anterior ignora suspensão, papéis e MFA e interpreta a coluna legada `admin` como acesso total: voltar para ele reabre privilégios de moderadores e contas suspensas. Não fazer rollback silencioso; fechar a comunidade/restringir acesso antes e usar uma versão que preserve estes controles. Não restaurar banco antigo para voltar código.
