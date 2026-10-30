# Comunidade para homologação

A interface desta pasta agora conversa com o backend real de [community/](../../community/README.md). Não abra o HTML como arquivo nem use um servidor apenas estático: contas, avaliações e criações dependem da API.

```sh
npm ci
npm run preview:community
```

Abra http://127.0.0.1:3200/comunidade/. Os dados são persistidos em `.data/community`, na máquina onde o servidor foi iniciado. A prévia anterior, mantida apenas na memória da aba, não é migrada: ela não tinha contas ou gravações reais.

Consulte o [guia do backend](../../community/README.md) para cadastro e chave de recuperação, administrador, presets das ferramentas, limites de áudio, backup, testes e preparação de uma homologação Node.js na Hostinger.

Os links de Voz e Guitarra desta interface apontam para `/comunidade/ferramentas/`, rotas atendidas pelo Node mesmo quando a hospedagem prioriza os arquivos estáticos. Use esses links para testar a captura e a aplicação de presets; as ferramentas na raiz permanecem sem a integração.

Esta pasta continua fora de `public/` e do deploy SFTP. A comunidade não aparece em produção ao integrar apenas os seus arquivos; o módulo MIDI compartilhado em `public/` faz parte do site e segue a validação/publicação habitual quando houver autorização de merge.
