# Interface da comunidade

A interface desta pasta conversa com o backend real de [community/](../../community/README.md). Não abra o HTML como arquivo nem use um servidor apenas estático: contas, avaliações e criações dependem da API.

```sh
npm ci
npm run preview:community
```

Abra http://127.0.0.1:3200/comunidade/. Os dados são persistidos em `.data/community`, na máquina onde o servidor foi iniciado. A prévia anterior, mantida apenas na memória da aba, não é migrada: ela não tinha contas ou gravações reais.

Consulte o [guia do backend](../../community/README.md) para cadastro e chave de recuperação, administrador, presets das ferramentas, limites de áudio, backup, testes e operação dos ambientes Node.js na Hostinger.

Os links de Voz e Guitarra desta interface apontam para `/comunidade/ferramentas/`, rotas atendidas pelo Node mesmo quando a hospedagem prioriza os arquivos estáticos. Use esses links para testar a captura e a aplicação de presets; as ferramentas na raiz permanecem sem a integração.

Em **Meu Estúdio → Cores do meu estúdio**, há quatro paletas predefinidas e cinco cores personalizáveis. Com login, a preferência é salva por conta no SQLite e carregada em outros navegadores/dispositivos ao entrar. Sem login, permanece local ao navegador. Uma conta sem paleta pode aplicar a preferência local para vinculá-la; não há importação automática nem alteração das ferramentas Voz/Guitarra. Ao sair, a preferência local é restaurada. Texto e destaques precisam manter contraste mínimo de 4,5:1 sobre fundo e painéis; o padrão pode ser restaurado a qualquer momento. Se o navegador recusar o armazenamento local, a interface informa que a escolha vale apenas para a sessão. Se o servidor recusar o salvamento da conta, a interface informa a falha e permite tentar novamente, sem anunciar sincronização. O último salvamento confirmado prevalece; outras sessões carregam a atualização ao recarregar ou entrar novamente.

Esta pasta continua fora de `public/` e do deploy SFTP antigo, que está desativado. O backend serve a mesma interface em dois modos: homologação com avisos e `noindex`, e produção com apresentação pública. O pacote completo precisa de publicação explícita; integrar os arquivos não ativa o serviço. Consulte [o procedimento de produção](../../community/PRODUCTION.md).


A interface administrativa inclui confirmação da senha recente, cancelável com retorno ao Meu Estúdio. Consulte [as proteções do backend](../../community/SECURITY.md) e a política de privacidade para a consulta de novas senhas comprometidas.
