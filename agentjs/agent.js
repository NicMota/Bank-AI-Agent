// agent.js
import 'dotenv/config';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate, PromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { DynamicStructuredTool } from '@langchain/core/tools';
// ✅ Este é o caminho correto (para as versões que você vai instalar)
import { AgentExecutor, createToolCallingAgent } from "langchain/agents"; 
import { z } from 'zod';
import fs from 'fs';
import readlineSync from 'readline-sync';
import { readPdf } from './tools.js';

const apiKey = process.env.GEMINI_API_KEY;

// --- 1. Schemas (Zod) ---
const TopExpenseSchema = z.object({
  description: z.string().describe('Define a estrutura de uma despesa principal.'),
  value: z.number(),
  category: z.string(),
});
const TransactionSummarySchema = z.object({
  total_income: z.number(),
  total_expense: z.number(),
  balance: z.number(),
  expenses_by_category: z.record(z.number()).describe('Um objeto onde a chave é a categoria (string) e o valor é o total (float)'),
  top_expenses: z.array(TopExpenseSchema),
  tips: z.array(z.string()),
});

// --- 2. LLM ---
const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash", 
  temperature: 0,
  apiKey: apiKey,
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
  description: 'Analisa o extrato e retorna informações financeiras estruturadas.',
  schema: z.object({
    transactions: z.string().describe("O conteúdo de texto completo do extrato bancário."),
  }),
  func: async ({ transactions }) => {
    const parser = StructuredOutputParser.fromZodSchema(TransactionSummarySchema);
    const formatInstructions = parser.getFormatInstructions();
    const prompt = new PromptTemplate({
      template: `Analise o seguinte extrato bancário e retorne um JSON estruturado em:
        {format_instructions}
        Extrato:
        {transactions}`,
      inputVariables: ['transactions'],
      partialVariables: { format_instructions: formatInstructions },
    });
    const chain = prompt.pipe(llm).pipe(parser);
    try {
      const parsed = await chain.invoke({ transactions: transactions });
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
  description: 'analisa uma meta e retorna um plano para seu alcance',
  schema: z.object({
    goal: z.string().describe("A descrição da meta, que pode incluir salário, gastos e tempo"),
  }),
  func: async ({ goal }) => {
    const prompt = `Analise a seguinte meta e formule um plano de ação para seu alcance...
{goal}`;
    const formattedPrompt = await PromptTemplate.fromTemplate(prompt).format({ goal });
    const response = await llm.invoke(formattedPrompt);
    return response.content;
  },
});

// --- 4. Agente ---
const tools = [analyseTransactionsTool, financeDoubtTool, goalPlanTool];

const systemPrompt = `
    Você é um assistente financeiro da BTG Pactual.
    responda cordialmente e direcione a conversa sempre para servicos internos
    do BTG.

    !!IMPORTANTE!! o usuario deve ter suas duvidas metas e etc respondidas em uma só mensagem. Por isso, 
    de respostas longas e abrangentes que contenham todo o conteudo necessário para a resposta. !!!
`;

const agentPrompt = ChatPromptTemplate.fromMessages([
  ['system', systemPrompt],
  new MessagesPlaceholder('chat_history'), 
  ['human', '{input}'], 
  new MessagesPlaceholder('agent_scratchpad'), 
]);

const agent = await createToolCallingAgent({
  llm,
  tools,
  prompt: agentPrompt,
});

const agentExecutor = new AgentExecutor({
  agent,
  tools,
  verbose: false, 
});

// --- 5. Execução ---
export async function receive_prompt(message) {



  if (message.startsWith('./')) {
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
  
  const result = await agentExecutor.invoke({
    input: message,
    chat_history: [], // Envia histórico vazio
  });

  console.log("\nAssistente:", result.output);
}

