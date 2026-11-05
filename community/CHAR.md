# NICO//CHAR — ID CARD / CHAR LAB

Implementação da direção visual do book de referências: peças originais em pixel art, monocromia com uma cor opcional e integração com o SQLite existente. Publicado na homologação e em produção em 04/11/2026, após validação independente dos dois ambientes. Novas integrações de código continuam sem publicação automática.

## Experiência

O cabeçalho também mostra o quadradinho do CHAR ao lado do botão de conta: padrão para visitantes, personagem salvo para a conta conectada e atalho para o CHAR LAB. Ao sair ou trocar de conta, a imagem anterior é limpa.

- `#char`: editor aberto também como prévia para visitantes; somente contas autenticadas salvam. As mudanças ficam na prévia até **SALVAR CHAR**. Há descartar, padrão, desfazer/refazer (50 estados) e aviso de saída sem salvar.
- `#estudio`: ID card de 128×128 CSS px com nome, classe visual, nível cosmético e acesso à personalização.
- `#perfil/usuario`: personagem e criações públicas aprovadas, paginadas. Avatar do autor também acompanha presets, galeria e comentários.
- `#membros`: personagens que os usuários escolheram tornar públicos, com busca por prefixo e paginação. Contas sem char publicado não entram nessa lista.
- Nenhuma classe, nível, badge ou recompensa aumenta permissões, visibilidade ou recursos técnicos. Não há ranking compulsório.

O catálogo tem 4 estilos (Atari Minimal, Pocket RPG, Underground Hacker e Cyber Mascot), 12 temas prontos, 7 corpos, 22 cabelos/cabeças, 9 olhos, 8 rostos, 22 roupas, 23 acessórios incluindo opções sem item, 13 poses, 6 paletas, 19 cenários, 8 molduras, 8 companions mais a opção sem companion, 10 emotes mais nenhum e 9 efeitos mais nenhum. O modo Atari usa uma silhueta de baixa resolução; as peças normais compartilham âncoras de 32×48 pixels num card de 64×64 pixels lógicos. A ampliação não usa suavização. Todos os sprites são desenhados por código a partir de peças fixas; não há serviço de IA, imagens remotas ou sprites de jogos copiados.

Retrato usa fundo simples; mini cena mostra o ambiente; badge card alinha avatar e identificação; idle display permite a apresentação animada. A animação discreta usa quatro quadros ao passar o mouse ou focar a prévia; sair pausa. Há controle para desativá-la. `prefers-reduced-motion` e aba oculta são respeitados. Miniaturas do feed são estáticas.

O mini estúdio permite escolher mesa, computador, guitarra, caixas de som, poster, luzes e posição do companion dentro de coordenadas limitadas. Outros cenários, molduras, paletas, poses, emotes e efeitos são selecionados no catálogo. Um companion por personagem; posições lado, ombro, flutuando ou rodapé.

## Desenho e exportação

O editor livre usa grade 16×16 ou 32×32, lápis, borracha, preenchimento contíguo e espelhamento horizontal. Mouse, toque e teclado são suportados: setas movem o cursor, Espaço/Enter pinta e Z desfaz. Redimensionar reamostra o desenho; voltar às peças remove o desenho da prévia, com desfazer disponível. A grade nunca vai para a imagem final.

PNG transparente (256×256), PNG do card com ambiente e GIF transparente (128×128, até quatro quadros) são gerados e baixados pelo navegador. O GIF usa uma paleta pequena e códigos de limpeza para manter o codificador simples e limitado, sem dependência de compressão. Não se armazena arquivo exportado no servidor ou no R2 privado de backups. Movimento reduzido desativa a reprodução na página; o botão de GIF é uma exportação solicitada explicitamente.

## Conquistas

O servidor libera marcos cosméticos e os conserva em `char_unlocks`:

| Marco | Evidência / liberação |
| --- | --- |
| Primeiro preset público | Preset existente enviado com visibilidade pública; cenário terminal |
| Criação aprovada | Criação pública aprovada; olhos glitch |
| 10 favoritos | Dez favoritos existentes; fone raro |
| 7 dias seguidos | Sete dias UTC consecutivos no registro diário já existente |
| Personagem criado | Personalização salva |
| Ferramenta explorada | Abertura declarada de Voz, Guitarra ou MIXMASTER; não comprova áudio nem uso completo |
| Halloween, Natal, aniversário e desafio | Concessão explícita por proprietário, com MFA, motivo e auditoria; respectivos cenários/capa |

