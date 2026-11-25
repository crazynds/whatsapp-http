import sequelize from "../lib/sequelize";
import { DataTypes } from "@sequelize/core";

const Client = sequelize.define("client", {
  clientId: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  phoneId: DataTypes.STRING,
  name: DataTypes.STRING,
  qrCode: DataTypes.STRING,
  ready: DataTypes.BOOLEAN,

  webHook: DataTypes.STRING,

  // Fingerprint de browser/SO escolhido na primeira conexão e reusado em
  // todas as reconexões, para o WhatsApp sempre ver o mesmo "aparelho".
  browserFingerprint: DataTypes.STRING,
});

/**
 * Substitui o findOrCreate do Sequelize, que roda SELECT + INSERT dentro de
 * uma transação: no SQLite, subir o lock de leitura para escrita no meio da
 * transação falha na hora com SQLITE_BUSY quando outra conexão está
 * escrevendo (o busyTimeout não vale aí, para evitar deadlock). Aqui o INSERT
 * roda sozinho e espera o lock normalmente.
 */
export async function findOrCreateClient(
  clientId: string,
): Promise<[InstanceType<typeof Client>, boolean]> {
  const found = await Client.findByPk(clientId);
  if (found) return [found, false];
  try {
    return [await Client.create({ clientId }), true];
  } catch (error) {
    // Outra chamada criou o mesmo client ao mesmo tempo
    const existing = await Client.findByPk(clientId);
    if (existing) return [existing, false];
    throw error;
  }
}

export default Client;
