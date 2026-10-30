# Proteções da comunidade

O backend usa sessões próprias e SQLite privado. A segurança não depende de Supabase nem de regras no navegador. Não há novas dependências npm nesta implementação.

## Limites compartilhados

`security_config` mantém uma chave aleatória persistente de 256 bits para identificar contadores sem guardar IP ou login em texto. `limits` atualiza as cotas com uma instrução SQL atômica; os workers e reinícios usam a mesma chave. As operações autenticadas combinam a cota do IP com a da conta. Os limites específicos anteriores de cadastro, login, recuperação, avaliações e upload permanecem.

Login também admite até 30 tentativas por minuto para o mesmo nome de usuário, e recuperação até 10 por minuto, independentemente da origem. A espera expira em até um minuto; não se grava um bloqueio permanente de conta. Isso reduz tentativas distribuídas, mas um atacante persistente ainda pode disputar disponibilidade: monitorar falsos positivos e abuso continua necessário.

O ambiente permite até 60 tarefas de autenticação por minuto e duas simultâneas, somando consultas de nova senha e cálculos scrypt de todos os processos. `security_leases` reserva essas vagas em transação, libera ao concluir e expira reservas de processos que morreram em até dois minutos. Falhas de banco/limite não autorizam trabalho por padrão. Em um restart/disaster recovery, pode haver uma espera temporária por reservas antigas.

## Áudio

- 120 leituras por minuto por IP e, quando autenticado, por conta.
- 32 MiB de bytes reservados por minuto por IP/conta e 128 MiB por minuto no ambiente. A reserva considera o intervalo solicitado e pode consumir orçamento mesmo que o cliente abandone a transferência ou não haja vaga.
- Quatro respostas de áudio simultâneas no ambiente e duas por IP/conta; cada transferência encerra em até 30 segundos. As reservas são liberadas tanto na conclusão como no fechamento da conexão.
- HEAD verifica autorização e informa tamanho sem selecionar o BLOB. GET aceita um intervalo `bytes` por requisição (206); intervalos inválidos ou múltiplos recebem 416. If-Range sem um validador disponível leva à resposta integral. SQL `substr` seleciona somente o intervalo solicitado, sem criar outra cópia completa do áudio em Buffer.
- Áudios privados, não listados e públicos continuam passando pela mesma autorização antes de fornecer bytes ou metadados. Não há cache público introduzido: assim uma alteração de visibilidade/moderação não deixa uma cópia pública nesta camada.

Esses números são limites iniciais para o plano atual, não uma garantia de capacidade nem proteção completa contra DDoS. Medir uso antes de elevar as cotas ou replicar o banco em outros servidores. Não replicar SQLite local em múltiplas máquinas esperando que essas tabelas continuem compartilhadas.

## Senhas e administração

Novas senhas (cadastro, alteração e recuperação) são consultadas no serviço gratuito Pwned Passwords por k-anonimato. Somente os cinco primeiros caracteres do SHA-1 são enviados por HTTPS, com padding; senha, login, hash completo e chave de recuperação não são enviados. SHA-1 é usado apenas para essa consulta: o armazenamento continua com scrypt e salt.

Há timeout de cinco segundos, teto de 2 MiB de resposta e validação do formato. Falha ou resposta inválida impede salvar a nova senha (503), sem alterar a senha/chave anterior. Login e confirmação da senha existente não dependem do serviço externo e não passam a recusar uma senha antiga por estar na lista. Os testes usam uma consulta simulada; `scripts/test-community-load.cjs` também evita chamar serviços externos em seu cenário descartável.

O painel administrativo exige uma senha confirmada nos últimos dez minutos. Sessões antigas continuam válidas para funções comuns, mas exigem confirmação para administrar. `session_auth` guarda a confirmação separada, sem mudar as três colunas de `sessions`, preservando compatibilidade de leitura/escrita com a versão anterior. Logout, troca de senha e exclusão removem os registros por chave estrangeira.

Esse reforço é reautenticação, **não um segundo fator**. A senha administrativa deve ser exclusiva; MFA/passkeys podem ser uma entrega posterior. O código nunca mostra a senha administrativa nem a grava no armazenamento do navegador.

## GitHub e backups

Em 30/10/2026, o grafo de dependências e Dependabot alerts foram habilitados no painel. Secret Protection e Push protection já estavam habilitados. O calendário de atualizações de versão continua em `.github/dependabot.yml`; nenhuma integração adicional de IA ou serviço pago foi ativada.

No bucket privado `nichodev-community-backups`, a regra `community-backups-retention-30-days` foi habilitada para todos os objetos, impedindo sobrescrita/exclusão antes dos 30 dias de idade. O lifecycle existente continua removendo objetos após 30 dias, sujeito ao ciclo de execução do provedor. Como os nomes são criptografados, a regra cobre o bucket todo, sem depender de um prefixo legível de produção. O token da hospedagem é de objetos, não de alteração de regras do bucket. Não o ampliar.

O script rclone continua criando nomes únicos e verificando o download; o bloqueio não exige sobrescrever ou excluir backups. Bloqueio de retenção não impede que um administrador da conta Cloudflare altere a regra. Proteja o acesso ao painel e mantenha o kit de recuperação fora da hospedagem.

## Publicação e retorno

Antes de publicar, criar backup consistente, testar em homologação e conferir saída HTTPS para `api.pwnedpasswords.com`. O login existente continua funcionando se a consulta estiver indisponível; cadastro e troca de senha aguardam sua recuperação. Atualizar backend, interface e documentação no mesmo pacote validado.

O início cria apenas tabelas adicionais (`security_config`, `security_leases`, `session_auth`); não remove contas, arquivos, sessões ou colunas. No primeiro upgrade, contadores antigos baseados em chave efêmera não podem ser recuperados e deixam de representar a nova cota; daí em diante ela persiste. Retorno de código à versão anterior continua possível, mas remove os novos reforços. Não restaure um banco antigo para simplesmente reverter código.

O teste de restauração compara todos os registros/áudios antes de abrir a aplicação; depois zera somente os contadores/reservas da cópia descartável para não gastar a cota de produção ao validar muitos áudios. Banco ativo e backup original não são modificados.

O backend HTTPS envia HSTS por um ano, sem includeSubDomains/preload. HTML e APIs passam pela aplicação; assets atendidos antes do Node dependem também da configuração do provedor. Validar o cabeçalho nas páginas públicas após publicar; não ativar HSTS em um domínio sem HTTPS estável.

## Verificação

`npm run test:community` inclui os testes de persistência/reinício, quatro processos concorrentes, reservas, IP/conta, cota global, recuperação, falha de consulta externa, autorização de mídia, HEAD/Range, HSTS e sessão administrativa. `npm run test:preview` cobre a confirmação/cancelamento administrativo em Chromium, Firefox e WebKit. Esses testes não substituem monitoramento nem teste prolongado no plano real.

Referências: [Pwned Passwords](https://haveibeenpwned.com/API/v3#PwnedPasswords), [R2 Bucket Lock](https://developers.cloudflare.com/r2/buckets/bucket-locks/), [OWASP Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).
