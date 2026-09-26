import { Sequelize } from "@sequelize/core";
import { SqliteDialect } from "@sequelize/sqlite3";

const storagePath = process.env.DB_PATH || "./data/db.sqlite" || ":memory:";

const sequelize = new Sequelize({
  dialect: SqliteDialect,
  storage: storagePath,
  pool: { max: 2, idle: Infinity, maxUses: Infinity },
});

export default sequelize;
