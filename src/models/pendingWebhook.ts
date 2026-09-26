import sequelize from "../lib/sequelize";
import { DataTypes } from "@sequelize/core";

/**
 * Fila de entrega de webhooks persistida em disco. Toda mensagem/evento
 * é gravado aqui antes de tentar o envio, para não perder nada se o
 * processo cair no meio do fetch. Removido ao confirmar 2xx, incrementado
 * em falha, e descartado após esgotar as tentativas.
 */
const PendingWebhook = sequelize.define("pendingWebhook", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  clientId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  webhookUrl: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  payload: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  attempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  nextAttemptAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
});

export default PendingWebhook;
