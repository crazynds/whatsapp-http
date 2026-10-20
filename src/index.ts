import migration from "./models/migration";
import sequelize from "./lib/sequelize";
import { createWebServer } from "./webServer";
import { loadClients } from "./whatsapp_api/load";
import log from "./lib/logger";
import {
  retryPendingWebhooksOnStartup,
  startWebhookRetryLoop,
} from "./services/webhookDeliveryService";

// Uma promise rejeitada sem catch (ex: timeout do pool do sequelize) não pode
// derrubar o processo inteiro e desconectar todas as sessões junto.
process.on("unhandledRejection", (reason) => {
  log.error("Unhandled rejection:", reason);
});

sequelize
  // Test if database can auth
  .authenticate()
  // WAL deixa leituras e escrita rodarem em paralelo (persistente no arquivo)
  .then(() => sequelize.query("PRAGMA journal_mode = WAL"))
  // Migrate the database
  .then(migration)
  // Start webServer
  .then(createWebServer)
  // Load web clients in database
  .then(loadClients)
  // Retry webhooks that didn't get delivered before the process restarted
  .then(retryPendingWebhooksOnStartup)
  .then(startWebhookRetryLoop)
  .catch((error) => {
    log.error("Unable to start:", error);
    process.exit(1);
  });
