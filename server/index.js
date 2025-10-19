// index.js

require("dotenv").config();
const express = require("express");

// --- IMPORTAÇÕES ---
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid"); // Lembre-se: npm install uuid@8.3.2
// const { PythonShell } = require("python-shell"); // [REMOVIDO TEMPORARIAMENTE]
// --- FIM DAS IMPORTAÇÕES ---

const app = express();

// --- GERENCIADOR DE ESTADO DE CONVERSA ---
const userSessions = {};
// --- FIM DO GERENCIADOR DE ESTADO ---

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
 * (Sem alterações)
 * =======================================================
 */
async function sendTwilioMessage(to, body, mediaUrl = null, actions = null) {
  console.log(`Enviando mensagem para ${to}: "${body}"`);
  try {
    const messageData = { body, from: twilioNumber, to };
    if (mediaUrl) messageData.mediaUrl = [mediaUrl];
    if (actions && actions.length > 0)
      messageData.persistentAction = actions.slice(0, 3);
    const message = await client.messages.create(messageData);
    console.log(`Mensagem enviada! SID: ${message.sid}`);
  } catch (error) {
    console.error("Erro ao enviar mensagem via Twilio:", error);
  }
}

/**
 * =======================================================
 * FUNÇÃO PARA CHAMAR O AGENTE PYTHON
 * [REMOVIDO TEMPORARIAMENTE]
 * =======================================================
 */
/*
async function runPythonAgent(pdfPath) {
  // ... (código python-shell removido)
}
*/

// --- ROTAS DO SERVIDOR ---
app.get("/", (req, res) => {
  res.send("O agente está funcionando com Express + Twilio!");
});

/**
 * =======================================================
 * WEBHOOK DE RECEBIMENTO DE MENSAGENS (TWILIO)
 * [LÓGICA REESTRUTURADA]
 * =======================================================
 */
