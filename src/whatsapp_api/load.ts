import { Op } from "sequelize";
import { findClient } from "./findClient";
import ClientModel from "../models/client";
import log from "../lib/logger";

// Intervalo entre o início de cada sessão no boot. Subir dezenas de sessões
// ao mesmo tempo (handshake, pre-keys, sync, importação de lid) estoura o
// load average da VM e o watchdog do host reinicia a máquina.
const STARTUP_INTERVAL_MS = 3000;

export async function loadClients() {
  const clients = await ClientModel.findAll({
    where: {
      ready: {
        [Op.eq]: true,
      },
    },
  });
  // Não bloqueia o boot (webhooks pendentes etc. seguem em paralelo)
  (async () => {
    for (const client of clients) {
      const id = client.get("clientId");
      findClient(id, true).catch((error) => {
        log.error(`Falha ao iniciar client ${id}:`, error);
      });
      await new Promise((resolve) => setTimeout(resolve, STARTUP_INTERVAL_MS));
    }
  })();
}
