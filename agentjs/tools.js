// tools.js
import fs from 'fs';
import pdfCallbackFunction from 'pdf-to-text'; // Importa a função de callback

/**
 * Envolve a função de callback 'pdf-to-text' em uma Promise
 * para que possamos usar async/await.
 */
function manualPdfToText(filePath) {
  return new Promise((resolve, reject) => {
    pdfCallbackFunction(filePath, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

/**
 * Lê o conteúdo de texto de um arquivo PDF.
 */
export async function readPdf(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo não encontrado: ${filePath}`);
    }
    const data = await manualPdfToText(filePath);
    return data;
  } catch (error) {
    console.error("Erro ao ler o PDF com pdf-to-text:", error.message);
    if (error.message.includes('pdftotext: command not found')) {
      console.error("\n[ERRO CRÍTICO]: O 'pdftotext' (poppler) não está instalado.");
      console.error("Rode: sudo apt-get install poppler-utils");
    }
    throw error;
  }
}