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

export default Client;
