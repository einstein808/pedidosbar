import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Alert, ScrollView, ActivityIndicator, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getDatabase, ref, onValue, set, remove, update, push } from 'firebase/database';
import { app } from '../src/config/firebaseConfig';
import { useRouter } from 'expo-router';
import { useAppStore } from '../src/store/useAppStore';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import PartyForm from '../src/components/organisms/PartyForm';

export default function PartyManagementScreen() {
  const selectParty = useAppStore(s => s.setFestaSelecionada);
  const party = useAppStore(s => s.festaSelecionada);
  const context = { selectParty, party };
  const PARTY_TYPES = ['Casamento', '15 Anos', 'Formatura', 'Corporativo', 'Aniversário', 'Venda de Rua', 'Outros'];

  const [parties, setParties] = useState([]);
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyDate, setNewPartyDate] = useState('');
  const [newPartyType, setNewPartyType] = useState('Casamento');
  const [editingParty, setEditingParty] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editPartyType, setEditPartyType] = useState('Casamento');
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);

  const onChangeDate = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      if (Platform.OS !== 'ios') setShowDatePicker(false);
      const formatted = selectedDate.toISOString().split('T')[0];
      setNewPartyDate(formatted);
    } else {
      setShowDatePicker(false);
    }
  };

  const onChangeEditDate = (event, selectedDate) => {
    setShowEditDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      if (Platform.OS !== 'ios') setShowEditDatePicker(false);
      const formatted = selectedDate.toISOString().split('T')[0];
      setEditDate(formatted);
    } else {
      setShowEditDatePicker(false);
    }
  };
  const router = useRouter();

  useEffect(() => {
    const db = getDatabase(app);
    const festasRef = ref(db, 'festas');
    const unsubscribe = onValue(festasRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) { setParties([]); return; }
      const partiesList = Object.keys(data).map(key => {
        const raw = data[key] || {};
        return {
          id: key,
          uid: raw.uid || key,
          nome: raw.nome || 'Sem nome',
          data: raw.data || '',
          tipoFesta: raw.tipoFesta || '',
          status: raw.status || 'pendente',
          quantidadeConvidados: raw.quantidadeConvidados || 0,
          pacote: raw.pacote || {},
          custoMaoDeObra: raw.custoMaoDeObra || 0,
          timestamp: raw.timestamp || '',
        };
      });
      setParties(partiesList);
    }, (error) => {
      Alert.alert('Erro', 'Falha ao carregar eventos: ' + error.message);
    });
    return () => unsubscribe();
  }, []);

  const isValidDate = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date);

  const createParty = async (partyData) => {
    if (!partyData.nome || !partyData.data) {
      Alert.alert('Erro', 'Por favor, preencha o Nome e a Data.');
      return;
    }
    if (!isValidDate(partyData.data)) {
      Alert.alert('Erro', 'Formato de data inválido. Use AAAA-MM-DD (ex: 2025-05-14).');
      return;
    }

    setLoading(true);
    try {
      const db = getDatabase(app);
      const festasRef = ref(db, 'festas');
      const novaFestaRef = push(festasRef);

      const novaFesta = {
        uid: novaFestaRef.key,
        ...partyData,
        status: 'pendente',
        timestamp: new Date().toISOString(),
      };

      await set(novaFestaRef, novaFesta);
      selectParty(novaFesta);
      
      // The local states for "new party" are obsolete now, since PartyForm has its own state.
      // But we can reset variables if needed or unmount.
      setNewPartyName('');
      setNewPartyDate('');
      Alert.alert('Sucesso', 'Evento criado com sucesso!');
    } catch (error) {
      Alert.alert('Erro', 'Erro ao criar evento: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (party) => {
    setEditingParty(party);
    setEditName(party.nome);
    setEditDate(party.data);
    setEditPartyType(party.tipoFesta || 'Outros');
  };

  const saveEdit = async (partyData) => {
    if (!partyData.nome || !partyData.data) {
      Alert.alert('Erro', 'Por favor, preencha nome e data.');
      return;
    }
    if (!isValidDate(partyData.data)) {
      Alert.alert('Erro', 'Formato de data inválido. Use AAAA-MM-DD.');
      return;
    }

    try {
      setLoading(true);
      const db = getDatabase(app);
      const partyRef = ref(db, `festas/${editingParty.id}`);
      await update(partyRef, partyData);
      if (context.party?.uid === editingParty.id) {
        selectParty({ ...editingParty, ...partyData });
      }
      Alert.alert('Sucesso', 'Evento atualizado!');
      setEditingParty(null);
    } catch (error) {
      Alert.alert('Erro', 'Erro ao atualizar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteParty = (partyId) => {
    Alert.alert(
      'Confirmar Exclusão',
      'Tem certeza que deseja excluir este evento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = getDatabase(app);
              const partyRef = ref(db, `festas/${partyId}`);
              await remove(partyRef);
              if (context.party?.uid === partyId) selectParty(null);
              Alert.alert('Sucesso', 'Evento excluído!');
            } catch (error) {
              Alert.alert('Erro', 'Erro ao excluir: ' + error.message);
            }
          },
        },
      ],
    );
  };

  const activateParty = async (party) => {
    try {
      const db = getDatabase(app);
      const updates = {};
      
      parties.forEach(p => {
        if (p.id === party.id) {
          updates[`festas/${p.id}/status`] = 'ativa';
        } else if (p.status === 'ativa') {
          updates[`festas/${p.id}/status`] = 'concluida';
        }
      });
      
      await update(ref(db), updates);
      selectParty({ ...party, status: 'ativa' });
      Alert.alert('Sucesso', `Evento "${party.nome}" ativado globalmente! Todos os novos pedidos serão direcionados para ele.`);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível ativar o evento: ' + error.message);
    }
  };

  const inputStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#c8cac6',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  };

  const labelStyle = {
    color: '#707b55',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case 'ativa':
        return { color: '#78a764', bg: 'rgba(120, 167, 100, 0.12)', label: 'Ativa' };
      case 'concluida':
        return { color: '#707b55', bg: 'rgba(112, 123, 85, 0.12)', label: 'Concluída' };
      default:
        return { color: '#cc9e6f', bg: 'rgba(204, 158, 111, 0.12)', label: status || 'Pendente' };
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0EA' }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <Animated.View entering={FadeInUp.duration(500)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 16, marginBottom: 28 }}>
            <View style={{ backgroundColor: 'rgba(120, 167, 100, 0.12)', borderRadius: 14, padding: 10 }}>
              <Ionicons name="sparkles" size={24} color="#78a764" />
            </View>
            <Text style={{ color: '#1c1f0f', fontSize: 24, fontWeight: '700' }}>
              Gerenciar Eventos
            </Text>
          </View>
        </Animated.View>

        {/* ===== CRIAR NOVA FESTA ===== */}
        <Animated.View entering={FadeInUp.duration(500).delay(100)}>
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 18,
              padding: 20,
              marginBottom: 20,
              borderWidth: 1.5,
              borderColor: '#c8cac6',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.04,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Ionicons name="add-circle-outline" size={20} color="#78a764" />
              <Text style={{ color: '#1c1f0f', fontSize: 18, fontWeight: '700' }}>Novo Evento</Text>
            </View>

            <PartyForm 
              onSubmit={createParty} 
              loading={loading} 
              submitLabel="Criar Evento" 
            />
          </View>
        </Animated.View>

        {/* ===== EDITAR FESTA ===== */}
        {editingParty && (
          <Animated.View entering={FadeInUp.duration(400)}>
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 18,
                padding: 20,
                marginBottom: 20,
                borderWidth: 1.5,
                borderColor: '#cc9e6f',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Ionicons name="create-outline" size={20} color="#cc9e6f" />
                <Text style={{ color: '#1c1f0f', fontSize: 18, fontWeight: '700' }}>Editar Evento</Text>
              </View>

              <PartyForm 
                initialData={editingParty}
                onSubmit={saveEdit}
                onCancel={() => setEditingParty(null)}
                loading={loading}
                submitLabel="Salvar Edição"
              />
            </View>
          </Animated.View>
        )}

        {/* ===== LISTA DE FESTAS ===== */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Ionicons name="list-outline" size={20} color="#1c1f0f" />
          <Text style={{ color: '#1c1f0f', fontSize: 18, fontWeight: '700' }}>Eventos Existentes</Text>
          <View style={{ backgroundColor: 'rgba(112, 123, 85, 0.12)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 }}>
            <Text style={{ color: '#707b55', fontSize: 13, fontWeight: '700' }}>{parties.length}</Text>
          </View>
        </View>

        {parties.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <View style={{ backgroundColor: 'rgba(204, 158, 111, 0.1)', borderRadius: 50, padding: 24, marginBottom: 12 }}>
              <Ionicons name="sparkles-outline" size={40} color="#cc9e6f" />
            </View>
            <Text style={{ color: '#1c1f0f', fontSize: 15, fontWeight: '500' }}>Nenhum evento encontrado</Text>
            <Text style={{ color: '#707b55', fontSize: 13, marginTop: 4 }}>Crie um evento acima para começar</Text>
          </View>
        ) : (
          parties.map((item, index) => {
            const statusConfig = getStatusConfig(item.status);
            return (
              <Animated.View key={item.id} entering={FadeInUp.duration(400).delay(200 + index * 60)}>
                <View
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 18,
                    padding: 18,
                    marginBottom: 12,
                    borderWidth: 1.5,
                    borderColor: '#c8cac6',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.04,
                    shadowRadius: 8,
                    elevation: 2,
                  }}
                >
                  {/* Header */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <Text style={{ fontSize: 17, fontWeight: '700', color: '#1c1f0f', flex: 1 }}>{item.nome}</Text>
                    <View style={{ backgroundColor: statusConfig.bg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ color: statusConfig.color, fontSize: 12, fontWeight: '600' }}>{statusConfig.label}</Text>
                    </View>
                  </View>

                  {/* Info */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="calendar-outline" size={16} color="#cc9e6f" />
                      <Text style={{ color: '#707b55', fontSize: 14 }}>{item.data || 'Sem data'}</Text>
                    </View>
                    {item.tipoFesta && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="bookmark-outline" size={16} color="#78a764" />
                        <Text style={{ color: '#707b55', fontSize: 14 }}>{item.tipoFesta}</Text>
                      </View>
                    )}
                  </View>

                  {/* Ações */}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => item.status === 'ativa' ? null : activateParty(item)}
                      activeOpacity={item.status === 'ativa' ? 1 : 0.85}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: item.status === 'ativa' ? '#e8e4de' : '#1c1f0f', paddingVertical: 12, borderRadius: 12, gap: 6 }}
                    >
                      <Ionicons name={item.status === 'ativa' ? "checkmark-circle" : "sparkles-outline"} size={16} color={item.status === 'ativa' ? "#707b55" : "#cc9e6f"} />
                      <Text style={{ color: item.status === 'ativa' ? "#707b55" : "#cc9e6f", fontWeight: '600', fontSize: 13 }}>
                        {item.status === 'ativa' ? 'Ativa' : 'Tornar Ativa'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => startEditing(item)}
                      activeOpacity={0.85}
                      style={{ backgroundColor: 'rgba(204, 158, 111, 0.12)', borderWidth: 1.5, borderColor: '#cc9e6f', borderRadius: 12, padding: 12, alignItems: 'center' }}
                    >
                      <Ionicons name="create-outline" size={16} color="#cc9e6f" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => deleteParty(item.id)}
                      activeOpacity={0.85}
                      style={{ backgroundColor: 'rgba(200, 60, 60, 0.08)', borderWidth: 1.5, borderColor: 'rgba(200, 60, 60, 0.4)', borderRadius: 12, padding: 12, alignItems: 'center' }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#c83c3c" />
                    </TouchableOpacity>
                  </View>
                </View>
              </Animated.View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}