import migration from "./models/migration";
import sequelize from "./lib/sequelize";
import { createWebServer } from "./webServer";
import { loadClients } from "./whatsapp_api/load";
import log from "./lib/logger";
sequelize
  // Test if database can auth
  .authenticate()
  // Migrate the database
  .then(migration)
  // Start webServer
  .then(createWebServer)
  // Load web clients in database
  .then(loadClients)
  .catch((error) => {
    log.error("Unable to start:", error);
    process.exit(1);
  });
