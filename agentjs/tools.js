import { PdfReader } from 'pdfreader';
import fs from 'fs';

export async function readPdf(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`Arquivo não encontrado: ${filePath}`));
    }

    let text = "";
    new PdfReader().parseFileItems(filePath, (err, item) => {
      if (err) reject(err);
      else if (!item) resolve(text);
      else if (item.text) text += item.text + " ";
    });
  });
}
