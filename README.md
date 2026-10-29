# nichodev.com

Estúdio de áudio para navegador e dois plugins VST3 para DAWs, com visual retrô em 8 bits. Acesse [nichodev.com](https://nichodev.com).

## Ferramentas

| Ferramenta | Uso | Código |
| --- | --- | --- |
| [Voice Studio](https://nichodev.com/voz.html) | Gravação, importação e processamento de voz | [voz.html](public/voz.html), [public/js/voz.js](public/js/voz.js) |
| [Guitar FX LAB](https://nichodev.com/guitarra.html) | Pedaleira, afinador e gravação de guitarra | [guitarra.html](public/guitarra.html), [public/js/guitarra.js](public/js/guitarra.js) |
| [MIXMASTER](https://nichodev.com/mixmaster.html) | Edição de áudio, regiões MIDI, envelopes e mixagem | [mixmaster.html](public/mixmaster.html), [public/js/mixmaster.js](public/js/mixmaster.js) |
| [Onda de gratidão](https://nichodev.com/onda/) | Animação interativa com mouse, toque e teclado | [public/onda/README.md](public/onda/README.md) |

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

- O projeto fica no `localStorage` e os áudios no IndexedDB deste navegador e desta origem.
- **BACKUP** baixa um arquivo `.nichodev.json` com o projeto e seus áudios, para recuperação ou transferência entre navegadores.
- Se o armazenamento falhar, o áudio fica temporário na aba. Use o download de recuperação do clipe selecionado ou **BACKUP** antes de sair; o aviso de salvamento distingue essa situação.
- As uniões preservam o áudio interno em WAV float32. **EXPORTAR WAV** renderiza a mixagem em PCM16 estéreo, com até dez minutos de conteúdo e a cauda dos efeitos ao final.
- Backups importados aceitam linhas do tempo de até 24 horas. A limpeza de áudio preserva o projeto e os históricos de desfazer/refazer; a remoção em disco exige suporte a Web Locks e uma única aba de edição.

No Guitar FX LAB, ajustar parâmetros reutiliza os nós existentes e preserva os ecos. RV-6 e SHIMMER controlam o nível de caudas fixas de 2 e 4,4 segundos.

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

## Organização

- `public/`: arquivos do site, servidos pelas mesmas URLs públicas.
- `public/js/`: áudio, edição e navegação do site.
- `public/js/mixmaster/`: armazenamento, formato dos backups e regras de duração/notas compartilhadas do MIXMASTER.
- `public/assets/cursors/`: cursores retrô.
- [public/onda/](public/onda/README.md): página da onda de gratidão.
- [plugin/](plugin/README.md): JUCE/CMake, dois VST3, testes e notas de release.
- `scripts/` e `tests/e2e/`: validação do site e testes Playwright.
- `.github/workflows/`: validação, builds, releases e deploy.
- `build/`: saída local do CMake, ignorada pelo Git.

## Publicação

**Site:** o workflow [Publicar site na Hostinger](.github/workflows/deploy.yml) valida o mesmo commit com `npm run check` e Playwright antes do SFTP. Uma falha impede o envio. As publicações são serializadas e terminam com conferência HTTP.

Ele roda manualmente, diariamente às 09:00 UTC (06:00 em Brasília) e em pushes para `main` que atinjam seus filtros de arquivos. Os filtros incluem `public/**` e o workflow de deploy, com arquivos Markdown excluídos: editar um README não publica o site por push. A validação dos PRs continua ativa. Consulte [DEPLOYMENT.md](DEPLOYMENT.md) ao adicionar ou renomear páginas e assets.

**VST3:** o workflow [Compilar plugin de áudio](.github/workflows/plugin.yml) compila e testa Windows/Linux em PRs e pushes para `main` que alterem `plugin/**` ou o próprio workflow; arquivos Markdown são excluídos dos gatilhos. Na `main`, os dois builds aprovados permitem publicar a versão declarada no CMake; um release já publicado é preservado. Mudanças apenas documentais mantêm as versões dos binários.

Os ZIPs dos releases são os downloads permanentes. Os artefatos das Actions expiram após 14 dias. Veja o [processo de release](plugin/RELEASING.md), o [guia do Deluxe 65](plugin/DELUXE_65.md) e o [diagnóstico em DAWs](plugin/TROUBLESHOOTING.md).
