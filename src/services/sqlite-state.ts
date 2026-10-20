import * as baileys from "baileys";
import Database from "better-sqlite3";

import { AuthenticationState } from "baileys";
import { type Database as DB, Options } from "better-sqlite3";

type AuthState = {
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  setCreds: (newCreds: baileys.AuthenticationCreds) => Promise<void>;
  readCreds: () => Promise<baileys.AuthenticationCreds>;
  removeCreds: () => Promise<void>;
};

export interface SQliteAuthState extends AuthState {
  db: DB;
}

export interface SQLiteAuthStateOptions extends Options {
  sessionId: string;
  filename: string;
}

// Um único handle por arquivo para o processo inteiro: abrir um Database novo
// a cada connect/reconexão vazava handles (cada um com seu cache de páginas)
// e esgotava a memória do servidor.
const databases = new Map<string, DB>();

function getDatabase(filename: string, databaseConfig: Options): DB {
  let db = databases.get(filename);
  if (!db) {
    db = new Database(filename, databaseConfig);
    db.pragma("journal_mode = WAL");
    db.prepare(
      "CREATE TABLE IF NOT EXISTS BaileysAuth (id TEXT PRIMARY KEY, value TEXT NOT NULL)"
    ).run();
    databases.set(filename, db);
  }
  return db;
}

export async function useSQLiteAuthState(
  options: SQLiteAuthStateOptions
): Promise<SQliteAuthState> {
  const { filename, sessionId, ...databaseConfig } = options;
  const prefix = `baileys-auth-state:${sessionId}`;
  const db = getDatabase(filename, databaseConfig);
  const readData = (key: string) => {
    const row = db
      .prepare("SELECT value FROM BaileysAuth WHERE id = ?")
      .get(`${prefix}:${key}`) as { value: string } | undefined;
    if (row?.value) {
      return JSON.parse(row.value, baileys.BufferJSON.reviver);
    }
    return null;
  };
  const writeData = (key: string, value: any) => {
    db.prepare(
      "INSERT INTO BaileysAuth (id, value) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET value = excluded.value"
    ).run(
      `${prefix}:${key}`,
      JSON.stringify(value, baileys.BufferJSON.replacer)
    );
  };
  const deleteData = (key: string) => {
    db.prepare("DELETE FROM BaileysAuth WHERE id = ?").run(`${prefix}:${key}`);
  };
  const creds: baileys.AuthenticationCreds =
    (await readData("creds")) || baileys.initAuthCreds();
  return {
    state: {
      creds,
      keys: {
        get: async <T extends keyof baileys.SignalDataTypeMap>(
          type: T,
          ids: string[]
        ) => {
          const data: { [id: string]: baileys.SignalDataTypeMap[T] } = {};
          for (const id of ids) {
            let value = await readData(`${type}-${id}`);
            if (value) {
              if (type === "app-state-sync-key") {
                value =
                  baileys.proto.Message.AppStateSyncKeyData.create(value);
              }
              data[id] = value;
            }
          }
          return data;
        },
        set: (data: baileys.SignalDataSet) => {
          for (const type in data) {
            const i = type as keyof baileys.SignalDataSet;
            for (const id in data[i]) {
              const value = data[i][id];
              if (value) {
                writeData(`${type}-${id}`, value);
              } else {
                deleteData(`${type}-${id}`);
              }
            }
          }
        },
      },
    },
    saveCreds: async () => {
      writeData("creds", creds);
    },
    setCreds: async (newCreds) => {
      writeData("creds", newCreds);
    },
    readCreds: async () => {
      return readData("creds");
    },
    removeCreds: async () => {
      db.prepare("DELETE FROM BaileysAuth WHERE id LIKE ?").run(`${prefix}:%`);
    },
    db,
  };
}
