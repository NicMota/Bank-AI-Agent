// index.js

require("dotenv").config();
const express = require("express");

// --- IMPORTAÇÕES ---
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid"); // Lembre-se de usar a v8: npm install uuid@8.3.2
// --- FIM DAS IMPORTAÇÕES ---

const app = express();

// --- CONFIGURAÇÃO DE MIDDLEWARE ---
// Middleware para parsear JSON
app.use(express.json());
// Middleware para parsear 'form data' (USADO PELA TWILIO)
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
 * @param {string} to - O número do destinatário (ex: "whatsapp:+5511999998888")
 * @param {string} body - O texto da mensagem
 * @param {string | null} mediaUrl - URL pública de uma imagem (opcional)
 */
async function sendTwilioMessage(to, body, mediaUrl = null) {
  console.log(`Enviando mensagem para ${to}: "${body}"`);
  try {
    const messageData = {
      body: body,
      from: twilioNumber,
      to: to, // O 'from' que recebemos no webhook já vem formatado
    };

    if (mediaUrl) {
      messageData.mediaUrl = [mediaUrl];
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
  // Os dados da Twilio vêm no 'req.body' (graças ao express.urlencoded)
  const incomingMsg = req.body.Body; // O texto da mensagem do usuário
  const fromNumber = req.body.From; // O número do usuário (ex: "whatsapp:+5511999998888")
  const numMedia = parseInt(req.body.NumMedia || 0); // Quantidade de mídias

  console.log(`[Mensagem Recebida de ${fromNumber}]`);
  console.log(`Mensagem: "${incomingMsg}"`);

  // Verifica se tem mídia (ex: o PDF/CSV)
  if (numMedia > 0) {
    const mediaUrl = req.body.MediaUrl0; // URL da primeira mídia
    const mediaType = req.body.MediaContentType0; // ex: 'application/pdf'

    console.log(`Mídia recebida: ${mediaUrl} (Tipo: ${mediaType})`);

    // --- 1. Definir Caminhos e Extensão Corretamente ---
    const uploadsDir = path.join(__dirname, "tmp/public/incoming_pdf/");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Mapeamento robusto de tipos de mídia para extensões
    const extensionMap = {
      "application/pdf": "pdf",
      "text/csv": "csv",
      "application/vnd.ms-excel": "csv", // Outro tipo comum para CSV
      "text/plain": "csv", // Assumindo que text/plain é CSV para o hackathon
      "image/jpeg": "jpg",
      "image/png": "png",
      // Adicione outros tipos se necessário
    };

    // Tenta encontrar no mapa, senão usa o split, senão usa 'dat'
    let extension = extensionMap[mediaType] || mediaType.split("/")[1] || "dat";

    // Limpa a extensão caso o split traga algo complexo (ex: vnd.ms-excel)
    if (extension.length > 5) {
      extension = extension.split(".").pop(); // Pega a última parte
    }
    if (extension.length > 5 || extension.includes(";")) {
      extension = "dat"; // Fallback final
    }

    const fileName = `upload_${uuidv4()}.${extension}`;
    const localFilePath = path.join(uploadsDir, fileName);

    // --- 2. ENVIAR CONFIRMAÇÃO IMEDIATA (MELHOR UX) ---
    // Responde ao usuário ANTES de começar o download lento.
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

      // Salvar o arquivo no disco
      const writer = fs.createWriteStream(localFilePath);
      response.data.pipe(writer);

      // Espera o arquivo ser totalmente escrito no disco
      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      console.log(`Arquivo salvo com sucesso: ${localFilePath}`);

      // ==============================================================
      // TODO: CHAMAR AGENTE PYTHON (Tool 1 - Leitor de PDF/CSV)
      //
      // Agora você tem o 'localFilePath' (ex: '.../tmp/public/incoming_pdf/upload_1234.pdf')
      // Este é o caminho que você passará para o seu script Python.
      //
      // const jsonResult = await runPythonScript(localFilePath);
      // const pngPath = await runPythonScript2(jsonResult);
      // const publicPngUrl = await uploadToNgrok(pngPath); // Você precisará servir o PNG
      // await sendTwilioMessage(fromNumber, "Seu gráfico está pronto!", publicPngUrl);
      //
      // ==============================================================

      // (Opcional) Deletar o arquivo após o processamento
      // fs.unlinkSync(localFilePath);
      // console.log(`Arquivo temporário deletado: ${localFilePath}`);
    } catch (error) {
      console.error("Erro ao baixar ou salvar o arquivo:", error.message);
      // Se o download falhar, avise o usuário.
      await sendTwilioMessage(
        fromNumber,
        "Desculpe, tive um problema ao baixar seu arquivo. Tente novamente."
      );
    }
    // NOTA: A mensagem duplicada que estava aqui foi removida.
  } else {
    // Se não for mídia, é uma mensagem de texto normal

    // ==============================================================
    // TODO: CHAMAR AGENTE PYTHON (Processamento de texto)
    // const respostaDoAgente = await meuAgente.processar(incomingMsg);
    // ==============================================================

    // Resposta "eco" simples para teste
    let responseMsg = `Olá, obrigado por contatar nosso serviço de gerenciamento financeiro pessoal !`;
    let secondResponseMsg =
      " Estamos atualmente trabalhando exclusivamente com extratos bancários, por favor envie seu extrato no formado PDF e iremos gerar um Dashboard especializado para você !";

    await sendTwilioMessage(fromNumber, responseMsg);
    await sendTwilioMessage(fromNumber, secondResponseMsg);
  }

  // Responde 200 OK para a Twilio saber que recebemos
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