app.post("/twilio-webhook", async (req, res) => {
  // --- 1. Coletar todos os dados da requisição ---
  const incomingMsg = req.body.Body;
  const fromNumber = req.body.From;
  const numMedia = parseInt(req.body.NumMedia || 0);

  // Proteção para o caso de 'incomingMsg' ser nulo (quando só tem mídia)
  const msgLower = (incomingMsg || "").toLowerCase().trim();

  const currentUserState = userSessions[fromNumber] || {
    state: null,
    data: {},
  };

  console.log(`[Mensagem Recebida de ${fromNumber}]`);
  console.log(`Mensagem: "${incomingMsg}" | Mídia: ${numMedia}`);
  console.log(`Estado Atual: ${currentUserState.state}`);

  // --- 2. Lógica Principal (Baseada em Estado) ---

  // 2.1. Comando "Cancelar" ou "Menu" (Prioridade Máxima)
  if (msgLower === "menu" || msgLower === "cancelar") {
    const wasInConversation = currentUserState.state !== null;
    delete userSessions[fromNumber];
    if (wasInConversation) {
      await sendTwilioMessage(
        fromNumber,
        "Tudo bem, operação cancelada. 👍\nVoltando ao menu principal."
      );
    }
    const menuBody =
      "Olá! 👋 Sou o *Assistente Digital do BTG Pactual*.\nEstou aqui para ajudar a organizar sua vida financeira.\n\n" +
      "Como posso te auxiliar agora?\n\n" +
      "Digite o número da opção desejada:\n" +
      "*1* - Tirar Dúvida Financeira\n" +
      "*2* - Análise de Extrato (via PDF)\n" +
      "*3* - Planejamento de Metas";
    await sendTwilioMessage(fromNumber, menuBody, null);

    // 2.2. Estado: Esperando um PDF para análise
  } else if (currentUserState.state === "AWAITING_PDF") {
    // O usuário está no estado correto, agora verificamos se ele enviou mídia
    if (numMedia > 0) {
      const mediaUrl = req.body.MediaUrl0;
      const mediaType = req.body.MediaContentType0;

      // Verifica se a mídia é um PDF
      if (mediaType === "application/pdf") {
        // --- INÍCIO DA LÓGICA DE PROCESSAMENTO DE PDF ---
        // (Esta é a sua lógica antiga, agora movida para cá)
        console.log(`Mídia recebida: ${mediaUrl} (Tipo: ${mediaType})`);
        const uploadsDir = path.join(process.cwd(), "tmp/public/incoming_pdf/");
        if (!fs.existsSync(uploadsDir))
          fs.mkdirSync(uploadsDir, { recursive: true });

        const fileName = `upload_${uuidv4()}.pdf`;
        const localFilePath = path.join(uploadsDir, fileName);

        try {
          const responseMsg =
            "Perfeito! Recebi seu documento. 📄\nMinha IA financeira do *BTG Pactual* já está analisando os dados. Isso pode levar um momento...";
          await sendTwilioMessage(fromNumber, responseMsg);
        } catch (error) {
          console.error("Erro ao enviar a *mensagem de confirmação*:", error);
        }

        try {
          console.log(`Baixando arquivo para: ${localFilePath}`);
          const response = await axios({
            method: "GET",
            url: mediaUrl,
            responseType: "stream",
            auth: { username: accountSid, password: authToken },
          });
          const writer = fs.createWriteStream(localFilePath);
          response.data.pipe(writer);
          await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
          });
          console.log(`Arquivo salvo com sucesso: ${localFilePath}`);

          // --- SIMULAÇÃO DE CHAMADA PYTHON ---
          console.log(
            "[Node] SIMULAÇÃO: Chamando LLM de análise de extrato..."
          );
          const analysisResult = {
            balance: 1234.56,
            total_income: 5000.0,
            total_expense: 3765.44,
            tips_financeiras: [
              "(Dica mockada: Você gastou muito com iFood. Considere definir um orçamento para delivery.)",
            ],
          };

          if (analysisResult) {
            const summaryMsg =
              `*Análise do BTG Concluída!* 🚀\n\n` +
              `Aqui está um resumo do seu extrato:\n\n` +
              `Balanço: *R$ ${analysisResult.balance.toFixed(2)}*\n` +
              `Total de Receita: R$ ${analysisResult.total_income.toFixed(
                2
              )}\n` +
              `Total de Despesas: R$ ${analysisResult.total_expense.toFixed(
                2
              )}\n\n` +
              `*Dica Financeira do BTG:*\n_${analysisResult.tips_financeiras[0]}_`;
            await sendTwilioMessage(fromNumber, summaryMsg);
          }
          fs.unlinkSync(localFilePath); // Limpa o arquivo
          console.log(`Arquivo temporário deletado: ${localFilePath}`);

          // Limpa o estado, pois a tarefa foi concluída
          delete userSessions[fromNumber];
        } catch (error) {
          console.error("Erro no processo de download/análise:", error.message);
          await sendTwilioMessage(
            fromNumber,
            "Desculpe, não consegui processar o seu arquivo. Parece que houve um erro no envio. Por favor, tente novamente."
          );
        }
        // --- FIM DA LÓGICA DE PROCESSAMENTO DE PDF ---
      } else {
        // Mídia recebida, mas não é PDF
        const errorMsg =
          "Desculpe, este assistente aceita apenas arquivos no formato *PDF*.\n\nPor favor, envie seu extrato novamente ou digite *cancelar* para voltar.";
        await sendTwilioMessage(fromNumber, errorMsg);
      }
    } else {
      // Estado era AWAITING_PDF, mas o usuário enviou TEXTO
      const errorMsg =
        "Eu estava esperando um *arquivo PDF*.\n\nPor favor, envie seu extrato ou digite *cancelar* para voltar ao menu.";
      await sendTwilioMessage(fromNumber, errorMsg);
    }

    // ==============================================================
    // 2.3. Fluxo de Dúvida Financeira (Opção 1)
    // ==============================================================
  } else if (currentUserState.state === "AWAITING_FINANCIAL_QUESTION") {
    currentUserState.data.question = incomingMsg;
    currentUserState.state = "AWAITING_FINANCIAL_CONTEXT_INCOME";
    userSessions[fromNumber] = currentUserState;
    const responseMsg =
      "Excelente pergunta. Para que o BTG Pactual possa te dar uma dica *personalizada* e realista, preciso de um pouco de contexto.\n\n" +
      "*Qual é a sua renda mensal média (R$)?*\n(Ex: 5000)\n\n" +
      "_(Digite *cancelar* a qualquer momento para voltar ao menu.)_";
    await sendTwilioMessage(fromNumber, responseMsg);
  } else if (currentUserState.state === "AWAITING_FINANCIAL_CONTEXT_INCOME") {
    currentUserState.data.income = incomingMsg;
    currentUserState.state = "AWAITING_FINANCIAL_CONTEXT_EXPENSES";
    userSessions[fromNumber] = currentUserState;
    const responseMsg =
      "Entendido. E quais você diria que são suas *principais categorias de gastos* hoje?\n\n" +
      "(Ex: Aluguel, Alimentação/iFood, Cartão de crédito, etc.)\n\n" +
      "_(Digite *cancelar* a qualquer momento para voltar ao menu.)_";
    await sendTwilioMessage(fromNumber, responseMsg);
  } else if (currentUserState.state === "AWAITING_FINANCIAL_CONTEXT_EXPENSES") {
    currentUserState.data.expenses = incomingMsg;
    const { question, income, expenses } = currentUserState.data;

    // --- SIMULAÇÃO DE CHAMADA PYTHON ---
    console.log(
      "[Node] SIMULAÇÃO: Chamando LLM de Dúvidas com:",
      currentUserState.data
    );
    const llmAnswer =
      `*Análise do BTG Pactual:*\n\n` +
      `_(Resposta do LLM: Com base na sua renda de *${income}* e gastos com *${expenses}*, a melhor forma de *${question}* é... [placeholder da IA])_\n\n` +
      `Digite "Menu" para voltar ao início.`;
    await sendTwilioMessage(fromNumber, llmAnswer);
    delete userSessions[fromNumber];

    // ==============================================================
    // 2.4. Fluxo de Planejamento de Meta (Opção 3)
    // ==============================================================
  } else if (currentUserState.state === "AWAITING_GOAL_DESCRIPTION") {
    currentUserState.data.goalDescription = incomingMsg;
    currentUserState.state = "AWAITING_INCOME";
    userSessions[fromNumber] = currentUserState;
    const responseMsg =
      "Ótimo objetivo. Agora, *qual é a sua renda mensal média (R$)?*\n" +
      "(Ex: 5000)\n\n" +
      "_(Digite *cancelar* a qualquer momento para voltar ao menu.)_";
    await sendTwilioMessage(fromNumber, responseMsg);
  } else if (currentUserState.state === "AWAITING_INCOME") {
    currentUserState.data.monthlyIncome = incomingMsg;
    currentUserState.state = "AWAITING_TIMEFRAME";
    userSessions[fromNumber] = currentUserState;
    const responseMsg =
      "Perfeito. *Em quanto tempo você planeja alcançar essa meta?*\n" +
      "(Ex: 6 meses, 1 ano)\n\n" +
      "_(Digite *cancelar* a qualquer momento para voltar ao menu.)_";
    await sendTwilioMessage(fromNumber, responseMsg);
  } else if (currentUserState.state === "AWAITING_TIMEFRAME") {
    currentUserState.data.timeframe = incomingMsg;
    currentUserState.state = "AWAITING_GOAL_PRICE";
    userSessions[fromNumber] = currentUserState;
    const responseMsg =
      "Estamos quase lá! *Qual é o valor total (R$)* que você precisa para esta meta?\n" +
      "(Ex: 10000)\n\n" +
      "_(Digite *cancelar* a qualquer momento para voltar ao menu.)_";
    await sendTwilioMessage(fromNumber, responseMsg);
  } else if (currentUserState.state === "AWAITING_GOAL_PRICE") {
    currentUserState.data.goalPrice = incomingMsg;
    const { goalDescription, monthlyIncome, timeframe, goalPrice } =
      currentUserState.data;

    // --- SIMULAÇÃO DE CHAMADA PYTHON ---
    console.log(
      "[Node] SIMULAÇÃO: Chamando LLM de Metas com:",
      currentUserState.data
    );
    const llmPlan =
      `*Plano de Metas (BTG Pactual):*\n\n` +
      `_(Resposta do LLM: Para *${goalDescription}* (R$${goalPrice}) em *${timeframe}*, ganhando *R$${monthlyIncome}*, você deve... [placeholder da IA])_\n\n` +
      `Digite "Menu" para voltar ao início.`;
    await sendTwilioMessage(fromNumber, llmPlan);
    delete userSessions[fromNumber];

    // ==============================================================
    // 2.5. Comandos do Menu (Nenhum estado ativo)
    // ==============================================================
  } else if (msgLower === "1") {
    // --- INICIA A CONVERSA DE DÚVIDA ---
    userSessions[fromNumber] = {
      state: "AWAITING_FINANCIAL_QUESTION",
      data: {},
    };
    const responseMsg =
      "Ótimo! O primeiro passo para a saúde financeira é o conhecimento. 💰\n\n" +
      "*Qual é a sua pergunta?*\n\n" +
      "Exemplos:\n" +
      "- Como posso reduzir meus gastos?\n" +
      "- Qual o primeiro passo para investir?\n" +
      "- Vale a pena amortizar meu financiamento?\n\n" +
      "_(Digite *cancelar* a qualquer momento para voltar ao menu.)_";
    await sendTwilioMessage(fromNumber, responseMsg);
  } else if (msgLower === "2") {
    // --- [MUDANÇA AQUI] Apenas define o estado ---
    userSessions[fromNumber] = {
      state: "AWAITING_PDF",
      data: {},
    };
    const responseMsg =
      "Certo. Para que eu possa analisar seu extrato, por favor, me envie o *arquivo PDF* do seu banco.";
    await sendTwilioMessage(fromNumber, responseMsg);
  } else if (msgLower === "3") {
    // --- INICIA A CONVERSA DE META ---
    userSessions[fromNumber] = {
      state: "AWAITING_GOAL_DESCRIPTION",
      data: {},
    };
    const responseMsg =
      "Vamos lá! Planejar é o segredo do sucesso. 🚀\n\n" +
      "Primeiro, me diga: *qual é o seu principal objetivo financeiro?*\n\n" +
      "Exemplos:\n" +
      "- Guardar dinheiro para uma viagem\n" +
      "- Começar a investir para a aposentadoria\n" +
      "- Reduzir minhas dívidas\n\n" +
      "_(Digite *cancelar* a qualquer momento para voltar ao menu.)_";
    await sendTwilioMessage(fromNumber, responseMsg);

    // ==============================================================
    // 2.6. Bloco Padrão (Sem estado e comando não reconhecido)
    // ==============================================================
  } else {
    // Verifica se o usuário enviou mídia sem ser solicitado
    if (numMedia > 0) {
      await sendTwilioMessage(
        fromNumber,
        "Recebi um arquivo, mas não tenho certeza do que fazer com ele. 🤔\n\nPor favor, digite *Menu* para ver as opções e selecionar o que deseja."
      );
    } else {
      // Usuário enviou texto aleatório
      const responseMsg =
        `Desculpe, não reconheci o comando "${incomingMsg}".\n` +
        `Por favor, digite "Menu" para ver todas as opções disponíveis.`;
      await sendTwilioMessage(fromNumber, responseMsg);
    }
  }

  // --- 3. Responde 200 OK para a Twilio ---
  res.type("text/xml").send("<Response></Response>");
});

// --- ROTA ANTIGA DO FACEBOOK ---
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