O nível é `1 + quantidade de marcos liberados`. Até três badges conquistadas podem ser equipadas. Não se aceita badge ou item bloqueado enviado pelo navegador. Não há evento ou desafio fictício: a equipe só concede os cosméticos após verificar a participação real. O sistema não registra uma trilha de visitas às ferramentas.

## Dados e segurança

`user_chars` guarda JSON versionado, revisão numérica, data, estado, motivo e uma cópia separada da aparência pública aprovada. `char_unlocks` guarda marcos. `char_reports` guarda denúncias por até 180 dias. As novas tabelas são adicionais; não alteram as colunas nem removem dados das tabelas existentes. Todas são vinculadas à conta com exclusão em cascata. A exportação privada inclui personagem, conquistas, comentários e denúncias feitas pelo titular.

`community/char-format.js` é o catálogo e validador compartilhado. O backend aceita somente schema 1, IDs cadastrados, limites de texto, booleanos, coordenadas e desenho de 256 ou 1024 índices de uma paleta limitada. Não aceita PNG, SVG, HTML, URLs externas ou arquivos executáveis como avatar. O limite JSON existente de 32 KiB e as proteções de origem, sessão e requisições continuam aplicados. Salvar exige a revisão atual; conflito retorna 409. Respostas antigas não são aplicadas a outra conta no navegador, e uma edição feita durante o salvamento continua como alteração não salva.

Sem registro, ou com char oculto, a interface usa o personagem padrão. Ocultar remove a aparência pública imediatamente. Um desenho novo fica privado e pendente, mantendo a última aparência pública aprovada. A API de criações, perfis, membros e comentários só inclui essa cópia pública; nunca inclui o desenho pendente de outra pessoa. O autor vê sua própria prévia em Meu Estúdio.

O painel administrativo tem filas **NICO//CHAR** e **COMENTÁRIOS**, acessíveis aos papéis que já moderam publicações, com MFA e senha recentes. Revisar exige versão e motivo, gera notificação e auditoria e pode aprovar, ocultar ou reabrir. Reenvio após ocultação volta à revisão mesmo quando é modular. As denúncias de char têm fila paginada e uma denúncia aberta por autor/alvo. Bloqueio de publicação e fechamento da comunidade impedem novas aparências públicas e comentários; a opção de ocultar o próprio char permanece disponível. A revisão de um char não muda a decisão sobre as criações do autor.

Comentários pertencem a criações públicas aprovadas: até 600 caracteres, limite de 10 envios/hora, paginação e revisão antes da publicação. O autor pode consultar os próprios comentários pendentes/ocultos e excluir os seus com a revisão atual. HTML é mostrado como texto. Nenhum visitante vê pendências de outra conta. Moderadores usam a fila de comentários; recursos e denúncias de comentários podem indicar criação/texto para development@nichodev.com. Excluir a conta ou a criação remove seus comentários conforme as chaves estrangeiras.

Membros, perfis, comentários e filas aceitam páginas de 1–100 registros, padrão 25. Criações públicas, Meu Estúdio e Favoritos têm paginação de 25 itens na interface; a API aceita até 100 por página e aplica os filtros antes de paginar. Favoritos são consultados diretamente, inclusive quando a criação saiu das primeiras páginas públicas. Joins e índices evitam buscar um PNG por autor ou carregar milhares de personagens de uma vez.

## Validação e publicação

`community/tests/char.test.js` verifica catálogo, renderização, GIF, persistência, isolamento, conflitos, limites de acesso, privacidade de desenhos, MFA, denúncias, conquistas, comentários e cascata. `tests/preview/char.spec.js` exercita editor, teclado, exportações, mobile, movimento reduzido, falha de salvamento, identidade e moderação nos três navegadores do CI. O GIF também deve abrir em um decodificador independente.

