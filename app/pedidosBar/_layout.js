import { Stack } from 'expo-router';
export default function Layout() {
  return (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="criarFesta" options={{ title: 'Criar Festa' }} />
        <Stack.Screen name="clientInfo" options={{ title: 'Informações do Cliente' }} />
        <Stack.Screen name="selecaoBebidas" options={{ title: 'Seleção de Drinks' }} />
        <Stack.Screen name="orderSummary" options={{ title: 'Resumo do Pedido' }} />
      </Stack>
  );
}