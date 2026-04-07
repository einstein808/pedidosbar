import TcpSocket from 'react-native-tcp-socket';
import { enqueueOfflineOrder } from './offlineQueue';

let serverInstance = null;
let onOrderReceivedCallback = null;
const activeSockets = new Set(); // Mantém as conexões vivas

export const startLocalServer = (port = 8080) => {
  if (serverInstance) {
    console.log('[LocalServer] Já está rodando.');
    return;
  }

  try {
    serverInstance = TcpSocket.createServer((socket) => {
      console.log('[LocalServer] Cliente P2P conectado:', socket.remoteAddress);
      activeSockets.add(socket);

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
              
              if (onOrderReceivedCallback) {
                // Callback ativo (gerenciarPedidos aberto) — injeta direto na UI
                // NÃO enfileira na fila offline para evitar duplicação
                onOrderReceivedCallback(orderData);
              } else {
                // Nenhum listener ativo — salva na fila offline como fallback
                await enqueueOfflineOrder(orderData);
              }
              // Confirmação de recebimento
              socket.write(JSON.stringify({ status: 'OK', orderId: orderData.offlineId }) + '\n');

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
        activeSockets.delete(socket);
      });

      socket.on('close', () => {
        console.log('[LocalServer] Conexão encerrada.');
        buffer = '';
        activeSockets.delete(socket);
      });
    });

    serverInstance.listen({ port, host: '0.0.0.0' }, () => {
      console.log(`[LocalServer] ✅ Servidor TCP ativo na porta ${port}`);
    });

    serverInstance.on('error', (err) => {
      console.log('[LocalServer] Falha no servidor:', err.message);
      activeSockets.clear();
      serverInstance = null;
    });

  } catch (err) {
    console.log('[LocalServer] Exceção ao criar servidor:', err.message);
    serverInstance = null;
  }
};

export const stopLocalServer = () => {
  if (serverInstance) {
    activeSockets.forEach(sock => { try { sock.destroy(); } catch (_) { } });
    activeSockets.clear();
    try { serverInstance.close(); } catch (_) {}
    serverInstance = null;
    console.log('[LocalServer] Servidor finalizado e Sockets limpos.');
  }
};

export const isServerRunning = () => !!serverInstance;

export const setOnOrderReceived = (callback) => {
  onOrderReceivedCallback = callback;
};

// Nova Função: Transmite a alteração de status para todos os totens logados
export const broadcastOrderStatus = (orderId, novoStatus) => {
  if (activeSockets.size === 0) return;
  console.log(`[LocalServer] 📡 Fazendo broadcast local de alteração de status ${orderId} -> ${novoStatus}`);
  
  const payload = JSON.stringify({
    type: 'STATUS_UPDATE',
    orderId,
    status: novoStatus
  }) + '\n';

  let sents = 0;
  activeSockets.forEach(socket => {
    try {
      socket.write(payload);
      sents++;
    } catch (error) {
      console.log('[LocalServer] Erro ao enviar update para um socket:', error.message);
    }
  });
  console.log(`[LocalServer] Broadcast P2P enviado para ${sents} clientes vivos.`);
};