Antes de publicar: CI completo aprovado, backup consistente do ambiente, homologação autorizada, comparação dos registros originais, teste de cadastro/sessões/MFA existentes e validação de todas as novas áreas com contas descartáveis. Remover só os dados de teste, executar backups e restauração isolada incluindo as novas tabelas. Manter produção e homologação separadas e executar `route-public-html.cjs` depois do deploy de produção, conforme `PRODUCTION.md`. Toda chave SSH temporária deve ser revogada e testada ao concluir.

Retornar ao código anterior não exige restaurar banco nem apagar tabelas. Porém ele não mostra chars/comentários nem aplica as novas revisões; preserve a base e avalie o fechamento das novas interações antes de qualquer retorno. Integrar o PR não publica automaticamente.

## Publicação verificada em 04/11/2026

Código integrado em `f1818728710a61c2d020904de501a5e3620f9d6b`. [Workflow do pacote aprovado](https://github.com/nichodevs/nichodev.com/actions/runs/41831464788), além dos 226 testes do [CI do recurso](https://github.com/nichodevs/nichodev.com/actions/runs/41828365103). Os dois ZIPs publicados têm SHA-256 `d3ab796a12f642a08542eccf2335b30de17f69db2fe2681ae39c34c2404df71c`; os 141 arquivos foram comparados com o pacote antes do encaminhamento dos HTML de produção.

| Ambiente | Pacote | Build |
| --- | --- | --- |
| [Homologação](https://cornflowerblue-lapwing-604910.hostingersite.com/comunidade/#char) | `community-homologacao_20261104_125200.zip` | `01a1a6b1-688f-7163-8bf2-9cf8611e7140` |
| [Produção](https://nichodev.com/comunidade/#char) | `community-producao_20261104_125200.zip` | `01a1a6b8-6829-70b4-9e3c-c43e43f52358` |

Homologação passou antes da ativação em produção. Nos dois ambientes, contas descartáveis exercitaram TOTP real, permissões, módulos administrativos existentes, salvamento e conflitos, catálogo/itens bloqueados, perfis e membros, conquistas e concessão de evento, desenhos 16×16 e 32×32 privados até aprovação, preservação da aparência pública anterior, comentários moderados, denúncias, ocultação, revisão, notificações e auditoria. A sequência de dias foi preparada somente na atividade diária da conta descartável; não se fabricaram conquistas de contas reais.

A interface publicada passou em desktop e celular: edição, companion, mini estúdio, lápis por teclado, espelhamento, preenchimento, borracha, desfazer, perfis, membros, comentários como texto e movimento reduzido, sem erros de JavaScript. PNG transparente e GIF de quatro quadros exportados pelo navegador foram decodificados independentemente. Produção também passou nas páginas públicas, HSTS/CSP, bloqueio de arquivos privados e redirecionamento permanente de `www` com caminho/consulta, após `route-public-html.cjs`.

Backups consistentes foram executados antes e depois. Os últimos R2 após limpeza dos testes foram verificados em 04/11/2026 às 13:18:00 UTC na homologação e 13:23:43 UTC em produção: criptografia, download e integridade aprovados. A restauração isolada validou todas as tabelas e áudios, chaves estrangeiras, leitura/escrita pela aplicação e acesso privado; removeu sua cópia sem alterar o backup original. Monitores consultados estavam saudáveis.

As contas descartáveis e auxiliares privados de teste foram removidos. Quantidades e SHA-256 das seis tabelas originais (`users`, `creations`, `media`, `favorites`, `user_palettes`, `feedback`) coincidiram com a referência anterior: homologação preservou 5 contas, 4 criações, 1 áudio, 2 paletas e 1 avaliação; produção preservou sua conta própria. Não houve cópia entre bancos nem uso da senha real do administrador.

O envio pelo controle do navegador travou; o usuário selecionou os ZIPs manualmente no hPanel. A versão ativa foi conferida pelos arquivos, build e respostas reais. A chave temporária `nichodev-nico-release-20261104` foi removida do hPanel, nova conexão foi recusada (`Permission denied`, exit 255) e a cópia privada local foi apagada. Recibos detalhados e snapshots permaneceram nas pastas privadas de cada ambiente. Não houve teste prolongado de carga em produção.
