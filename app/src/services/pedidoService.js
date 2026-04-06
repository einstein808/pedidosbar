import { db } from '../../src/config/firebaseConfig';
import { ref, push, set } from 'firebase/database';

export async function enviarPedido({ nome, whatsapp, drink, quantidade }) {
  const clientesRef = ref(db, 'clientes');
  const clienteRef = push(clientesRef);
  await set(clienteRef, { nome, whatsapp });

  const festasRef = ref(db, 'festas');
  const novaFestaRef = push(festasRef);
  await set(novaFestaRef, {
    nome: 'Festa de Aniversário',
    data: new Date().toISOString().split('T')[0],
  });

  const pedidosRef = ref(db, `pedidos/${novaFestaRef.key}`);
  const novoPedidoRef = push(pedidosRef);
  await set(novoPedidoRef, {
    clienteId: clienteRef.key,
    nomeCliente: nome,
    drink,
    quantidade: Number(quantidade),
    status: 'pendente',
    timestamp: new Date().toISOString(),
  });
}
