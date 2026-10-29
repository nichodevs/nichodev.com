# Onda de gratidão

Página de agradecimento acessada pela onda animada no rodapé das páginas do [estúdio](../../README.md), incluindo a página de downloads VST3. A animação em canvas acompanha o ponteiro e se adapta ao tamanho da tela. Seu desenho é gerado por fórmulas; não representa uma captura do microfone.

[Abrir a página publicada](https://nichodev.com/onda/)

## Como interagir

- **Mouse:** mova o ponteiro sobre a onda.
- **Toque:** arraste o dedo sobre a área interativa.
- **Teclado:** use Tab para focar a área e as setas esquerda/direita para mover a interação. Segure Shift para aumentar o passo.
- A preferência do sistema por **redução de movimento** mantém a fase da onda estática, com interação ainda disponível.
- **VOLTAR AO ESTÚDIO** retorna à página inicial. A página também pode ser aberta diretamente, sem passar pelo menu do estúdio.

## Arquivos

- [index.html](index.html): mensagem de agradecimento e área acessível por teclado.
- [onda.css](onda.css): apresentação responsiva em estilo arcade retrô.
- [onda.js](onda.js): desenho, redimensionamento e interação com a onda.

Para executar localmente, siga os [comandos do site](../../README.md#executar-o-site) e abra [http://localhost:3000/onda/](http://localhost:3000/onda/). Os testes de teclado e retorno pelo histórico estão em [tests/e2e/studio.spec.js](../../tests/e2e/studio.spec.js).

A publicação segue o [workflow do site](../../.github/workflows/deploy.yml). Seu filtro `public/**` exclui Markdown: editar este README mantém a validação do PR, sem acionar deploy por push. Consulte [DEPLOYMENT.md](../../DEPLOYMENT.md).
