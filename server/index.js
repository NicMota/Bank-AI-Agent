// index.js

// --- [MUDANÇA] Conversão para ES Modules ---
import "dotenv/config"; // Substitui require("dotenv").config()
import express from "express";
import fs from "fs";
import path from "path";
import axios from "axios";
import { v4 as uuidv4 } from "uuid"; // Substitui o require('uuid')
import twilio from "twilio"; // Importa a função 'twilio'

import { receive_prompt } from "../agentjs/agent.js";
// --- FIM DAS MUDANÇAS ---

const app = express();

const userSessions = {};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER;

// --- [MUDANÇA] Inicializa o 'client' a partir do import ---
const client = twilio(accountSid, authToken);

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

app.get("/", (req, res) => {
  res.send("O agente está funcionando com Express + Twilio!");
});

app.post("/twilio-webhook", async (req, res) => {
  // --- 1. Coletar todos os dados da requisição ---
  const incomingMsg = req.body.Body;
  const fromNumber = req.body.From;
  const numMedia = parseInt(req.body.NumMedia || 0);

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
    if (numMedia > 0) {
      const mediaUrl = req.body.MediaUrl0;
      const mediaType = req.body.MediaContentType0;

      if (mediaType === "application/pdf") {
        console.log(`Mídia recebida: ${mediaUrl} (Tipo: ${mediaType})`);

        // [NOTA] process.cwd() está correto pois você roda o node da raiz
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

          // --- [MUDANÇA] Chamando sua nova função JS ---
          // (Assumindo que receive_prompt é assíncrona)
          await receive_prompt(localFilePath);
          // (Se não for assíncrona, remova o await)

          fs.unlinkSync(localFilePath); // Limpa o arquivo
          console.log(`Arquivo temporário deletado: ${localFilePath}`);

          delete userSessions[fromNumber];
        } catch (error) {
          console.error("Erro no processo de download/análise:", error.message);
          await sendTwilioMessage(
            fromNumber,
            "Desculpe, não consegui processar o seu arquivo. Parece que houve um erro no envio. Por favor, tente novamente."
          );
        }
      } else {
        const errorMsg =
          "Desculpe, este assistente aceita apenas arquivos no formato *PDF*.\n\nPor favor, envie seu extrato novamente ou digite *cancelar* para voltar.";
        await sendTwilioMessage(fromNumber, errorMsg);
      }
    } else {
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

    console.log(
      "[Node] SIMULAÇÃO: Chamando LLM de Dúvidas com:",
      currentUserState.data
    );
    // TODO: Chamar seu agent.js aqui
    // const llmAnswer = await receive_prompt_question(currentUserState.data);
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

    console.log(
      "[Node] SIMULAÇÃO: Chamando LLM de Metas com:",
      currentUserState.data
    );
    const objetoMeta =
      "minha meta é " +
      goalDescription +
      ", tenho uma renda de" +
      monthlyIncome +
      ", num tempo de " +
      timeframe +
      ", o valor da minha meta gira em torno de:" +
      goalPrice +
      "; Por favor faça o planejamento para que eu consiga cumprir a minha meta";

    await receive_prompt(objetoMeta);

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
    userSessions[fromNumber] = {
      state: "AWAITING_PDF",
      data: {},
    };
    const responseMsg =
      "Certo. Para que eu possa analisar seu extrato, por favor, me envie o *arquivo PDF* do seu banco.";
    await sendTwilioMessage(fromNumber, responseMsg);
  } else if (msgLower === "3") {
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
    if (numMedia > 0) {
      await sendTwilioMessage(
        fromNumber,
        "Recebi um arquivo, mas não tenho certeza do que fazer com ele. 🤔\n\nPor favor, digite *Menu* para ver as opções e selecionar o que deseja."
      );
    } else {
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
