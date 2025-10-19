// agent.js
import 'dotenv/config';


import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate, PromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { DynamicStructuredTool } from '@langchain/core/tools';
import {MemorySaver} from '@langchain/langgraph';
// ✅ Este é o caminho correto (para as versões que você vai instalar)

import promptSync  from 'prompt-sync';
import { createAgent } from 'langchain';
import { z } from 'zod';
import fs from 'fs';
import readlineSync from 'readline-sync';
import { readPdf } from './tools.js';

const prompt = promptSync();
const apiKey = process.env.GEMINI_API_KEY;
const chatHistory = [];
// --- 1. Schemas (Zod) ---

// --- 2. LLM ---
const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash", 
  temperature: 0,
  apiKey: apiKey,
  streaming:false
});

// --- 3. Ferramentas ---
const financeDoubtTool = new DynamicStructuredTool({
  name: 'finance_doubt',
  description: 'analisa a duvida financeira e retorna solucao para ela',
  schema: z.object({ doubt: z.string() }),
  func: async ({ doubt }) => {
    const prompt = `Analise a seguinte duvida e retorne uma resposta \n${doubt}`;
    const response = await llm.invoke(prompt);
    return response.content; 
  },
});


const analyseTransactionsTool = new DynamicStructuredTool({
  name: 'analyse_transactions',
  description: `Chama quando o input e um extrato bancario, analisa o extrato e retorna informações financeiras estruturadas.
    
  `,
  schema: z.object({
    transactions: z.string().describe("O conteúdo de texto completo do extrato bancário."),
  }),
  func: async ({ transactions }) => {
   
    const prompt = `Analise o seguinte extrato bancário e retorne uma resposta contendo
        -maiores gastos do periodo por categoria ( ex: alimentação, aluguel, etc)
        -maiores gastos
        -total de entrada
        -total de saída
        -saldo
        -dicas para melhorar o gerenciamento

        EXTRATO:
        ${transactions}
      `
  
    try {
      const parsed = await llm.invoke(prompt);
      console.log("[analyse_transactions] Parse concluído:", parsed);
      return parsed; 
    } catch (e) {
      console.error("[analyse_transactions] Falha ao fazer o parse:", e);
      return "Erro ao analisar o extrato.";
    }
  },
});
const goalPlanTool = new DynamicStructuredTool({
  name: 'goal_plan',
  description: 'analisa uma meta financeira e retorna um plano de ação detalhado para alcançá-la',
  schema: z.object({
    // Mantemos apenas 'goal' por enquanto, o LLM vai extrair os detalhes do texto
    goal: z.string().describe("A descrição da meta financeira do usuário, que pode incluir valor desejado, prazo, salário atual, gastos médios, etc."), 
  }),
  func: async ({ goal }) => {
    
    // ✅ NOVO PROMPT DETALHADO PARA A FERRAMENTA
    const detailedPromptTemplate = `Você é um planejador financeiro experiente do BTG Pactual. Analise a seguinte meta financeira descrita pelo cliente e crie um plano de ação DETALHADO, COMPLETO e ABRANGENTE em uma única resposta.

    Meta do Cliente: "{goal}"

    O plano deve incluir OBRIGATORIAMENTE os seguintes pontos, de forma bem explicada:
    1.  **Resumo da Meta:** Confirme os detalhes da meta (valor, prazo, etc.) que você entendeu da descrição.
    2.  **Cálculo de Poupança Mensal:** Calcule EXATAMENTE quanto o cliente precisa economizar por mês para atingir o valor desejado no prazo estipulado. Considere apenas o aporte mensal, sem juros compostos para simplificar o cálculo inicial, mas mencione que investimentos podem acelerar o processo.
    3.  **Análise de Viabilidade (se possível):** Se o cliente mencionou salário e/ou gastos na descrição da meta, comente brevemente se a economia mensal necessária parece viável com base nesses números. Se não mencionou, sugira que ele avalie isso.
    4.  **Estratégia de Investimento Sugerida (BTG Pactual):** Recomende CATEGORIAS de investimentos oferecidos pelo BTG Pactual que sejam adequadas para o PRAZO da meta.
        * Para prazos curtos (até 2 anos): Sugira opções conservadoras como CDBs de liquidez diária ou Fundos DI do BTG.
        * Para prazos médios (2 a 5 anos): Sugira um mix, como Tesouro Direto (IPCA+ ou Prefixado), LCIs/LCAs do BTG, ou Fundos Multimercado com perfil moderado.
        * Para prazos longos (acima de 5 anos): Sugira incluir opções com maior potencial de retorno (e risco), como Fundos de Ações, Ações diretamente via Home Broker BTG, ou Fundos Imobiliários (FIIs).
        * **SEMPRE** mencione que a escolha final depende do perfil de risco do cliente e que ele pode fazer uma análise de perfil (suitability) no app BTG.
    5.  **Passos Práticos no BTG Pactual:** Descreva os próximos passos concretos que o cliente pode tomar usando os serviços do BTG (Ex: "1. Abra sua conta no BTG Pactual (se ainda não tiver). 2. Faça o teste de perfil de investidor no app. 3. Explore as opções de [Categoria Sugerida] na nossa plataforma de investimentos. 4. Considere agendar uma conversa com um de nossos assessores de investimento para um plano personalizado.").
    6.  **Considerações Adicionais:** Inclua uma breve menção sobre a importância de ter uma reserva de emergência SEPARADA da meta e sobre a necessidade de revisar e ajustar o plano periodicamente (anualmente, por exemplo).
    7.  **Tom:** Mantenha um tom extremamente cordial, profissional e encorajador, como um consultor financeiro do BTG Pactual.

    Formate a resposta de maneira clara, usando títulos ou bullet points para separar as seções. NÃO use a estrutura Thought/Action/Observation aqui. Gere apenas a resposta final completa.`;

    // Cria e formata o prompt
    const formattedPrompt = await PromptTemplate.fromTemplate(detailedPromptTemplate).format({ goal });
    
    // Invoca o LLM com o prompt detalhado
    const response = await llm.invoke(formattedPrompt);

    console.log("------------------------------------");
      console.log("RAW LLM Response (goalPlanTool):");
      console.dir(response, { depth: null }); // Mostra o objeto completo
      console.log("------------------------------------");

      // Verifique se a resposta tem metadados e o finishReason
      if (response.response_metadata && response.response_metadata.finishReason) {
        console.log(`LLM Finish Reason: ${response.response_metadata.finishReason}`);
        // Possíveis razões: "STOP", "MAX_TOKENS", "SAFETY", "RECITATION", "OTHER"
      }
    
    // Retorna o conteúdo da resposta
    return response.content;
  },
});

