import { useState } from 'react';
import { View, Text, TextInput, Button, Alert, ScrollView } from 'react-native';
import { getDatabase, ref, push, set } from 'firebase/database';
import { app } from '../src/config/firebaseConfig';
import { useRouter } from 'expo-router';
import { useAppStore } from '../src/store/useAppStore';

export default function CriarFesta() {
  const selectParty = useAppStore(s => s.setFestaSelecionada);
  const [nome, setNome] = useState('');
  const [data, setData] = useState('');
  const [quantidadeConvidados, setQuantidadeConvidados] = useState('');
  const [nomePacote, setNomePacote] = useState('');
  const [valorPorConvidado, setValorPorConvidado] = useState('');
  const [custoMaoDeObra, setCustoMaoDeObra] = useState('350');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const criarFesta = () => {
    if (!nome || !data || !quantidadeConvidados || !custoMaoDeObra) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos obrigatórios (Nome, Data, Convidados, Mão de Obra).');
      return;
    }

    setLoading(true);
    const db = getDatabase(app);
    const festasRef = ref(db, 'festas');
    const novaFestaRef = push(festasRef);

    const novaFesta = {
      uid: novaFestaRef.key,
      nome,
      data,
      quantidadeConvidados: parseInt(quantidadeConvidados, 10),
      pacote: {
        nome: nomePacote,
        valorPorConvidado: parseFloat(valorPorConvidado) || 0
      },
      custoMaoDeObra: parseFloat(custoMaoDeObra),
      status: 'pendente',
      timestamp: new Date().toISOString(),
    };

    set(novaFestaRef, novaFesta)
      .then(() => {
        setLoading(false);
        selectParty(novaFesta); // Update context with new party
        Alert.alert('Sucesso', 'Festa criada com sucesso!');
        router.push('/festa'); // Navigate to party management screen
      })
      .catch((error) => {
        setLoading(false);
        Alert.alert('Erro', 'Erro ao criar festa.');
        console.error(error);
      });
  };

  return (
    <ScrollView className="p-4 bg-white">
      <Text className="text-xl font-bold mb-4 text-gray-800">Criar uma Festa (Barista)</Text>
      
      <Text className="font-semibold mb-1 text-gray-700">Detalhes Gerais</Text>
      <TextInput
        value={nome}
        onChangeText={setNome}
        placeholder="Nome da Festa"
        className="border border-gray-300 p-2 mb-4 rounded bg-gray-50 text-gray-800"
      />
      <TextInput
        value={data}
        onChangeText={setData}
        placeholder="Data da Festa"
        className="border border-gray-300 p-2 mb-4 rounded bg-gray-50 text-gray-800"
      />
      <TextInput
        value={quantidadeConvidados}
        onChangeText={setQuantidadeConvidados}
        placeholder="Quantidade de Convidados"
        keyboardType="numeric"
        className="border border-gray-300 p-2 mb-4 rounded bg-gray-50 text-gray-800"
      />

      <View className="mb-4 bg-gray-50 rounded-lg border border-gray-200 p-4 shadow-sm">
        <Text className="font-bold mb-3 text-gray-800">Detalhes Financeiros:</Text>
        <Text className="text-gray-600 mb-1 text-sm font-medium">Nome do Pacote (Ex: Casarão Premium)</Text>
        <TextInput
          value={nomePacote}
          onChangeText={setNomePacote}
          placeholder="Nome do Pacote"
          className="border border-gray-300 p-2 mb-3 rounded bg-white text-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
        <Text className="text-gray-600 mb-1 text-sm font-medium">Valor Cobrado por Convidado (R$)</Text>
        <TextInput
          value={valorPorConvidado}
          onChangeText={setValorPorConvidado}
          placeholder="Ex: 50.00"
          keyboardType="numeric"
          className="border border-gray-300 p-2 mb-3 rounded bg-white text-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
        <Text className="text-gray-600 mb-1 text-sm font-medium">Custo de Mão de Obra (R$)</Text>
        <TextInput
          value={custoMaoDeObra}
          onChangeText={setCustoMaoDeObra}
          placeholder="Ex: 350.00"
          keyboardType="numeric"
          className="border border-gray-300 p-2 mb-1 rounded bg-white text-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </View>

      <Button
        title={loading ? 'Criando...' : 'Criar Festa'}
        onPress={criarFesta}
        disabled={loading}
        color="#2563ea"
      />
      <View className="h-10"></View>
    </ScrollView>
  );
}