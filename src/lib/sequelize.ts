import { Sequelize } from "@sequelize/core";
import { SqliteDialect } from "@sequelize/sqlite3";
import type { Database } from "sqlite3";

const storagePath = process.env.DB_PATH || "./data/db.sqlite" || ":memory:";

const sequelize = new Sequelize({
  dialect: SqliteDialect,
  storage: storagePath,
  // Com dezenas de sessões escrevendo ao mesmo tempo, 2 conexões e 60s de
  // acquire estouravam ConnectionAcquireTimeoutError e derrubavam o processo.
  pool: { max: 4, idle: Infinity, maxUses: Infinity, acquire: 120_000 },
});

// Sem busyTimeout o sqlite3 falha na hora com SQLITE_BUSY quando outra
// conexão está escrevendo; assim ele espera o lock ser liberado.
sequelize.hooks.addListener("afterConnect", (connection) => {
  (connection as unknown as Database).configure("busyTimeout", 10_000);
});

export default sequelize;
