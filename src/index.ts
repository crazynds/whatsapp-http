import migration from "./models/migration";
import sequelize from "./lib/sequelize";
import { createWebServer } from "./webServer";
import { loadClients } from "./whatsapp_api/load";
import log from "./lib/logger";
import {
  retryPendingWebhooksOnStartup,
  startWebhookRetryLoop,
} from "./services/webhookDeliveryService";
sequelize
  // Test if database can auth
  .authenticate()
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
