import React, { useState, useEffect, useCallback } from 'react';
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
  Modal,
  ScrollView,
} from 'react-native';
import { getDatabase, ref, onValue, set, remove, get } from 'firebase/database';
import { app } from '../src/config/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAppStore } from '../src/store/useAppStore';
import { useNetworkStore } from '../src/store/useNetworkStore';
import { cacheData, getCachedData, CACHE_KEYS } from '../src/services/offlineCache';

export default function EstoqueFestaScreen() {
  const festaSelecionada = useAppStore(s => s.festaSelecionada);
  const isPartyLoaded = useAppStore(s => s.isPartyLoaded);
  const selectParty = useAppStore(s => s.setFestaSelecionada);
  const [estoque, setEstoque] = useState([]);
  const [insumosGlobais, setInsumosGlobais] = useState([]);
  
  const [selectedInsumoId, setSelectedInsumoId] = useState('');
  const [quantidadeTotal, setQuantidadeTotal] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [loadingParty, setLoadingParty] = useState(true);
  const router = useRouter();
  const db = getDatabase(app);
  const isOffline = useNetworkStore(s => s.isOffline);

  // Carrega dados do cache ao focar na tela
  useFocusEffect(
    useCallback(() => {
      const loadCache = async () => {
        const cachedInsumos = await getCachedData(CACHE_KEYS.INSUMOS, []);
        const cachedEstoque = await getCachedData(CACHE_KEYS.ESTOQUE, {});
        if (cachedInsumos.length > 0) setInsumosGlobais(cachedInsumos);
        if (Object.keys(cachedEstoque).length > 0) {
          setEstoque(Object.keys(cachedEstoque).map(key => ({ id: key, ...cachedEstoque[key] })));
        }
      };
      loadCache();
    }, [])
  );

  // Auto-busca a festa ativa do Firebase se a store não tiver festa
  useEffect(() => {
    if (!isPartyLoaded) return; // espera o cache carregar primeiro

    if (festaSelecionada?.uid || festaSelecionada?.id) {
      setLoadingParty(false);
      return; // já tem festa, OK
    }

    // Sem festa no contexto — busca a festa ativa no Firebase
    const fetchActiveParty = async () => {
      try {
        const partiesRef = ref(db, 'festas');
        const snapshot = await get(partiesRef);
        if (snapshot.exists()) {
          const parties = snapshot.val();
          const activeKey = Object.keys(parties).find(k => parties[k].status === 'ativa');
          if (activeKey) {
            const activeParty = { id: activeKey, ...parties[activeKey] };
            selectParty(activeParty);
            setLoadingParty(false);
            return;
          }
        }
        // Nenhuma festa ativa encontrada
        Alert.alert('Aviso', 'Nenhum evento ativo encontrado! Vá em "Gerenciar Eventos" e crie ou ative um evento.');
        router.back();
      } catch (err) {
        console.error('Erro ao buscar evento ativo:', err);
        Alert.alert('Erro', 'Não foi possível buscar o evento ativo.');
        router.back();
      }
    };

    fetchActiveParty();
  }, [isPartyLoaded, festaSelecionada]);

  // Carrega insumos globais para o dropdown
  useEffect(() => {
    const insumosRef = ref(db, 'insumos');
    const unsubscribe = onValue(insumosRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const lista = Object.keys(data).map((key) => ({ id: key, ...data[key] }));
        setInsumosGlobais(lista);
        cacheData(CACHE_KEYS.INSUMOS, lista);
      }
    });
    return () => unsubscribe();
  }, []);

  // Carrega o estoque atual da festa
  useEffect(() => {
    const partyId = festaSelecionada?.uid || festaSelecionada?.id;
    if (!partyId) return;
    const estoqueRef = ref(db, `festas/${partyId}/estoque`);
    const unsubscribe = onValue(estoqueRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setEstoque(Object.keys(data).map((key) => ({ id: key, ...data[key] })));
        cacheData(CACHE_KEYS.ESTOQUE, data);
      } else {
        setEstoque([]);
      }
    });
    return () => unsubscribe();
  }, [festaSelecionada]);

  const handleSave = async () => {
    if (isOffline) {
      Alert.alert('Modo Offline', 'Não é possível adicionar estoque sem conexão com a internet. O estoque precisa ser sincronizado em tempo real.');
      return;
    }

    if (!selectedInsumoId || !quantidadeTotal) {
      Alert.alert('Erro', 'Por favor, selecione um insumo e informe a quantidade.');
      return;
    }

    const qtdNum = parseFloat(quantidadeTotal.replace(',', '.'));
    if (isNaN(qtdNum) || qtdNum <= 0) {
      Alert.alert('Erro', 'A quantidade precisa ser maior que zero.');
      return;
    }

    const insumoBase = insumosGlobais.find(i => i.id === selectedInsumoId);
    if (!insumoBase) return;

    setSaving(true);
    try {
      // Se a pessoa digitar 5 (garrafas do Insumo que tem 1000ml), o EstoqueTotal é 5000ml.
      // E a ficha técnica gasta em ml!
      // Vamos perguntar se o usuário está lançando na UNIDADE BASE. 
      // Para facilitar, a quantidade de estoque aqui deve ser digitada NA UNIDADE BASE (ml, g, un) 
      // ou devemos calcular (Qtd Garrafas x Capacidade da Garrafa)? 
      // No input pedimos pra ele digitar o TOTAL. ex: 5000 ml.
      
      const partyId = festaSelecionada?.uid || festaSelecionada?.id;
      const estoqueRef = ref(db, `festas/${partyId}/estoque/${selectedInsumoId}`);
      
      // Verifica se já existe para somar
      const snapshot = await get(estoqueRef);
      let saldoNovo = qtdNum;
      
      if (snapshot.exists()) {
        saldoNovo = parseFloat(snapshot.val().quantidadeAtual) + qtdNum;
      }

      await set(estoqueRef, {
        insumoId: selectedInsumoId,
        nome: insumoBase.nome,
        quantidadeAtual: saldoNovo,
        quantidadeInicial: snapshot.exists() ? (parseFloat(snapshot.val().quantidadeInicial) + qtdNum) : qtdNum,
        unidade: insumoBase.unidade,
        timestamp: new Date().toISOString()
      });

      Alert.alert('Sucesso', 'Estoque adicionado!');
      setSelectedInsumoId('');
      setQuantidadeTotal('');
    } catch (error) {
      Alert.alert('Erro', 'Erro ao salvar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = (id, nome) => {
    if (isOffline) {
      Alert.alert('Modo Offline', 'Não é possível remover estoque sem conexão com a internet. O estoque precisa ser sincronizado em tempo real.');
      return;
    }

    Alert.alert(
      'Remover do Estoque',
      `Remover ${nome} do estoque deste evento? (Não pode ser desfeito)`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Remover', 
          style: 'destructive',
          onPress: async () => {
             const partyId = festaSelecionada?.uid || festaSelecionada?.id;
             const refApagar = ref(db, `festas/${partyId}/estoque/${id}`);
             await remove(refApagar);
          }
        }
      ]
    );
  };

  const getAlertColor = (atual, inicial) => {
    const percent = (atual / inicial) * 100;
    if (percent <= 20) return '#c83c3c'; // Vermelho (Alerta Crítico)
    if (percent <= 50) return '#cc9e6f'; // Laranja (Alerta Médio)
    return '#78a764'; // Verde (OK)
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
  };

  if (loadingParty) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0EA', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#cc9e6f" />
        <Text style={{ color: '#1c1f0f', marginTop: 12, fontSize: 16, fontWeight: '600' }}>Carregando evento...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0EA' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <FlatList
          data={estoque}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {/* Header */}
              <Animated.View entering={FadeInUp.duration(500)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 28 }}>
                  <TouchableOpacity
                    onPress={() => router.back()}
                    style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#c8cac6' }}
                  >
                    <Ionicons name="arrow-back" size={22} color="#1c1f0f" />
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="cube-outline" size={24} color="#cc9e6f" />
                    <Text style={{ color: '#1c1f0f', fontSize: 22, fontWeight: '700' }}>Estoque do Evento</Text>
                  </View>
                  <View style={{ width: 42 }} />
                </View>
                
                {festaSelecionada?.nome && (
                  <View style={{ backgroundColor: '#1c1f0f', borderRadius: 12, padding: 12, marginBottom: 20, alignItems: 'center' }}>
                    <Text style={{ color: '#cc9e6f', fontWeight: '700', fontSize: 16 }}>Evento: {festaSelecionada.nome}</Text>
                  </View>
                )}
              </Animated.View>

              {/* Form de Cadastro */}
              <Animated.View entering={FadeInUp.duration(500).delay(100)}>
                <View style={{ backgroundColor: 'rgba(204, 158, 111, 0.08)', borderRadius: 24, padding: 20, marginBottom: 32, borderWidth: 1, borderColor: 'rgba(204, 158, 111, 0.2)' }}>
                  
                  <View style={{ marginBottom: 14 }}>
                    <Text style={labelStyle}>Selecione o Insumo Base</Text>
                    <TouchableOpacity
                      onPress={() => setShowPickerModal(true)}
                      style={{ ...inputStyle, paddingHorizontal: 16, paddingVertical: 14 }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="flask-outline" size={18} color="#cc9e6f" style={{ marginRight: 10 }} />
                      <Text style={{ flex: 1, color: selectedInsumoId ? '#1c1f0f' : '#a0a29f', fontSize: 15 }}>
                        {selectedInsumoId
                          ? insumosGlobais.find(i => i.id === selectedInsumoId)?.nome + ' (' + (insumosGlobais.find(i => i.id === selectedInsumoId)?.unidade || '') + ')'
                          : 'Toque para selecionar...'}
                      </Text>
                      <Ionicons name="chevron-down" size={18} color="#c8cac6" />
                    </TouchableOpacity>
                  </View>

                  {/* Modal de seleção de insumo */}
                  <Modal
                    visible={showPickerModal}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setShowPickerModal(false)}
                  >
                    <TouchableOpacity
                      style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
                      activeOpacity={1}
                      onPress={() => setShowPickerModal(false)}
                    >
                      <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '60%', paddingBottom: 30 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e8e4de' }}>
                          <Text style={{ fontSize: 18, fontWeight: '700', color: '#1c1f0f' }}>Selecionar Insumo</Text>
                          <TouchableOpacity onPress={() => setShowPickerModal(false)}>
                            <Ionicons name="close-circle" size={28} color="#c8cac6" />
                          </TouchableOpacity>
                        </View>
                        <ScrollView style={{ paddingHorizontal: 12 }}>
                          {insumosGlobais.map(ins => (
                            <TouchableOpacity
                              key={ins.id}
                              onPress={() => {
                                setSelectedInsumoId(ins.id);
                                setShowPickerModal(false);
                              }}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 14,
                                paddingHorizontal: 16,
                                marginVertical: 2,
                                borderRadius: 12,
                                backgroundColor: selectedInsumoId === ins.id ? 'rgba(204, 158, 111, 0.12)' : 'transparent',
                              }}
                            >
                              <Ionicons
                                name={selectedInsumoId === ins.id ? 'checkmark-circle' : 'ellipse-outline'}
                                size={22}
                                color={selectedInsumoId === ins.id ? '#cc9e6f' : '#c8cac6'}
                                style={{ marginRight: 12 }}
                              />
                              <Text style={{ fontSize: 16, color: '#1c1f0f', fontWeight: selectedInsumoId === ins.id ? '700' : '400', flex: 1 }}>
                                {ins.nome}
                              </Text>
                              <Text style={{ fontSize: 13, color: '#707b55', fontWeight: '600' }}>{ins.unidade}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    </TouchableOpacity>
                  </Modal>

                  <View style={{ marginBottom: 20 }}>
                    <Text style={labelStyle}>Volume/Qtd TOTAL Trazida p/ Evento</Text>
                    <Text style={{ fontSize: 11, color: '#a0a29f', marginLeft: 4, marginBottom: 6 }}>
                      Ex: Trouxe 5 garrafas de 1000ml de Vodka. Digite: 5000.
                    </Text>
                    <View style={inputStyle}>
                      <Ionicons name="water-outline" size={18} color="#cc9e6f" style={{ marginRight: 8 }} />
                      <TextInput
                        value={quantidadeTotal}
                        onChangeText={setQuantidadeTotal}
                        placeholder="Ex: 5000"
                        keyboardType="numeric"
                        placeholderTextColor="#a0a29f"
                        style={{ flex: 1, color: '#1c1f0f', fontSize: 15 }}
                      />
                      <Text style={{ color: '#1c1f0f', fontWeight: 'bold' }}>
                        {selectedInsumoId ? (insumosGlobais.find(i => i.id === selectedInsumoId)?.unidade || '') : ''}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={handleSave}
                    disabled={saving}
                    style={{
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: '#1c1f0f', paddingVertical: 14, borderRadius: 14, gap: 8,
                      opacity: saving ? 0.7 : 1,
                    }}
                  >
                    {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="add" size={20} color="#cc9e6f" />}
                    <Text style={{ color: '#cc9e6f', fontWeight: '700', fontSize: 15 }}>Adicionar / Somar Saldo</Text>
                  </TouchableOpacity>

                </View>

                {estoque.length > 0 && (
                  <Text style={{ color: '#1c1f0f', fontSize: 18, fontWeight: '700', marginBottom: 16 }}>
                    Saldo em Tempo Real
                  </Text>
                )}
              </Animated.View>
            </View>
          }
          renderItem={({ item, index }) => {
            const perc = (item.quantidadeAtual / item.quantidadeInicial) * 100;
            const barColor = getAlertColor(item.quantidadeAtual, item.quantidadeInicial);
            
            return (
              <Animated.View entering={FadeInUp.duration(400).delay(index * 50)}>
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1.5, borderColor: '#e8e4de', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 2 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <Text style={{ color: '#1c1f0f', fontSize: 16, fontWeight: '700', flex: 1 }}>{item.nome}</Text>
                    <TouchableOpacity onPress={() => deleteItem(item.id, item.nome)} style={{ padding: 6 }}>
                      <Ionicons name="trash-outline" size={18} color="#c83c3c" />
                    </TouchableOpacity>
                  </View>
                  
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ color: '#707b55', fontSize: 13, fontWeight: '600' }}>Disponível:</Text>
                    <Text style={{ color: barColor, fontSize: 14, fontWeight: '800' }}>
                      {parseFloat(item.quantidadeAtual).toFixed(1)} / {item.quantidadeInicial} {item.unidade}
                    </Text>
                  </View>

                  {/* Progress Bar */}
                  <View style={{ height: 8, backgroundColor: '#e8e4de', borderRadius: 4, overflow: 'hidden' }}>
                    <View style={{ height: '100%', width: `${Math.max(0, Math.min(100, perc))}%`, backgroundColor: barColor, borderRadius: 4 }} />
                  </View>
                  
                  {perc <= 20 && (
                    <Text style={{ color: '#c83c3c', fontSize: 11, fontWeight: 'bold', marginTop: 6 }}>
                      ⚠️ Nível Baixo! Quase esgotado.
                    </Text>
                  )}
                </View>
              </Animated.View>
            );
          }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 20 }}>
              <Ionicons name="cube-outline" size={48} color="#e8e4de" />
              <Text style={{ color: '#c8cac6', fontSize: 14, textAlign: 'center', marginTop: 12 }}>
                Nenhum estoque lançado para este evento ainda.
              </Text>
            </View>
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
