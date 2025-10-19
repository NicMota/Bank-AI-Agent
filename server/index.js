// index.js

require("dotenv").config();
const express = require("express");

// --- IMPORTAÇÕES ---
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid"); // Lembre-se: npm install uuid@8.3.2
// --- FIM DAS IMPORTAÇÕES ---

const app = express();

// --- CONFIGURAÇÃO DE MIDDLEWARE ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// --- CONFIGURAÇÃO DO CLIENTE TWILIO ---
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER;
const client = require("twilio")(accountSid, authToken);

/**
 * =======================================================
 * FUNÇÃO PARA ENVIAR MENSAGENS (VIA TWILIO)
 * =======================================================
 * @param {string} to - O número do destinatário
 * @param {string} body - O texto da mensagem
 * @param {string | null} mediaUrl - URL pública de uma imagem (opcional)
 * @param {string[] | null} actions - Array de botões (opcional)
 */
async function sendTwilioMessage(to, body, mediaUrl = null, actions = null) {
  console.log(`Enviando mensagem para ${to}: "${body}"`);
  try {
    const messageData = {
      body: body,
      from: twilioNumber,
      to: to,
    };

    if (mediaUrl) {
      messageData.mediaUrl = [mediaUrl];
    }

    if (actions && actions.length > 0) {
      messageData.persistentAction = actions.slice(0, 3);
      console.log("Adicionando botões:", messageData.persistentAction);
    }

    const message = await client.messages.create(messageData);
    console.log(`Mensagem enviada! SID: ${message.sid}`);
  } catch (error) {
    console.error("Erro ao enviar mensagem via Twilio:", error);
  }
}

// --- ROTAS DO SERVIDOR ---

app.get("/", (req, res) => {
  res.send("O agente está funcionando com Express + Twilio!");
});

/**
 * =======================================================
 * WEBHOOK DE RECEBIMENTO DE MENSAGENS (TWILIO)
 * =======================================================
 */
app.post("/twilio-webhook", async (req, res) => {
  // Os dados da Twilio vêm no 'req.body'
  const incomingMsg = req.body.Body;
  const fromNumber = req.body.From;
  const numMedia = parseInt(req.body.NumMedia || 0);

  console.log(`[Mensagem Recebida de ${fromNumber}]`);
  console.log(`Mensagem: "${incomingMsg}"`);

  // Verifica se tem mídia (ex: o PDF/CSV)
  if (numMedia > 0) {
    const mediaUrl = req.body.MediaUrl0;
    const mediaType = req.body.MediaContentType0;

    console.log(`Mídia recebida: ${mediaUrl} (Tipo: ${mediaType})`);

    // --- 1. Definir Caminhos e Extensão Corretamente ---
    const uploadsDir = path.join(process.cwd(), "tmp/public/incoming_pdf/");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Mapeamento robusto de tipos de mídia para extensões
    const extensionMap = {
      "application/pdf": "pdf",
      "text/csv": "csv",
      "application/vnd.ms-excel": "csv",
      "text/plain": "csv",
      "image/jpeg": "jpg",
      "image/png": "png",
    };

    let extension = extensionMap[mediaType] || mediaType.split("/")[1] || "dat";
    if (extension.length > 5) {
      extension = extension.split(".").pop();
    }
    if (extension.length > 5 || extension.includes(";")) {
      extension = "dat";
    }

    const fileName = `upload_${uuidv4()}.${extension}`;
    const localFilePath = path.join(uploadsDir, fileName);

    // --- 2. ENVIAR CONFIRMAÇÃO IMEDIATA (MELHOR UX) ---
    try {
      const responseMsg =
        "Recebi seu arquivo! Já comecei a processar seu dashboard...";
      await sendTwilioMessage(fromNumber, responseMsg);
      console.log("Confirmação de recebimento enviada ao usuário.");
    } catch (error) {
      console.error("Erro ao enviar a *mensagem de confirmação*:", error);
    }

    // --- 3. AGORA, FAÇA O DOWNLOAD "EM SEGUNDO PLANO" ---
    try {
      console.log(`Baixando arquivo para: ${localFilePath}`);
      const response = await axios({
        method: "GET",
        url: mediaUrl,
        responseType: "stream",
        auth: {
          username: accountSid,
          password: authToken,
        },
      });

      const writer = fs.createWriteStream(localFilePath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      console.log(`Arquivo salvo com sucesso: ${localFilePath}`);

      // ==============================================================
      // TODO: CHAMAR AGENTE PYTHON (Tool 1 - Leitor de PDF/CSV)
      // const jsonResult = await runPythonScript(localFilePath);
      // ==============================================================
    } catch (error) {
      console.error("Erro ao baixar ou salvar o arquivo:", error.message);
      await sendTwilioMessage(
        fromNumber,
        "Desculpe, tive um problema ao baixar seu arquivo. Tente novamente."
      );
    }
  } else {
    // ==============================================================
    // --- [MUDANÇA AQUI] LÓGICA DE MENU COM TEXTO ---
    // ==============================================================

    // Se não for mídia, é uma mensagem de texto normal
    const msgLower = incomingMsg.toLowerCase().trim();

    // Se o usuário disser "oi", "menu", "ajuda", etc.
    if (msgLower === "menu") {
      // Usamos \n para quebras de linha e *...* para negrito no WhatsApp
      const menuBody =
        "Olá! 👋 Sou seu assistente do Banco X. Como posso ajudar hoje?\n\n" +
        "Digite o número da opção desejada:\n" +
        "*1* - Tirar Dúvida Financeira\n" +
        "*2* - Gerar Extrato (Enviar Arquivo)\n" +
        "*3* - Planejamento de Meta";

      // Não passamos mais o 'actions'
      await sendTwilioMessage(fromNumber, menuBody, null);
    }
    // Se o usuário CLICAR (ou digitar) "1"
    else if (msgLower === "1") {
      const responseMsg = "aqui o usuário tira duvida financeira com o chat";

      await sendTwilioMessage(fromNumber, responseMsg, null);
    }
    // Se o usuário CLICAR (ou digitar) "2"
    else if (msgLower === "2") {
      const responseMsg =
        "Para gerar seu extrato, por favor, me envie o arquivo PDF do seu extrato do banco.";
      await sendTwilioMessage(fromNumber, responseMsg);
    }
    // Se o usuário CLICAR (ou digitar) "3"
    else if (msgLower === "3") {
      const responseMsg =
        "aqui o chat responde o quanto a pessoa deve juntar pra atingir uma meta";
      await sendTwilioMessage(fromNumber, responseMsg);
    }
    // --- Bloco 'else' Padrão ---
    else {
      // Se não for um comando conhecido, avise o usuário
      const responseMsg =
        `Desculpe, não entendi a opção "${incomingMsg}".\n` +
        `Digite "Menu" para ver as opções.`;
      await sendTwilioMessage(fromNumber, responseMsg);
    }
  }

  // =======================================================
  // Responde 200 OK para a Twilio DEPOIS de toda a lógica.
  // =======================================================
  res.type("text/xml").send("<Response></Response>");
});

// Rota antiga do Facebook (só para manter)
app.get("/webhook", (req, res) => {
  res.send("Este é o webhook da Meta, use /twilio-webhook para a Twilio.");
});

// --- INICIAR SERVIDOR ---
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(
    "Webhook da Twilio esperando em http://localhost:" +
      PORT +
      "/twilio-webhook"
  );
});
