
import pdfplumber
import pandas as pd


def read_pdf(file_path: str) -> str:
    """
    Lê o conteúdo textual de um PDF de extrato bancário.
    """
    text = ""
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text


def read_csv(file_path: str) -> str:
    """
    Lê um arquivo CSV com colunas (Data, Descrição, Valor)
    e o converte em uma string amigável para análise.
    """
    df = pd.read_csv(file_path)
    transactions = []
    for _, row in df.iterrows():
        transactions.append(f"{row['Data']} - {row['Descrição']} - {row['Valor']}")
    return "\n".join(transactions)
