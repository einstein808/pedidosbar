
import TcpSocket from 'react-native-tcp-socket';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const getBaristaIp = async () => {
  try {
    const ip = await AsyncStorage.getItem('@barman_barista_ip');
    return ip || null;
  } catch {
    return null;
  }
};

export const setBaristaIp = async (ip) => {
  try {
    await AsyncStorage.setItem('@barman_barista_ip', ip.trim());
  } catch (e) {
    console.error('Erro ao salvar IP do Barista', e);
  }
};

// -- ARQUITETURA BIDIRECIONAL --
let persistentClient = null;
let isConnected = false;
let statusUpdateCallback = null;
const pendingRequests = new Map(); // Mapa de { orderId -> { resolve, reject, timer } }
let reconnectTimer = null;

export const startP2PListener = async (onStatusUpdate) => {
  if (persistentClient) return; // já iniciado
  statusUpdateCallback = onStatusUpdate;

  const ip = await getBaristaIp();
  if (!ip) {
    console.log('[LocalClient] IP não configurado. P2P Listener abortado.');
    return;
  }

  const connect = () => {
    if (persistentClient) {
      try { persistentClient.destroy(); } catch (_) {}
    }

    persistentClient = new TcpSocket.Socket();
    let buffer = '';

    persistentClient.on('connect', () => {
      console.log(`[LocalClient] 📡 Conectado de forma persistente ao Barista em ${ip}:8080`);
      isConnected = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
    });

    persistentClient.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // mantém fragmento incompleto

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const response = JSON.parse(trimmed);
          
          if (response.type === 'STATUS_UPDATE') {
            // Notifica store de que houve alteração feita pelo Barman offline!
            if (statusUpdateCallback) {
              statusUpdateCallback(response.orderId, response.status);
            }
          }
          else if (response.status === 'OK' && response.orderId) {
            // Resolve Promessas de pedidos recém enviados
            if (pendingRequests.has(response.orderId)) {
              const req = pendingRequests.get(response.orderId);
              clearTimeout(req.timer);
              req.resolve(true);
              pendingRequests.delete(response.orderId);
            }
          }
        } catch { /* Aguarda mais blocos JSON da pipeline TCP */ }
      }
    });

    persistentClient.on('error', (err) => {
      console.log('[LocalClient] Erro no Socket Persistente:', err.message);
      isConnected = false;
    });

    persistentClient.on('close', () => {
      console.log('[LocalClient] Conexão Persistente Perdida. Tentando reconectar em 10s...');
      isConnected = false;
      persistentClient = null;
      reconnectTimer = setTimeout(connect, 10000); // 10 segundos para reconectar
    });

    try {
      persistentClient.connect({ port: 8080, host: ip, reuseAddress: true });
    } catch (_) {}
  };

  connect();
};

export const sendOrderToBaristaP2P = async (orderData) => {
  const ip = await getBaristaIp();
  if (!ip) throw new Error('IP_NOT_CONFIGURED');
  
  return new Promise((resolve, reject) => {
    // Se temos conexão persistente aberta, reutilizamos para zero latency
    if (persistentClient && isConnected && orderData.offlineId) {
      const timer = setTimeout(() => {
        pendingRequests.delete(orderData.offlineId);
        reject(new Error('TIMEOUT_P2P'));
      }, 4000);

      pendingRequests.set(orderData.offlineId, { resolve, reject, timer });

      try {
        persistentClient.write(JSON.stringify({ type: 'NEW_ORDER', order: orderData }) + '\n');
        return;
      } catch (err) {
        clearTimeout(timer);
        pendingRequests.delete(orderData.offlineId);
        // Falls through, tenta via single-shot abaixo...
      }
    }

    // Fallback: Modo One-Shot (legado) se o socket não estiver ativo
    let settled = false;
    let buffer = '';
    const tempClient = new TcpSocket.Socket();

    const finish = (success, error) => {
      if (settled) return;
      settled = true;
      try { tempClient.destroy(); } catch (_) {}
      if (success) resolve(true);
      else reject(error || new Error('TCP_FAILED'));
    };

    tempClient.on('connect', () => {
      tempClient.write(JSON.stringify({ type: 'NEW_ORDER', order: orderData }) + '\n');
    });

    tempClient.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const response = JSON.parse(trimmed);
          if (response.status === 'OK') finish(true);
        } catch { } // Ignora fragmentos
      }
    });

    tempClient.on('error', (err) => finish(false, err));
    tempClient.on('close', () => finish(false, new Error('CONNECTION_CLOSED')));

    const timer = setTimeout(() => finish(false, new Error('TIMEOUT_P2P')), 4000);
    try {
      tempClient.connect({ port: 8080, host: ip, reuseAddress: true });
    } catch (err) {
      clearTimeout(timer);
      finish(false, err);
    }
  });
};

export const pingBaristaP2P = (ipOverride) => {
  return new Promise((resolve, reject) => {
    if (!ipOverride) return reject(new Error('NO_IP'));
    
    let settled = false;
    let buffer = '';
    const tempClient = new TcpSocket.Socket();
    
    const finish = (success, error) => {
      if (settled) return;
      settled = true;
      try { tempClient.destroy(); } catch (_) {}
      if (success) resolve(true);
      else reject(error || new Error('TCP_FAILED'));
    };

    tempClient.on('connect', () => {
      tempClient.write(JSON.stringify({ type: 'PING' }) + '\n');
    });

    tempClient.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.trim().includes('PONG')) finish(true);
      }
    });

    tempClient.on('error', (err) => finish(false, err));
    tempClient.on('close', () => finish(false, new Error('CONNECTION_CLOSED')));

    const timer = setTimeout(() => finish(false, new Error('TIMEOUT_P2P')), 3000);
    
    try {
      tempClient.connect({ port: 8080, host: ipOverride, reuseAddress: true });
    } catch (err) {
      clearTimeout(timer);
      finish(false, err);
    }
  });
};

