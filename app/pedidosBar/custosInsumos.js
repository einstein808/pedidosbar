import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { getDatabase, ref, onValue, set, remove } from 'firebase/database';
import { app } from '../src/config/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import '../../global.css';

export default function CustosInsumosScreen() {
  const [insumos, setInsumos] = useState([]);
  const [nome, setNome] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [unidade, setUnidade] = useState('ml');
  const [preco, setPreco] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const db = getDatabase(app);

  useEffect(() => {
    const insumosRef = ref(db, 'insumos');
    const unsubscribe = onValue(insumosRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const lista = Object.keys(data).map((key) => ({ id: key, ...data[key] }));
        setInsumos(lista);
      } else {
        setInsumos([]);
      }
    }, (error) => {
      Alert.alert('Erro', 'Falha ao carregar insumos: ' + error.message);
    });
    return () => unsubscribe();
  }, []);

  const parsePreco = (val) => {
    let cleanVal = val.replace(/,/g, '.').replace(/[^0-9.]/g, '');
    return parseFloat(cleanVal);
  };

  const handleSave = async () => {
    if (!nome || !quantidade || !preco) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos do insumo.');
      return;
    }

    const qtdNum = parseFloat(quantidade);
    const precoNum = parsePreco(preco);

    if (isNaN(qtdNum) || isNaN(precoNum) || qtdNum <= 0) {
      Alert.alert('Erro', 'Valores de quantidade e preço precisam ser numéricos válidos e maiores que zero.');
      return;
    }

    const safeId = editingId || nome.trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
    const custoUnidadeMinima = precoNum / qtdNum;

    setSaving(true);
    try {
      const insumoRef = ref(db, `insumos/${safeId}`);
      
      const existingInsumo = insumos.find(i => i.id === safeId);
      let historico = [];
      if (existingInsumo && existingInsumo.historicoPrecos) {
        historico = [...existingInsumo.historicoPrecos];
      }
      
      const lastHist = historico.length > 0 ? historico[historico.length - 1] : null;
      if (!lastHist || lastHist.precoPack !== precoNum) {
         historico.push({
           dataHora: new Date().toISOString(),
           precoPack: precoNum,
           custoUnidadeMinima: custoUnidadeMinima
         });
      }

      await set(insumoRef, {
        nome: nome.trim(),
        quantidadeFechada: qtdNum,
        unidade,
        precoPack: precoNum,
        custoUnidadeMinima,
        historicoPrecos: historico,
        timestamp: new Date().toISOString()
      });

      cancelEdit();
      Alert.alert('Sucesso', editingId ? 'Insumo atualizado!' : 'Insumo e custo cadastrado!');
    } catch (error) {
      Alert.alert('Erro', 'Erro ao salvar o insumo: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setNome(item.nome);
    setQuantidade(item.quantidadeFechada.toString());
    setUnidade(item.unidade);
    setPreco(item.precoPack.toFixed(2).replace('.', ','));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNome('');
    setQuantidade('');
    setPreco('');
    setUnidade('ml');
  };

  const deleteInsumo = (id, nomeInsumo) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Tem certeza que deseja apagar ${nomeInsumo}?`)) {
        remove(ref(db, `insumos/${id}`));
      }
      return;
    }
    Alert.alert(
      'Remover Insumo',
      `Tem certeza que deseja apagar ${nomeInsumo}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Apagar', 
          style: 'destructive',
          onPress: async () => {
             const insumoRef = ref(db, `insumos/${id}`);
             await remove(insumoRef);
          }
        }
      ]
    );
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const inputStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#c8cac6',
  };

  const labelStyle = {
    color: '#707b55',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0EA' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <FlatList
          data={insumos}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          ListHeaderComponent={
            <View>
              {/* Header */}
              <Animated.View entering={FadeInUp.duration(500)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 28 }}>
                  <TouchableOpacity
                    onPress={() => router.back()}
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 12,
                      padding: 10,
                      borderWidth: 1,
                      borderColor: '#c8cac6',
                    }}
                  >
                    <Ionicons name="arrow-back" size={22} color="#1c1f0f" />
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="cash-outline" size={24} color="#78a764" />
                    <Text style={{ color: '#1c1f0f', fontSize: 22, fontWeight: '700' }}>Gestão de Custos</Text>
                  </View>
                  <View style={{ width: 42 }} />
                </View>
              </Animated.View>

              {/* Form de Cadastro */}
              <Animated.View entering={FadeInUp.duration(500).delay(100)}>
                <View style={{ backgroundColor: 'rgba(120, 167, 100, 0.05)', borderRadius: 24, padding: 20, marginBottom: 32, borderWidth: 1, borderColor: 'rgba(120, 167, 100, 0.2)' }}>
                  
                  <View style={{ marginBottom: 14 }}>
                    <Text style={labelStyle}>Nome do Insumo (Embalagem Fechada)</Text>
                    <View style={inputStyle}>
                      <Ionicons name="cube-outline" size={18} color="#78a764" style={{ marginRight: 10 }} />
                      <TextInput
                        value={nome}
                        onChangeText={setNome}
                        placeholder="Ex: Vodka Smirnoff, Gin Tanqueray"
                        placeholderTextColor="#a0a29f"
                        style={{ flex: 1, color: '#1c1f0f', fontSize: 15 }}
                        autoCapitalize="words"
                      />
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
                    <View style={{ flex: 2 }}>
                      <Text style={labelStyle}>Tamanho / Peso</Text>
                      <View style={inputStyle}>
                        <Ionicons name="scale-outline" size={18} color="#78a764" style={{ marginRight: 8 }} />
                        <TextInput
                          value={quantidade}
                          onChangeText={setQuantidade}
                          placeholder="Ex: 1000"
                          keyboardType="numeric"
                          placeholderTextColor="#a0a29f"
                          style={{ flex: 1, color: '#1c1f0f', fontSize: 15 }}
                        />
                      </View>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={labelStyle}>Unidade</Text>
                      <View style={{ ...inputStyle, paddingHorizontal: 4, paddingVertical: 0, justifyContent: 'center' }}>
                        <Picker
                          selectedValue={unidade}
                          onValueChange={setUnidade}
                          style={{ flex: 1, color: '#1c1f0f', transform: [{ scale: 0.9 }] }}
                        >
                          <Picker.Item label="ml" value="ml" />
                          <Picker.Item label="g" value="g" />
                          <Picker.Item label="un" value="un" />
                        </Picker>
                      </View>
                    </View>
                  </View>

                  <View style={{ marginBottom: 20 }}>
                    <Text style={labelStyle}>Preço Pago</Text>
                    <View style={inputStyle}>
                      <Text style={{ color: '#78a764', fontSize: 15, fontWeight: '700', marginRight: 8 }}>R$</Text>
                      <TextInput
                        value={preco}
                        onChangeText={setPreco}
                        placeholder="0,00"
                        keyboardType="numeric"
                        placeholderTextColor="#a0a29f"
                        style={{ flex: 1, color: '#1c1f0f', fontSize: 15, fontWeight: '600' }}
                      />
                    </View>
                  </View>

                  <View style={{ gap: 12 }}>
                    <TouchableOpacity
                      onPress={handleSave}
                      disabled={saving}
                      activeOpacity={0.85}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#78a764',
                        paddingVertical: 14,
                        borderRadius: 14,
                        gap: 8,
                        opacity: saving ? 0.7 : 1,
                      }}
                    >
                      {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name={editingId ? "sync-outline" : "save-outline"} size={20} color="#FFFFFF" />}
                      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>{editingId ? 'Atualizar Insumo' : 'Cadastrar Insumo'}</Text>
                    </TouchableOpacity>

                    {editingId && (
                      <TouchableOpacity
                        onPress={cancelEdit}
                        disabled={saving}
                        activeOpacity={0.85}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: '#FFFFFF',
                          paddingVertical: 14,
                          borderRadius: 14,
                          borderWidth: 1.5,
                          borderColor: '#c8cac6',
                          gap: 8,
                        }}
                      >
                        <Ionicons name="close-outline" size={20} color="#707b55" />
                        <Text style={{ color: '#707b55', fontWeight: '700', fontSize: 15 }}>Cancelar Edição</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                </View>

                {/* Título da Lista */}
                {insumos.length > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                    <Ionicons name="server-outline" size={20} color="#cc9e6f" style={{ marginRight: 8 }} />
                    <Text style={{ color: '#1c1f0f', fontSize: 18, fontWeight: '700' }}>Insumos e Preços Unitários</Text>
                  </View>
                )}
              </Animated.View>
            </View>
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInUp.duration(400).delay(index * 50)}>
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 18,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 1.5,
                  borderColor: '#e8e4de',
                  flexDirection: 'row',
                  alignItems: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.03,
                  shadowRadius: 6,
                  elevation: 2,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#1c1f0f', fontSize: 16, fontWeight: '700', marginBottom: 6 }}>
                    {item.nome}
                  </Text>
                  
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                    <Text style={{ color: '#c8cac6', fontSize: 12, fontWeight: '600' }}>
                      PAGO: <Text style={{ color: '#1c1f0f' }}>{formatCurrency(item.precoPack)}</Text> ({item.quantidadeFechada}{item.unidade})
                    </Text>
                  </View>
                  
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <View style={{ backgroundColor: 'rgba(120, 167, 100, 0.1)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                       <Text style={{ color: '#78a764', fontSize: 13, fontWeight: '800' }}>
                         Fração: {formatCurrency(item.custoUnidadeMinima)} / {item.unidade}
                       </Text>
                    </View>
                    <View style={{ backgroundColor: 'rgba(204, 158, 111, 0.15)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                       <Text style={{ color: '#ae7d4a', fontSize: 13, fontWeight: '800' }}>
                         📊 {item.historicoPrecos ? item.historicoPrecos.length : 1} Alterações
                       </Text>
                    </View>
                  </View>
                </View>

                <View style={{ gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => handleEdit(item)}
                    style={{ backgroundColor: 'rgba(204, 158, 111, 0.12)', borderRadius: 12, padding: 12, alignItems: 'center' }}
                  >
                    <Ionicons name="pencil-outline" size={18} color="#cc9e6f" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => deleteInsumo(item.id, item.nome)}
                    style={{ backgroundColor: 'rgba(200, 60, 60, 0.08)', borderRadius: 12, padding: 12, alignItems: 'center' }}
                  >
                    <Ionicons name="trash-outline" size={18} color="#c83c3c" />
                  </TouchableOpacity>
                </View>

              </View>
            </Animated.View>
          )}
          ListEmptyComponent={
            insumos.length === 0 ? (
              <View style={{ alignItems: 'center', marginTop: 10 }}>
                <Ionicons name="receipt-outline" size={48} color="#e8e4de" />
                <Text style={{ color: '#c8cac6', fontSize: 14, textAlign: 'center', marginTop: 12 }}>
                  Nenhum insumo lançado no estoque financeiro.
                </Text>
              </View>
            ) : null
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
