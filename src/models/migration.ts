import Client from "./client";
import sequelize from "../lib/sequelize";



export default async function () {
    //await Client.sync({alter:true});
    await sequelize.sync({alter:true});
}
