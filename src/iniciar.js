import { abrirBanco, iniciarBanco } from "./banco.js";
const db = await abrirBanco();
try {
  await iniciarBanco(db);
  console.log(`Banco inicializado: ${db.mode}.`);
} finally {
  await db.close();
}
