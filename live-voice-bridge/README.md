# NICHODEVS Live Voice Bridge — primeira etapa

Ponte local escrita em Node.js puro, sem dependências npm. Recebe o áudio **já processado** pelo Voice Studio através de WebSocket, em PCM mono de 16 bits, e grava um arquivo WAV por sessão.

## O que esta etapa faz
- Recebe a saída processada do Voice Studio, não o microfone cru.
- Usa um token aleatório exibido no terminal para autorizar a conexão.
- Escuta apenas em `127.0.0.1` (não expõe o serviço à rede local/internet).
- Grava o áudio recebido em `recordings/` quando a conexão termina.
- Inclui endpoint de saúde em `http://127.0.0.1:8787/health`.
- Não precisa de `npm install` nem de módulos externos; exige Node.js 18+ (recomendado Node.js LTS).

## Iniciar no Windows
1. Instale Node.js LTS se ainda não estiver instalado: https://nodejs.org/.
2. Extraia a pasta `live-voice-bridge` para um local permanente.
3. Dê duplo clique em `iniciar-windows.bat` (ou execute `node server.js` nesta pasta).
4. Mantenha o terminal aberto. Copie o valor exibido depois de `TOKEN`.
5. Abra `https://nichodev.com/voz.html` no Chrome ou Edge e permita o microfone.
6. Clique em **Ligar microfone** no Voice Studio.
7. Na seção **NICHODEVS LIVE VOICE / BRIDGE**, cole o token e mantenha o endereço `ws://127.0.0.1:8787/live-voice`.
8. Clique em **Conectar Live Bridge**, fale e confira o status de segundos recebidos.
9. Clique em **Desconectar Live Bridge**. O arquivo WAV finalizado aparecerá na pasta `recordings/` do bridge.

## Teste local
Com o serviço rodando, abra `http://127.0.0.1:8787/health`. Deve retornar JSON com `status: "ok"`.

## Limitação importante: microfone do Windows
Esta versão **ainda não aparece como dispositivo de entrada no Windows, WhatsApp ou Discord**. Ela comprova e implementa o transporte local do áudio processado até um programa Node.js próprio e salva o sinal em WAV. Criar um endpoint de áudio selecionável pelo sistema operacional requer um componente nativo de áudio/driver virtual assinado ou uma solução equivalente suportada pelo Windows. Node.js sozinho não consegue registrar um dispositivo de microfone. O objetivo é substituir dependências de terceiros por uma solução própria, mas a integração de endpoint do Windows é uma etapa separada e mais avançada.

## Segurança
- O bridge vincula a porta apenas ao loopback (`127.0.0.1`).
- O token muda a cada inicialização, salvo se `LIVE_VOICE_TOKEN` for definido manualmente.
- A origem do site é validada; não compartilhe o token.
- O arquivo WAV pode conter voz privada: apague as gravações que não quiser guardar.
