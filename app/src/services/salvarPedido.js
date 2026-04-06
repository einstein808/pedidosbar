import { db } from "../config/firebaseConfig";
import { push, ref } from "firebase/database";
import NetInfo from '@react-native-community/netinfo';
import { enqueueOfflineOrder } from "./offlineQueue";

export const salvarPedido = async ({
  festaID,
  clientID,
  drinksSelecionados,
  nome,
  whatsapp
}) => {
  const pedido = {
    offlineId: `local-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    festaID,
    clientID,
    drinks: drinksSelecionados,
    nome,
    whatsapp,
    status: "pendente",
    timestamp: new Date().toISOString(),
  };

  const state = await NetInfo.fetch();
  
  if (state.isConnected) {
    try {
      await push(ref(db, "pedidos"), pedido);
    } catch (err) {
      console.error("Erro ao salvar online, movendo para fila local:", err);
      await enqueueOfflineOrder(pedido);
    }
  } else {
    // Modo offline
    await enqueueOfflineOrder(pedido);
  }
};

