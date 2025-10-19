# Bank-AI-Agent

Um assistente pessoal bancário e sistema multiagente desenvolvido com Inteligência Artificial para revolucionar a interação do usuário com suas finanças.

## Visão Geral

O projeto **Bank-AI-Agent** é uma arquitetura de agentes de IA especializados que trabalham em conjunto para fornecer uma interface conversacional e inteligente para serviços bancários. Em vez de navegar por menus e interfaces tradicionais, os usuários podem interagir com a IA para consultar saldos, revisar transações, obter insights financeiros e potencialmente iniciar pagamentos.

Este sistema utiliza o poder dos Large Language Models (LLMs) em uma estrutura de múltiplos agentes para lidar com tarefas financeiras complexas e fornecer respostas precisas e personalizadas.

## Funcionalidades Principais

  * **Consulta de Saldo e Informações da Conta:** Permite que o usuário pergunte sobre o saldo atual e detalhes da conta usando linguagem natural.
  * **Análise e Histórico de Transações:** Capacidade de buscar e analisar o histórico de transações, identificando padrões, grandes gastos ou transações específicas.
  * **Arquitetura Multiagente:** Uso de agentes especializados (por exemplo, um `TransactionAgent`, um `AccountAgent` e um `SupervisorAgent`/Roteador) para delegar e resolver tarefas de forma eficiente.
  * **Interface Conversacional:** Interação amigável via chat do whatsapp.
  * **Recuperação Aumentada de Geração (RAG - *Retrieval-Augmented Generation*):** Uso de uma base de dados vetorial para fornecer contexto específico aos agentes.

## Tecnologias Utilizadas

Esta é uma lista de tecnologias comuns em projetos de agentes de IA, preencha com as que você realmente utilizou.

  * **Linguagem de Programação:** servidor para receber as requisições em expressjs, modelo de agente em python.
  * **Framework de Agentes/LLMs:** `[Ex: LangChain, LangGraph, CrewAI, AutoGen, Langchain4j]`
  * **Modelo de Linguagem (LLM):** `[Ex: OpenAI GPT-4, Gemini, Mistral, Llama 3]`

## Como Executar o Projeto (Guia Rápido)

### Pré-requisitos

Certifique-se de ter o seguinte instalado:

### 1\. Clonar o Repositório

```bash
git clone https://github.com/NicMota/Bank-AI-Agent.git
cd Bank-AI-Agent
```

### 2\. Configuração do Ambiente

Crie um ambiente virtual e instale as dependências:

```bash
# Para Python
python -m venv venv
source venv/bin/activate  # No Windows use: .\venv\Scripts\activate
pip install -r requirements.txt
```

### 3\. Configurar Chaves de API

Crie um arquivo `.env` na raiz do projeto e adicione suas chaves:

```
# Exemplo, substitua pelos nomes de variáveis reais do seu projeto
OPENAI_API_KEY="SUA_CHAVE_OPENAI_AQUI"
# ou
GEMINI_API_KEY="SUA_CHAVE_GEMINI_AQUI"
# URL ou credenciais para a API bancária simulada, se aplicável
BANK_API_URL="http://localhost:8000/api/"
```

### 4\. Executar o Agente

Inicie o agente ou o script principal.

```bash
# Exemplo, substitua pelo comando de execução real
python main.py
# ou
[Comando para executar a aplicação web/serviço]
```

## 🛠️ Estrutura do Projeto

A estrutura do projeto geralmente segue este padrão (ajuste conforme o seu código):

```
Bank-AI-Agent/
├── .env                  # Variáveis de ambiente
├── requirements.txt      # Dependências do Python
├── main.py               # Ponto de entrada principal
└── src/
    ├── agents/           # Módulos dos Agentes (e.g., TransactionAgent, AccountAgent)
    ├── tools/            # Definições das Ferramentas/Funções (chamadas de API bancária)
    ├── core/             # Lógica central (Supervisor/Roteador, configuração do LLM)
    └── data/             # Dados de exemplo/simulados (e.g., histórico de transações)
```



-----
