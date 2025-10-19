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

// --- GERENCIADOR DE ESTADO DE CONVERSA ---
const userSessions = {};
// --- FIM DO GERENCIADOR DE ESTADO ---

// =======================================================
// --- [ATUALIZADO] PERSONA DE USUÁRIO MOCKADA ---
// =======================================================
// O 'financialGoal' foi removido, pois será perguntado.
const mockUserPersona = {
  name: "Bruno Silva",
  age: 32,
  profession: "Engenheiro de Software",
  monthlyIncome: 12500.0,
  fixedExpenses: {
    aluguel: 3500.0,
    contas: 450.0, // Luz, Água, Internet
    financiamentoCarro: 1200.0,
  },
  variableExpenses: {
    supermercado: 1500.0,
    restaurantesDelivery: 1300.0, // Gasto problemático
    lazer: 800.0,
    transporte: 400.0,
  },
  investments: {
    CDB_BTG: 25000.0,
    Acoes_BTG: 15000.0,
  },
};
// =======================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER;

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
      "*3* - Planejamento de Metas"; // [MENSAGEM SIMPLIFICADA]
    await sendTwilioMessage(fromNumber, menuBody, null);

    // 2.2. Estado: Esperando um PDF para análise
  } else if (currentUserState.state === "AWAITING_PDF") {
    if (numMedia > 0) {
      const mediaUrl = req.body.MediaUrl0;
      const mediaType = req.body.MediaContentType0;

      if (mediaType === "application/pdf") {
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

          // --- Chamando sua função JS ---
          const promptResponse = await receive_prompt(localFilePath);
          await sendTwilioMessage(fromNumber, promptResponse);

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
    // Usuário enviou a pergunta
    const userQuestion = incomingMsg;
    const persona = mockUserPersona; // Pega a persona mockada

    console.log("[Node] Chamando LLM de Dúvidas com Persona Mockada");

    // Cria o prompt detalhado usando a persona
    const promptMsg = `
      Contexto do Usuário:
      - Nome: ${persona.name}
      - Renda Mensal: R$ ${persona.monthlyIncome}
      - Gastos Fixos Principais: ${JSON.stringify(persona.fixedExpenses)}
      - Gastos Variáveis Principais: ${JSON.stringify(persona.variableExpenses)}
      - Investimentos Atuais: ${JSON.stringify(persona.investments)}
      
      Dúvida do Usuário: "${userQuestion}"
      
      Por favor, aja como um especialista do BTG Pactual e responda a esta dúvida de forma prática, usando o contexto fornecido.
    `;

    // Chama o LLM
    const promptResponse = await receive_prompt(promptMsg);

    await sendTwilioMessage(fromNumber, promptResponse);
    delete userSessions[fromNumber]; // Limpa o estado

    // ==============================================================
    // 2.4. [NOVO] Fluxo de Planejamento de Meta (Opção 3)
    // ==============================================================
  } else if (currentUserState.state === "AWAITING_GOAL_PROMPT") {
    // Usuário enviou a descrição da meta
    const userGoal = incomingMsg;
    const persona = mockUserPersona; // Pega a persona mockada

    console.log("[Node] Chamando LLM de Metas com Persona Mockada e Meta Real");

    // Cria o prompt detalhado
    const promptMsg = `
      Contexto do Usuário:
      - Nome: ${persona.name}
      - Renda Mensal: R$ ${persona.monthlyIncome}
      - Gastos Fixos Principais: ${JSON.stringify(persona.fixedExpenses)}
      - Gastos Variáveis Principais: ${JSON.stringify(persona.variableExpenses)}
      - Investimentos Atuais: ${JSON.stringify(persona.investments)}
      
      Meta Desejada do Usuário: "${userGoal}"
      
      Por favor, aja como um planejador financeiro do BTG Pactual e crie um plano de ação prático e detalhado para este usuário atingir sua meta.
    `;

    // Chama o LLM
    const promptResponse = await receive_prompt(promptMsg);

    // Envia uma resposta placeholder

    await sendTwilioMessage(fromNumber, promptResponse);
    delete userSessions[fromNumber]; // Limpa o estado

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
      "- Como posso reduzir meus gastos com delivery?\n" +
      "- Qual o primeiro passo para investir?\n" +
      "- Com base no meu perfil, vale a pena amortizar meu financiamento?\n\n" +
      "_(Digite *cancelar* a qualquer momento para voltar ao menu.)_";
    await sendTwilioMessage(fromNumber, responseMsg);
  } else if (msgLower === "2") {
    // --- INICIA A CONVERSA DE PDF ---
    userSessions[fromNumber] = {
      state: "AWAITING_PDF",
      data: {},
    };
    const responseMsg =
      "Certo. Para que eu possa analisar seu extrato, por favor, me envie o *arquivo PDF* do seu banco.";
    await sendTwilioMessage(fromNumber, responseMsg);
  } else if (msgLower === "3") {
    // --- [MUDANÇA AQUI] INICIA A CONVERSA DE META ---
    userSessions[fromNumber] = {
      state: "AWAITING_GOAL_PROMPT", // Define o novo estado
      data: {},
    };
    const responseMsg =
      "Vamos lá! Planejar é o segredo do sucesso. 🚀\n\n" +
      "Primeiro, me diga: *qual é o seu principal objetivo financeiro?*\n\n" +
      "Exemplos:\n" +
      "- Guardar 20.000 para uma viagem em 1 ano\n" +
      "- Começar a investir para a aposentadoria\n" +
      "- Reduzir minhas dívidas pela metade\n\n" +
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
