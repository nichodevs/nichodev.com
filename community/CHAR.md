# NICO//CHAR — ID CARD / CHAR LAB

Implementação da direção visual do book de referências: peças originais em pixel art, monocromia com uma cor opcional e integração com o SQLite existente. Esta mudança prepara o código; não publica na Hostinger.

## Experiência

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

Membros, perfis, comentários e filas aceitam páginas de 1–100 registros, padrão 25. As listas de criações continuam com os limites existentes. Joins e índices evitam buscar um PNG por autor ou carregar milhares de personagens de uma vez.

## Validação e publicação

`community/tests/char.test.js` verifica catálogo, renderização, GIF, persistência, isolamento, conflitos, limites de acesso, privacidade de desenhos, MFA, denúncias, conquistas, comentários e cascata. `tests/preview/char.spec.js` exercita editor, teclado, exportações, mobile, movimento reduzido, falha de salvamento, identidade e moderação nos três navegadores do CI. O GIF também deve abrir em um decodificador independente.

Antes de publicar: CI completo aprovado, backup consistente do ambiente, homologação autorizada, comparação dos registros originais, teste de cadastro/sessões/MFA existentes e validação de todas as novas áreas com contas descartáveis. Remover só os dados de teste, executar backups e restauração isolada incluindo as novas tabelas. Manter produção e homologação separadas e executar `route-public-html.cjs` depois do deploy de produção, conforme `PRODUCTION.md`. Toda chave SSH temporária deve ser revogada e testada ao concluir.

Retornar ao código anterior não exige restaurar banco nem apagar tabelas. Porém ele não mostra chars/comentários nem aplica as novas revisões; preserve a base e avalie o fechamento das novas interações antes de qualquer retorno. Integrar o PR não publica automaticamente.
