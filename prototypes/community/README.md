# Comunidade — prévia para homologação

Demonstração isolada de interface, preparada antes do backend. Os autores e conteúdos são fictícios. Nenhuma avaliação é enviada, nenhuma conta é autenticada e nenhuma publicação vai para a internet.

## Abrir

Na raiz do repositório, com Node.js 24 ou superior:

```sh
npm ci
npm run preview:community
```

Abra http://127.0.0.1:3100. A porta pode ser escolhida com a variável PREVIEW_PORT. O servidor aceita apenas leitura dos três assets da prévia e escuta somente na própria máquina; não exponha essa demonstração como um serviço de contas.

O artefato nichodev-community-preview das Actions contém os mesmos HTML/CSS/JS. Ele é temporário, retido por 14 dias. É possível abrir index.html diretamente para uma inspeção básica; áudio, cópia e comportamento de origem devem ser homologados pelo servidor HTTP local.

## O que homologar

1. **Avaliação:** abra “Como foi sua experiência?”, escolha ferramenta e resultado, deixe comentário/contato vazios ou use dados fictícios e simule o envio. Confira o painel demo, filtre a situação e altere para “Em análise” ou “Concluído”.
2. **Exemplos:** abra “Meu primeiro loop”, ouça a amostra sintetizada e ajuste tom, delay e ambiência. Baixe o projeto e importe como BACKUP no MIXMASTER; guarde o projeto existente antes de importar.
3. **Timbres:** filtre Voz/Guitarra, experimente, favorite e salve uma cópia. A entrada na conta é simulada, sem conferir a senha. Os ajustes do laboratório não são os motores de áudio das ferramentas reais ou dos VST3.
4. **Conta:** teste login e cadastro com usuário fictício de 3 a 24 caracteres e uma frase de pelo menos 15 caracteres como senha. Cadastre duas vezes o mesmo nome para verificar a mensagem de conflito. A prévia nunca guarda a senha.
5. **Recuperação:** guarde a chave com prefixo DEMO, saia e recupere com usuário, chave e nova senha fictícia. A chave é ligada ao usuário demonstrativo e muda após uso; não concede acesso a nenhum serviço real.
6. **Configurações:** simule alteração de senha e substituição da chave.
7. **Galeria:** abra um conteúdo, ouça e crie uma versão. Salve uma prévia com visibilidade privada, não listada ou pública. Só a opção pública entra na galeria demonstrativa. Links reais para novas publicações e uploads dependem do backend.
8. **Acessibilidade:** percorra com Tab, feche diálogos com Escape, use a tela no celular e confira a preferência por redução de movimento.

Tudo existe apenas na memória da aba e desaparece ao recarregar. Até mesmo o painel administrativo é uma simulação aberta para homologar o desenho; não há dados ou permissões reais. Use somente informações fictícias, inclusive no contato e nas senhas.

## Testes

```sh
npx playwright install chromium firefox webkit
npm run test:preview
```

No Linux, use --with-deps na instalação dos navegadores. A configuração da prévia inicia seu servidor e o site local para testar a importação do exemplo no MIXMASTER. O workflow de validação instala uma saída de áudio virtual e roda a suíte do site e a suíte da prévia separadamente.

## Limites desta entrega

Não implementa autenticação, recuperação real, persistência no servidor, envio de avaliações, moderação, uploads ou sincronização de projetos. A recuperação e os controles de visibilidade são encenações de interface, não mecanismos de segurança. Não reaproveite o JavaScript demonstrativo como backend ou autenticação.

A implementação seguinte deve definir hospedagem, banco e armazenamento, proteger senhas e códigos de recuperação, validar entradas no servidor, aplicar limites de tentativas e conferir autorização em cada operação. As avaliações reais devem ficar privadas; a comunidade precisará de controle de publicação e moderação.

Os arquivos ficam fora de public/ e não aparecem no sitemap nem nos envios SFTP. O workflow de produção não foi alterado. Esta branch deve ser homologada antes de qualquer integração ao site público.
