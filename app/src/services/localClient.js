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

// Usa Socket diretamente (mais compatível com react-native-tcp-socket v6)
function _sendViaTCP(host, payload, resolve, reject, timeoutMs = 4000) {
  let settled = false;
  let buffer = '';

  const client = new TcpSocket.Socket();

  const finish = (success, error) => {
    if (settled) return;
    settled = true;
    try { client.destroy(); } catch (_) {}
    if (success) resolve(true);
    else reject(error || new Error('TCP_FAILED'));
  };

  client.on('connect', () => {
    console.log(`[LocalClient] Conectado ao Barista em ${host}:8080`);
    client.write(JSON.stringify(payload) + '\n');
  });

  client.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop(); // mantém fragmento incompleto no buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const response = JSON.parse(trimmed);
        if (response.status === 'OK' || response.status === 'PONG') {
          finish(true);
        } else {
          finish(false, new Error('REJECTED'));
        }
      } catch { /* aguarda mais chunks */ }
    }
  });

  client.on('error', (err) => {
    console.log('[LocalClient] Erro TCP:', err.message);
    finish(false, err);
  });

  client.on('close', () => {
    finish(false, new Error('CONNECTION_CLOSED'));
  });

  // Timeout de segurança
  const timer = setTimeout(() => {
    finish(false, new Error('TIMEOUT_P2P'));
  }, timeoutMs);

  // Executa a conexão
  try {
    client.connect({ port: 8080, host, reuseAddress: true });
  } catch (err) {
    clearTimeout(timer);
    finish(false, err);
  }
}

export const sendOrderToBaristaP2P = async (orderData) => {
  const ip = await getBaristaIp();
  if (!ip) throw new Error('IP_NOT_CONFIGURED');
  return new Promise((resolve, reject) => {
    _sendViaTCP(ip, { type: 'NEW_ORDER', order: orderData }, resolve, reject, 4000);
  });
};

export const pingBaristaP2P = (ipOverride) => {
  return new Promise((resolve, reject) => {
    if (!ipOverride) return reject(new Error('NO_IP'));
    _sendViaTCP(ipOverride, { type: 'PING' }, resolve, reject, 3000);
  });
};
