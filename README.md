# nichodev.com

Ferramentas para gravar, processar e mixar áudio no navegador, com visual retrô em 8 bits. O projeto reúne Voice Studio, Guitar FX LAB, MIXMASTER, uma onda interativa e dois plugins VST3 para Windows e Linux. Acesse [nichodev.com](https://nichodev.com).

## Ferramentas

| Ferramenta | Uso | Código |
| --- | --- | --- |
| [Voice Studio](https://nichodev.com/voz.html) | Gravação, importação e processamento de voz | [voz.html](public/voz.html), [public/js/voz.js](public/js/voz.js) |
| [Guitar FX LAB](https://nichodev.com/guitarra.html) | Pedaleira, afinador e gravação de guitarra | [guitarra.html](public/guitarra.html), [public/js/guitarra.js](public/js/guitarra.js) |
| [MIXMASTER](https://nichodev.com/mixmaster.html) | Edição de áudio, regiões MIDI, envelopes e mixagem | [mixmaster.html](public/mixmaster.html), [public/js/mixmaster.js](public/js/mixmaster.js) |
| [Onda de gratidão](https://nichodev.com/onda/) | Animação interativa com mouse, toque e teclado | [public/onda/README.md](public/onda/README.md) |

Na página inicial, **START** abre o Voice Studio, **SELECT** abre o Guitar FX LAB, **MIX/MASTER** abre o editor e **DOWNLOAD VST** abre as instruções de download e instalação. As legendas dos botões aparecem ao passar o ponteiro ou focá-los pelo teclado, com um glitch breve que respeita a preferência por redução de movimento. O guia no rodapé continua disponível.

A [suite VST3](plugin/README.md) contém **Nichodev Guitar FX**, com 15 pedais, e **Nichodev Deluxe 65 Amp**, com canais Clean/Dirty, reverb de mola e vibrato de afinação. Baixe os pacotes Windows ou Linux na [página de downloads](https://nichodev.com/downloads.html), com links diretos e instruções para o Reaper ou outra DAW VST3. Os arquivos permanecem nos [GitHub Releases](https://github.com/nichodevs/nichodev.com/releases/latest).

## Executar o site

Requer Node.js 24 ou superior e npm. Na raiz do repositório:

```sh
npm ci
npm start
```

Abra [http://localhost:3000](http://localhost:3000). A variável `PORT` permite escolher outra porta. O servidor Express também oferece `/health` e `/api/status`; a publicação na Hostinger usa os arquivos estáticos.

A gravação requer permissão de microfone e uma página em HTTPS ou `localhost`.

## Projetos e áudio no MIXMASTER

- O projeto fica no `localStorage` e os áudios no IndexedDB deste navegador e desta origem. Não há sincronização automática entre navegadores ou dispositivos; limpar os dados do site pode remover o trabalho salvo. Mantenha um **BACKUP** fora do navegador.
- Se o salvamento do projeto falhar, um aviso permanece visível com um botão de backup, e o navegador pede confirmação ao sair. O aviso só desaparece quando o salvamento local volta a funcionar.
- Ajustes de volume, ganho, pan e efeitos podem ser desfeitos por gesto; os atalhos do editor preservam botões, campos e links focados.
- **BACKUP** baixa um arquivo `.nichodev.json` com o projeto e seus áudios, para recuperação ou transferência entre navegadores.
- Se o armazenamento falhar, o áudio fica temporário na aba. Use o download de recuperação do clipe selecionado ou **BACKUP** antes de sair; o aviso de salvamento distingue essa situação.
- As uniões preservam o áudio interno em WAV float32. **EXPORTAR WAV** renderiza a mixagem em PCM16 estéreo, com até dez minutos de conteúdo e a cauda dos efeitos ao final.
- Backups importados aceitam linhas do tempo de até 24 horas. A limpeza de áudio preserva o projeto e os históricos de desfazer/refazer; a remoção em disco exige suporte a Web Locks e uma única aba de edição.

No Guitar FX LAB, ajustar parâmetros reutiliza os nós existentes e preserva os ecos. RV-6 e SHIMMER controlam o nível de caudas fixas de 2 e 4,4 segundos.

As ferramentas web usam o áudio do navegador; os VST3 são instalados separadamente em uma DAW. Os pacotes atuais são de 64 bits para Windows e Linux x86_64. O build Linux depende da compatibilidade da distribuição e da DAW; ainda não há pacote para macOS.

## Verificar alterações

```sh
npm test
npm run check
npx playwright install chromium firefox webkit
npm run test:e2e
```

No Linux, use `npx playwright install --with-deps chromium firefox webkit` para instalar também as bibliotecas de sistema. O Playwright inicia o servidor local automaticamente quando necessário.

- `npm test`: verifica a descoberta de módulos e rejeita dependências ausentes ou sem upload SFTP.
- `npm run check`: sintaxe JavaScript, IDs, referências locais e cobertura dos arquivos enviados por SFTP.
- `npm run test:e2e`: suíte completa no Chromium e cenários essenciais em Firefox/WebKit. A suíte essencial também roda no Chromium e cobre navegação, importação WAV, reprodução real, restauração pelo IndexedDB, backup e recuperação sem armazenamento.
- Para rodar um motor: `npm run test:e2e -- --project=firefox` (ou `chromium` / `webkit`). Para somente os cenários essenciais nos três: `npm run test:e2e -- compatibility.spec.js`.
- O CI instala os três motores e prepara uma saída virtual PulseAudio para o processamento real, sem precisar de placa de som. Uma falha em qualquer cenário bloqueia a publicação. Traces e capturas de falhas ficam em artefatos por sete dias.
- Os cenários essenciais usam um perfil temporário normal por teste, descartado ao encerrar. Isso permite testar blobs no IndexedDB do WebKit; suas sessões privadas têm uma [limitação conhecida](https://github.com/microsoft/playwright/issues/42795). O cenário de armazenamento indisponível verifica a recuperação separadamente.
- WebKit no Linux não equivale a Safari/iOS em um dispositivo real. Esses testes usam WAV PCM e não validam todos os codecs, gravação por microfone, drivers ou qualidade audível; a prévia de voz carrega a biblioteca Tone.js dos CDNs usados pelo site.
- Os testes do MIXMASTER cobrem falha de armazenamento, recuperação, precisão após reabrir, envelopes, MIDI/BPM, transporte, exclusão e limpeza com histórico e outra aba.
- O Guitar FX LAB verifica o gate NS-2 e a preservação dos efeitos com `OfflineAudioContext`.
- Os testes dos VST3 e os comandos CMake estão em [plugin/README.md](plugin/README.md).

## Comunidade

A [comunidade pública](https://nichodev.com/comunidade/) oferece contas, avaliações privadas, presets e prévias compartilháveis, paletas vinculadas ao usuário e moderação. Consulte o [guia da comunidade](community/README.md). Execute `npm run preview:community` e abra `http://127.0.0.1:3200/comunidade/`. Contas, avaliações privadas, presets completos e prévias WAV são persistidos em SQLite na pasta privada `.data/community`; não são dados apenas da aba. O cadastro exige guardar a chave de recuperação antes de ativar a conta.

A API tem testes próprios (`npm run test:community`) e a interface é validada em Chromium, Firefox e WebKit (`npm run test:preview`). Os arquivos da comunidade ficam fora de `public/` e não são enviados pelo SFTP. A [homologação online](https://cornflowerblue-lapwing-604910.hostingersite.com/comunidade/) usa uma aplicação Node.js separada na Hostinger, com HTTPS e banco privado persistente. As contas e gravações locais não são migradas automaticamente; consulte o guia para operação e backup. A extração do sintetizador MIDI compartilhado mantém o exemplo e o MIXMASTER usando a mesma rotina.

## Organização

- `public/`: arquivos do site, servidos pelas mesmas URLs públicas.
- `public/js/`: áudio, edição e navegação do site.
- `public/js/mixmaster/`: armazenamento, formato dos backups e regras de duração/notas compartilhadas do MIXMASTER.
- `community/`: API, persistência, controle de acesso e administração da comunidade.
- `prototypes/community/`: interface da comunidade servida pelo backend.
- `public/assets/cursors/`: cursores retrô.
- [public/onda/](public/onda/README.md): página da onda de gratidão.
- [plugin/](plugin/README.md): JUCE/CMake, dois VST3, testes e notas de release.
- `scripts/` e `tests/e2e/`: validação do site e testes Playwright.
- `.github/workflows/`: validação, builds, releases e deploy.
- `build/`: saída local do CMake, ignorada pelo Git.

## Buscas e compartilhamentos

As seis páginas públicas incluem descrição, URL canônica, Open Graph e Twitter Cards no HTML estático. O cartão comum está em `public/assets/social-card.png` (1200 × 630). O [sitemap](https://nichodev.com/sitemap.xml), anunciado em `robots.txt`, lista as mesmas URLs canônicas. Ao criar uma página, atualize seus metadados, o sitemap e os testes de SEO em conjunto.

Os testes verificam os metadados sem JavaScript, a imagem PNG e sua inclusão no deploy. A indexação e a atualização das prévias dependem dos buscadores e dos caches de cada plataforma.

## Publicação

**Site e comunidade:** a publicação usa o pacote Node.js completo da `main`, gerado por [Preparar pacote da comunidade](.github/workflows/community-package.yml) após validar o mesmo commit. O envio à Hostinger continua sendo uma ação explícita. O SFTP antigo e o deploy Git direto estão desativados para evitar concorrência.

Produção e [homologação](https://cornflowerblue-lapwing-604910.hostingersite.com/comunidade/) mantêm aplicações, pastas privadas, contas e backups separados. Integrar código não copia dados nem publica automaticamente. Consulte [DEPLOYMENT.md](DEPLOYMENT.md) para atualizar páginas, assets e o backend, e [community/PRODUCTION.md](community/PRODUCTION.md) para operação, retorno e recuperação. A validação dos PRs continua ativa.

**VST3:** o workflow [Compilar plugin de áudio](.github/workflows/plugin.yml) compila e testa Windows/Linux em PRs e pushes para `main` que alterem `plugin/**` ou o próprio workflow; arquivos Markdown são excluídos dos gatilhos. Na `main`, os dois builds aprovados permitem publicar a versão declarada no CMake; um release já publicado é preservado. Mudanças apenas documentais mantêm as versões dos binários.

Os ZIPs dos releases são os downloads permanentes. Os artefatos das Actions expiram após 14 dias. Veja o [processo de release](plugin/RELEASING.md), o [guia do Deluxe 65](plugin/DELUXE_65.md) e o [diagnóstico em DAWs](plugin/TROUBLESHOOTING.md).


Os limites compartilhados, consultas de senhas comprometidas, proteção administrativa e retenção de backups estão descritos em [community/SECURITY.md](community/SECURITY.md).
