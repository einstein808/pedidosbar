import { useState } from 'react';
import { View, Text, TextInput, Button, Alert } from 'react-native';
import { getDatabase, ref, push, set } from 'firebase/database';
import { app } from '../src/config/firebaseConfig';
import { useRouter } from 'expo-router';

export default function CriarFesta() {
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
      Alert.alert('Erro', 'Por favor, preencha todos os campos.');
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
        valorPorConvidado: parseFloat(valorPorConvidado)
      },
      custoMaoDeObra: parseFloat(custoMaoDeObra),
      status: 'pendente',
      timestamp: new Date().toISOString(),
    };

    set(novaFestaRef, novaFesta)
      .then(() => {
        setLoading(false);
        Alert.alert('Sucesso', 'Festa criada com sucesso!');
        router.push(`/client-info?partyId=${novaFestaRef.key}`);
      })
      .catch((error) => {
        setLoading(false);
        Alert.alert('Erro', 'Erro ao criar festa.');
        console.error(error);
      });
  };

  return (
    <View className="p-4">
      <Text className="text-xl font-bold mb-4">Criar uma Festa</Text>
      <TextInput
        value={nome}
        onChangeText={setNome}
        placeholder="Nome da Festa"
        className="border border-gray-300 p-2 mb-4 rounded"
      />
      <TextInput
        value={data}
        onChangeText={setData}
        placeholder="Data da Festa"
        className="border border-gray-300 p-2 mb-4 rounded"
      />
      
      <TextInput
        value={quantidadeConvidados}
        onChangeText={setQuantidadeConvidados}
        placeholder="Quantidade de Convidados"
        keyboardType="numeric"
        className="border border-gray-300 p-2 mb-4 rounded"
      />

      <View className="mb-4">
        <Text className="font-bold mb-2">Criar Pacote para este Evento:</Text>
        <TextInput
          value={nomePacote}
          onChangeText={setNomePacote}
          placeholder="Nome do Pacote (Ex: Casamento Premium)"
          className="border border-gray-300 p-2 mb-2 rounded"
        />
        <TextInput
          value={valorPorConvidado}
          onChangeText={setValorPorConvidado}
          placeholder="Valor por Convidado (R$)"
          keyboardType="numeric"
          className="border border-gray-300 p-2 rounded"
        />
      </View>

      <TextInput
        value={custoMaoDeObra}
        onChangeText={setCustoMaoDeObra}
        placeholder="Custo Mão de Obra (R$)"
        keyboardType="numeric"
        className="border border-gray-300 p-2 mb-4 rounded"
      />
      <Button
        title={loading ? 'Criando...' : 'Criar Festa'}
        onPress={criarFesta}
        disabled={loading}
      />
    </View>
  );
}