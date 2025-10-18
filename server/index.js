require("dotenv").config();

const express = require("express");
const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.WHATSAP_VERIFY_TOKEN;

app.get("/", (req, res) => {
  res.send("webhook funcionando na porta: " + PORT);
});

app.get("/webhook", (req, res) => {
  console.log("Recebida requisição GET de verificação...");

  // Extrai os parâmetros de consulta (query parameters)
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  // Verifica se o modo é 'subscribe' e se o token bate com o seu
  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("WEBHOOK_VERIFICADO");
      // Responde com o 'challenge' para confirmar
      res.status(200).send(challenge);
    } else {
      // Se os tokens não baterem, recusa
      console.warn("Falha na verificação. Tokens não batem.");
      res.sendStatus(403); // Forbidden
    }
  } else {
    res.sendStatus(400); // Bad Request
  }
});

app.post('/webhook', (req, res) => {
    let body = req.body;

    // Log para depuração (MUITO útil para ver a estrutura do dado)
    console.log('Payload recebido:', JSON.stringify(body, null, 2));

    // Verifica se é uma notificação do WhatsApp
    if (body.object === 'whatsapp_business_account') {
        
        // Itera sobre as entradas (pode haver várias em um lote)
        body.entry.forEach(entry => {
            let changes = entry.changes[0]; // Pega a primeira mudança

            // Verifica se a mudança é uma mensagem e se tem texto
            if (changes.value.messages && changes.value.messages[0]) {
                let message = changes.value.messages[0];

                // Processa apenas mensagens do tipo 'text'
                if (message.type === 'text') {
                    let from = message.from; // Número de telefone do usuário (ex: "5511999998888")
                    let msg_body = message.text.body; // O conteúdo da mensagem (ex: "Qual meu saldo?")

                    console.log(`[Mensagem Recebida]`);
                    console.log(`De: ${from}`);
                    console.log(`Mensagem: ${msg_body}`);

                    // ==============================================================
                    // TODO: AQUI É O PONTO DE INTEGRAÇÃO DO SEU AGENTE DE IA
                    //
                    // 1. Pegue 'msg_body' e 'from'.
                    // 2. Envie para seu agente (LangChain, LlamaIndex, etc.).
                    // 3. O agente processa, chama as APIs do banco (mockadas) e gera uma resposta.
                    // 4. Pegue a resposta e use a API do WhatsApp para enviá-la de volta para 'from'.
                    //
                    // Exemplo de pseudocódigo:
                    // const respostaAgente = await meuAgente.processar(from, msg_body);
                    // await enviarMensagemWhatsApp(from, respostaAgente);
                    // ==============================================================
                }
            }
        });

        // O WhatsApp exige uma resposta 200 OK para saber que você recebeu o evento
        res.status(200).send('EVENT_RECEIVED');
    } else {
        // Se não for um evento do WhatsApp, marca como Não Encontrado
        res.sendStatus(404);
    }
});

// 6. Iniciar o Servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log('Webhook esperando em http://localhost:' + PORT + '/webhook');
    if (!VERIFY_TOKEN) {
        console.error('ERRO: WHATSAPP_VERIFY_TOKEN não está definido no .env!');
    }
});