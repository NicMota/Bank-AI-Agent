import matplotlib.pyplot as plt

dadosTestes = {'total_income': 1710.44, 'total_expense': 1719.56, 'balance': 131.86, 
               'expenses_by_category': 
                {'Alimentação': 714.89, 'Lazer': 56.0, 'Devolução': 300.0, 'Transferência/Pessoal': 397.48, 'Educação': 110.0, 'Saúde': 29.0, 'Serviços Financeiros': 10.0, 
                 'Compras Online': 93.19, 'Serviços/Outros': 9.0}, 'top_expenses': [{'description': 'PIX Pix enviado para PIZZARIA MASSAROSA', 'value': 131.12,
                                                                                     'category': 'Alimentação'}, {'description': 'PIX Pix enviado para Rafael Sato Myauti', 
                                                                                                                  'value': 94.0, 'category': 'Transferência/Pessoal'}, 
                                                                                                                   {'description': 'PIX Pix enviado para R & R RESTAURANTE DONA DORA LTDA', 'value': 91.25, 'category': 'Alimentação'}], 'tips': ["Seus gastos com 'Alimentação' são os mais altos, representando uma parcela significativa das suas despesas. Considere preparar mais refeições em casa ou estabelecer um orçamento para restaurantes e delivery para economizar.", 'Há um volume considerável de transferências PIX para pessoas físicas (ex: Rafael Sato Myauti, Marcilei Aparecida Constante). É importante ter clareza sobre a natureza dessas transações (empréstimos, divisão de contas, presentes) e, se forem empréstimos, garantir o registro e o acompanhamento.', "Os gastos com 'Lazer' (incluindo jogos e eventos) são recorrentes. Avalie se esses gastos estão alinhados com suas prioridades financeiras e se há oportunidades para atividades de lazer mais econômicas.", "A 'Devolução PIX' de R$ 300,00 pode indicar uma transação que não se concretizou ou um estorno. Monitore essas ocorrências para garantir que não haja perdas financeiras inesperadas e que o valor esteja correto."]}


def gerar_grafico(labels, dados, titulo):  
    fig, ax = plt.subplots()
    ax.pie(dados, labels=labels, autopct='%1.1f%%', startangle=90)
    ax.set_title(titulo)
    ax.axis('equal') # Garante que o gráfico seja um círculo

def Gerar_Graficos_Informacoes(dados):
  Grafico_Renda_Gastos(dados)
  Grafico_Tipos_Gastos(dados)
  Grafico_Alimentacao_Saude(dados)
  Grafico_Alimentacao_Lazer(dados)
  Grafico_Educacao_Saude(dados)
  Grafico_Lazer_Educacao(dados)

def Grafico_Renda_Gastos(dados):
  gerar_grafico(["Sobra", "Gastos"],[dados['balance'], dados['total_expense']], 'Quanto os gastos ocuparam da renda')
  salvar_grafico_em_jpeg('Grafico_Renda_Gastos')

def Grafico_Tipos_Gastos(dados):
    rotulos = [
        "Alimentação", "Lazer", "Devolução", "Transferência/Pessoal", 
        "Educação", "Saúde", "Serviços Financeiros", 
        "Compras Online", "Serviços/Outros"
    ]
    gastos_por_categoria = dados['expenses_by_category']
    valores = [
        gastos_por_categoria['Alimentação'],
        gastos_por_categoria['Lazer'],
        gastos_por_categoria['Devolução'],
        gastos_por_categoria['Transferência/Pessoal'],
        gastos_por_categoria['Educação'],
        gastos_por_categoria['Saúde'],
        gastos_por_categoria['Serviços Financeiros'],
        gastos_por_categoria['Compras Online'],
        gastos_por_categoria['Serviços/Outros']
    ]
    gerar_grafico(
        rotulos, 
        valores, 
        'Distribuição de Gastos por Categoria'
    )
    salvar_grafico_em_jpeg('Grafico_Boletos_Outros')

def Grafico_Alimentacao_Saude(dados):
  gerar_grafico(
      ["Alimentação", "Saúde"],
      [dados['expenses_by_category']['Alimentação'], dados['expenses_by_category']['Saúde']],
      'Alimentação vs Saúde'
  )
  salvar_grafico_em_jpeg('Grafico_Alimentacao_Saude')

def Grafico_Alimentacao_Lazer(dados):
  Lazer = dados['expenses_by_category']['Lazer']+ dados['expenses_by_category']['Devolução']+ dados['expenses_by_category']['Transferência/Pessoal'] + dados['expenses_by_category']['Compras Online']+ dados['expenses_by_category']['Serviços/Outros']
  gerar_grafico(["Alimentação", "Lazer ou pessoais"], [dados['expenses_by_category']['Alimentação'], Lazer], 'Gastos com alimentação vs lazer')
  salvar_grafico_em_jpeg('Grafico_Gastos_Saude')

def Grafico_Educacao_Saude(dados):
  gerar_grafico(
      ["Educação", "Saúde"],
      [dados['expenses_by_category']['Educação'], dados['expenses_by_category']['Saúde']],
      'Educação vs Saúde'
  )
  salvar_grafico_em_jpeg('Grafico_Educacao_Saude')


def Grafico_Lazer_Educacao(dados):
  gerar_grafico(
      ["Lazer", "Educação"],
      [dados['expenses_by_category']['Lazer'], dados['expenses_by_category']['Educação']],
      'Lazer vs Educação'
  )
  salvar_grafico_em_jpeg('Grafico_Lazer_Educacao')

def salvar_grafico_em_jpeg(nome_arquivo, fig=None, dpi=300):
    """
    Salva um gráfico Matplotlib (Figure) em um arquivo JPEG.

    Args:
        nome_arquivo (str): O nome do arquivo a ser salvo (ex: 'meu_grafico.jpg').
        fig (matplotlib.figure.Figure, optional): O objeto Figure a ser salvo. 
                                                  Se None, usa o gráfico atual (plt.gcf()).
        dpi (int): Resolução (Dots Per Inch) da imagem. Quanto maior, melhor a qualidade.
    """
    if fig is None:
        # Pega a figura atual se nenhuma for fornecida
        fig = plt.gcf()
    
    # Adiciona a extensão .jpg se ela não estiver presente
    if not nome_arquivo.lower().endswith(('.jpg', '.jpeg')):
        nome_arquivo += '.jpg'

    try:
        # A função savefig() salva a figura no formato especificado pela extensão
        # O parâmetro format='jpeg' garante o formato correto, mas a extensão já o faz.
        fig.savefig(
            nome_arquivo, 
            format='jpeg', 
            dpi=dpi,
            bbox_inches='tight', # Corta espaços em branco desnecessários
        )
        print(f"Gráfico salvo com sucesso como JPEG: '{nome_arquivo}'")
    except Exception as e:
        print(f"Erro ao salvar o gráfico: {e}")

# Exemplo de Uso
if __name__ == '__main__':
  Gerar_Graficos_Informacoes(dadosTestes)
