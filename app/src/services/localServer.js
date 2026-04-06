import TcpSocket from 'react-native-tcp-socket';
import { enqueueOfflineOrder } from './offlineQueue';

let serverInstance = null;
let onOrderReceivedCallback = null;

export const startLocalServer = (port = 8080) => {
  if (serverInstance) {
    console.log('[LocalServer] Já está rodando.');
    return;
  }

  try {
    serverInstance = TcpSocket.createServer((socket) => {
      console.log('[LocalServer] Cliente P2P conectado:', socket.remoteAddress);

      // Buffer por socket — TCP pode fragmentar o JSON em vários chunks
      let buffer = '';

      socket.on('data', async (data) => {
        buffer += data.toString();

        // NDJSON: divide por '\n', mantém fragmento incompleto no buffer
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const payload = JSON.parse(trimmed);

            if (payload.type === 'NEW_ORDER') {
              console.log('[LocalServer] ✅ Pedido P2P recebido:', payload.order?.nome);
              const orderData = { ...payload.order, source: 'TOTEM_P2P', status: 'pendente' };
              await enqueueOfflineOrder(orderData);
              if (onOrderReceivedCallback) onOrderReceivedCallback(orderData);
              socket.write(JSON.stringify({ status: 'OK' }) + '\n');

            } else if (payload.type === 'PING') {
              console.log('[LocalServer] 🏓 PING recebido, respondendo PONG');
              socket.write(JSON.stringify({ status: 'PONG' }) + '\n');
            }

          } catch (err) {
            console.log('[LocalServer] Linha inválida (ignorada):', trimmed.substring(0, 60));
          }
        }
      });

      socket.on('error', (err) => {
        console.log('[LocalServer] Socket error:', err.message);
        buffer = '';
      });

      socket.on('close', () => {
        console.log('[LocalServer] Conexão encerrada.');
        buffer = '';
      });
    });

    serverInstance.listen({ port, host: '0.0.0.0' }, () => {
      console.log(`[LocalServer] ✅ Servidor TCP ativo na porta ${port}`);
    });

    serverInstance.on('error', (err) => {
      console.log('[LocalServer] Falha no servidor:', err.message);
      serverInstance = null;
    });

  } catch (err) {
    console.log('[LocalServer] Exceção ao criar servidor:', err.message);
    serverInstance = null;
  }
};

export const stopLocalServer = () => {
  if (serverInstance) {
    try { serverInstance.close(); } catch (_) {}
    serverInstance = null;
    console.log('[LocalServer] Servidor finalizado.');
  }
};

export const isServerRunning = () => !!serverInstance;

export const setOnOrderReceived = (callback) => {
  onOrderReceivedCallback = callback;
};
