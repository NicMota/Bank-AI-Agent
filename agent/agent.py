from dotenv import load_dotenv
from typing import List, Dict
from tools import read_pdf
from pydantic import BaseModel
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
    
  
    top_expenses: List[TopExpense] 
    
    tips: List[str] 




prompt_template ="""
    Você é um assistente financeiro da BTG Pactual.
    responda cordialmente e direcione a conversa sempre para servicos internos
    do BTG 

    !!IMPORTANTE!! o usuario deve ter suas duvidas metas e etc respondidas em uma só mensagem. Por isso, 
    de respostas longas  e abrangentes que contenham todo o conteudo necessário para a resposta. !!!
"""

parser = PydanticOutputParser(pydantic_object=TransactionSummary)

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash", # Mantido o seu modelo
    temperature=0,
    api_key=api_key
)


#retirar duvida financeira
@tool
def finance_doubt(doubt:str) -> str:
    """ analisa a duvida financeira e retorna solucao para ela"""
    
    prompt = """ 
        Analise a seguinte duvida e retorne uma resposta 
        {doubt}
    """
    prompt = prompt.format(doubt=doubt)
    response = llm.invoke(prompt)
    return response.content
    
    


@tool
def analyse_transactions(transactions: str) -> dict:
    """Analisa o extrato e retorna informações financeiras estruturadas."""
    
    format_instructions = parser.get_format_instructions()
    
    prompt = """Analise o seguinte extrato bancário e retorne um JSON estruturado em:

    {format_instructions}
    
    Extrato:
    {transactions}
    """
    
    prompt = prompt.format(transactions=transactions, format_instructions=format_instructions)
    response = llm.invoke(prompt)
    parsed = parser.parse(response.content)
    print(parsed.model_dump())
    return parsed.model_dump()


class Goal:
    goal: str
    salary: float
    expense_avg: float
    expt_time: str

#planejamento de meta
@tool
def goal_plan(goal: str) -> str:
    
    """ analisa uma meta e retorna um plano para seu alcance"""
    
    prompt = """ 
    Analise a seguinte meta e formule um plano de ação para seu alcance (junto a meta voce recebera salario, media de gastos, e tempo esperado )

        {goal}

        
    """
    
    prompt = prompt.format(goal=goal)
    response = llm.invoke(prompt)
    return response.content


agent = create_agent(
    model=llm,
    tools=[analyse_transactions,finance_doubt,goal_plan],
    system_prompt=prompt_template,
)



message = input("")

if(message.startswith('./')):
    message = read_pdf(message)
    
result = agent.invoke({"messages":[{"role":"user","content":message}]})
print(result["messages"][-1].content)


