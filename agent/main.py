from dotenv import load_dotenv
from typing import List, Dict
from tools import read_pdf
from pydantic import BaseModel, Field  # ✅ ADICIONADO 'Field'
import os
import json

from langchain_google_genai import ChatGoogleGenerativeAI

from langchain.agents.structured_output import ToolStrategy
from langchain_core.output_parsers import PydanticOutputParser
from langchain.tools import tool
from langchain.agents import create_agent  
 # ✅ Substitui AgentExecutor

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")


# ✅ --- INÍCIO DAS MUDANÇAS ---

class TopExpense(BaseModel):
    """Define a estrutura de uma despesa principal."""
    description: str
    value: float
    category: str

class TransactionSummary(BaseModel):
    total_income: float
    total_expense: float
    balance: float
    expenses_by_category: Dict[str, float]
    
    # ✅ 'top_expenses' alterado para usar a nova classe 'TopExpense'
    top_expenses: List[TopExpense] 
    
    # ✅ 'tips' alterado para mapear 'tips_financeiras'
    #    O 'alias' diz ao Pydantic para procurar "tips_financeiras" no JSON
    tips: List[str] = Field(..., alias="tips_financeiras")

# ✅ --- FIM DAS MUDANÇAS ---


prompt_template ="""
Você é um assistente financeiro da BTG Pactual.
Analise o seguinte extrato bancário e retorne um JSON estruturado em:

- total_income
- total_expense
- balance
- expenses_by_category 
- top_expenses
- tips financeiras

Extrato:
{transactions}
"""

parser = PydanticOutputParser(pydantic_object=TransactionSummary)

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash", # Mantido o seu modelo
    temperature=0,
    api_key=api_key
)


@tool
def analyse_transactions(transactions: str) -> dict:
    """Analisa o extrato e retorna informações financeiras estruturadas."""
    prompt = prompt_template.format(transactions=transactions)
    response = llm.invoke(prompt)
    parsed = parser.parse(response.content)
    return parsed


agent = create_agent(
    model=llm,
    tools=[analyse_transactions],
    system_prompt=prompt_template,
    response_format=ToolStrategy(TransactionSummary)
)


transactions = read_pdf("./extrato.pdf")
print("chegou aqui ")

# Agora o 'parser' dentro da sua ferramenta 'analyse_transactions'
# deve conseguir validar o JSON retornado pela IA.
result = agent.invoke({"messages":[{"role":"user","content":transactions}]})

print("chegou aqui 2")

print(result["structured_response"]);