// --- 4. Agente ---
const tools = [analyseTransactionsTool, financeDoubtTool, goalPlanTool];

const systemPrompt = `
    Você é um assistente financeiro da BTG Pactual.
    responda cordialmente e direcione a conversa sempre para servicos internos
    do BTG.

    !! INSTRUÇÕES FUNDAMENTAIS:
    - TODAS AS RESPOSTAS DEVEM TER NO MÍNIMO 6 PARÁGRAFOS BEM DESENVOLVIDOS.
    - Nunca responda de forma curta ou superficial.
    - Mesmo que a pergunta do usuário seja simples, desenvolva um raciocínio amplo, contextualize, explique conceitos financeiros, traga exemplos práticos, cenários e recomendações adicionais.
    - Use um tom profissional, cordial e consultivo, como um especialista do BTG Pactual.
    - Finalize sempre com um **resumo prático** e uma **chamada para ação** relacionada aos serviços do BTG.
    Evite respostas no estilo “one-liner” ou apenas listas secas.
    `;



const agentPrompt = ChatPromptTemplate.fromMessages([
  ['system', systemPrompt],
  new MessagesPlaceholder('chat_history'), 
  ['human', '{input}'], 
  new MessagesPlaceholder('agent_scratchpad'), 
]);


const checkpointer = new MemorySaver();

const agent = await createAgent({
  model:llm,
  tools,
  prompt: agentPrompt,
  checkpointer
});

function splitMessageByWords(text, maxLength = 1500) {
  const parts = [];
  let currentPart = "";

  const words = text.split(/\s+/); // divide por espaços em branco
  for (const word of words) {
    // se adicionar a próxima palavra estoura o limite
    if ((currentPart + " " + word).trim().length > maxLength) {
      parts.push(currentPart.trim());

      currentPart = word; // começa um novo bloco
    } else {
      currentPart += (currentPart.length === 0 ? "" : " ") + word;
    }
  }

  if (currentPart.trim().length > 0) {
    parts.push(currentPart.trim());
  }

  return parts;
}


export async function receive_prompt(message) {

  if (message.startsWith('/') && message.startsWith('./')) {
    if (fs.existsSync(message)) {
      console.log("Lendo PDF...");
      try {
        message = await readPdf(message); 
        console.log("PDF lido com sucesso.");

        
      } catch (e) {
        console.log("Erro ao ler PDF:", e.message);
        return; 
      }

    } else {
      console.log("Erro: Arquivo não encontrado.");
      return;
    }
  }
  
  const result = await agent.invoke({
    messages:[{role:"user",content:message},
      
    ]},
    { configurable: { thread_id: "1" } }
  );
    
    
  const text = splitMessageByWords(result.messages.at(-1).content,1500);

  console.log("\nAssistente:", text);

  

  return text;
} 


