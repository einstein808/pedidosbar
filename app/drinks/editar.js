import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  FlatList,
  Alert,
  Switch,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { getDatabase, ref, onValue, update, set, remove } from 'firebase/database';
import { app } from '../src/config/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { withTimeout } from '../src/utils/firebaseHelpers';
import { getCachedData, CACHE_KEYS } from '../src/services/offlineCache';
import '../../global.css';

export default function ManageDrinksScreen() {
  const [drinks, setDrinks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedDrink, setSelectedDrink] = useState(null);
  const [name, setName] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [type, setType] = useState('');
  const [image, setImage] = useState('');
  const [fichasTecnicas, setFichasTecnicas] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [saving, setSaving] = useState(false);
  const db = getDatabase(app);
  const router = useRouter();

  useEffect(() => {
    const loadCache = async () => {
      const cachedDrinks = await getCachedData(CACHE_KEYS.DRINKS_CATALOG, []);
      if (cachedDrinks.length > 0) setDrinks(cachedDrinks);
    };
    loadCache();

    const drinksRef = ref(db, 'drinks');
    const unsubscribeDrinks = onValue(drinksRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const drinksList = Object.keys(data).map((key) => ({ id: key, ...data[key] }));
        setDrinks(drinksList);
      }
    }, (error) => {
      console.log('Online fetch silent error:', error.message);
    });

    const insumosRef = ref(db, 'insumos');
    const unsubscribeInsumos = onValue(insumosRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setInsumos(Object.keys(data).map(k => ({ id: k, ...data[k] })));
      } else {
        setInsumos([]);
      }
    });

    return () => {
      unsubscribeDrinks();
      unsubscribeInsumos();
    };
  }, []);

  const calculateTotalCost = (fichaArr) => {
    if (!fichaArr) return 0;
    return fichaArr.reduce((total, ficha) => {
      const insumoInfo = insumos.find(i => i.id === ficha.insumoId);
      if (!insumoInfo || !ficha.quantity) return total;
      const qtd = parseFloat(ficha.quantity);
      if (isNaN(qtd)) return total;
      return total + (insumoInfo.custoUnidadeMinima * qtd);
    }, 0);
  };

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const filteredDrinks = drinks.filter((drink) => {
    const matchesSearch = drink.name?.toLowerCase().includes(searchQuery.toLowerCase());
    if (filterStatus === 'active') return matchesSearch && !drink.inactive;
    if (filterStatus === 'inactive') return matchesSearch && drink.inactive;
    return matchesSearch;
  });

  const activeCount = drinks.filter((d) => !d.inactive).length;
  const inactiveCount = drinks.filter((d) => d.inactive).length;

  const toggleDrinkStatus = async (drink) => {
    try {
      const drinkRef = ref(db, 'drinks/' + drink.name);
      await update(drinkRef, { inactive: !drink.inactive });
    } catch (error) {
      Alert.alert('Erro', 'Erro ao alterar status: ' + error.message);
    }
  };

  const handleEdit = (drink) => {
    setSelectedDrink(drink);
    setName(drink.name || '');
    setIngredients(drink.ingredients || '');
    setType(drink.type || '');
    setImage(drink.image || '');
    setFichasTecnicas(drink.fichaTecnica || []);
    setEditModalVisible(true);
  };

  const closeModal = () => {
    setEditModalVisible(false);
    setSelectedDrink(null);
    setName('');
    setIngredients('');
    setType('');
    setImage('');
    setFichasTecnicas([]);
    setSaving(false);
  };

  const saveDrink = async () => {
    if (!name || !ingredients || !type || !image) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos!');
      return;
    }

    setSaving(true);
    try {
      if (selectedDrink && selectedDrink.name !== name) {
        const oldRef = ref(db, 'drinks/' + selectedDrink.name);
        await withTimeout(remove(oldRef), 4000);
      }
      const drinksRef = ref(db, 'drinks/' + name);
      await withTimeout(set(drinksRef, {
        name,
        ingredients,
        type,
        image,
        inactive: selectedDrink?.inactive || false,
        fichaTecnica: fichasTecnicas,
      }), 4000);
      Alert.alert('Sucesso', 'Drink atualizado com sucesso!');
      closeModal();
    } catch (error) {
      if (error.message === 'TIMEOUT_FIREBASE') {
        Alert.alert('Falha na Conexão', 'O Laboratório de Drinks exige internet para cadastrar/editar receitas base.');
      } else {
        Alert.alert('Erro', 'Erro ao salvar o drink: ' + error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const activateAll = () => {
    Alert.alert(
      'Ativar Todos',
      'Deseja ativar todos os drinks?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Ativar Todos',
          onPress: async () => {
            try {
              const updates = {};
              drinks.forEach((drink) => {
                updates[`drinks/${drink.name}/inactive`] = false;
              });
              await withTimeout(update(ref(db), updates), 4000);
              Alert.alert('Sucesso', 'Todos os drinks foram ativados!');
            } catch (error) {
              if (error.message === 'TIMEOUT_FIREBASE') {
                Alert.alert('Conexão Fraca', 'Ação bloqueada. É necessário internet para ações em lote no catálogo.');
              } else {
                Alert.alert('Erro', 'Erro ao ativar drinks: ' + error.message);
              }
            }
          },
        },
      ]
    );
  };

  const deactivateAll = () => {
    Alert.alert(
      'Desativar Todos',
      'Deseja desativar todos os drinks?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desativar Todos',
          style: 'destructive',
          onPress: async () => {
            try {
              const updates = {};
              drinks.forEach((drink) => {
                updates[`drinks/${drink.name}/inactive`] = true;
              });
              await withTimeout(update(ref(db), updates), 4000);
              Alert.alert('Sucesso', 'Todos os drinks foram desativados!');
            } catch (error) {
              if (error.message === 'TIMEOUT_FIREBASE') {
                Alert.alert('Conexão Fraca', 'Ação bloqueada. É necessário internet para ações em lote no catálogo.');
              } else {
                Alert.alert('Erro', 'Erro ao desativar drinks: ' + error.message);
              }
            }
          },
        },
      ]
    );
  };

  const statusFilters = [
    { key: 'all', label: 'Todos', count: drinks.length },
    { key: 'active', label: 'Ativos', count: activeCount },
    { key: 'inactive', label: 'Inativos', count: inactiveCount },
  ];

  const inputStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#c8cac6',
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

  const renderDrink = ({ item, index }) => {
    const isActive = !item.inactive;

    return (
      <Animated.View entering={FadeInUp.duration(400).delay(index * 60)}>
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 18,
            padding: 16,
            marginBottom: 12,
            borderWidth: 1.5,
            borderColor: isActive ? '#78a764' : '#c8cac6',
            flexDirection: 'row',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            elevation: 2,
            opacity: isActive ? 1 : 0.6,
          }}
        >
          {/* Imagem */}
          {item.image ? (
            <Image
              source={{ uri: item.image }}
              style={{
                width: 64,
                height: 64,
                borderRadius: 14,
                marginRight: 14,
                borderWidth: 1,
                borderColor: isActive ? '#78a764' : '#c8cac6',
              }}
              resizeMode="cover"
              onError={() => {}}
            />
          ) : (
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 14,
                marginRight: 14,
                backgroundColor: 'rgba(204, 158, 111, 0.1)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons name="wine-outline" size={28} color="#cc9e6f" />
            </View>
          )}

          {/* Info */}
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#1c1f0f', fontSize: 17, fontWeight: '700', marginBottom: 4 }}>
              {item.name}
            </Text>
            <View
              style={{
                alignSelf: 'flex-start',
                backgroundColor: item.type === 'alcoholic'
                  ? 'rgba(204, 158, 111, 0.15)'
                  : 'rgba(120, 167, 100, 0.15)',
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: 20,
                marginBottom: 6,
              }}
            >
              <Text
                style={{
                  color: item.type === 'alcoholic' ? '#cc9e6f' : '#78a764',
                  fontSize: 11,
                  fontWeight: '600',
                }}
              >
                {item.type === 'alcoholic' ? '🍸 Alcoólico' : '🍹 Não Alcoólico'}
              </Text>
            </View>
            {/* Status badge */}
            <View
              style={{
                alignSelf: 'flex-start',
                backgroundColor: isActive ? 'rgba(120, 167, 100, 0.12)' : 'rgba(200, 60, 60, 0.08)',
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: 20,
              }}
            >
              <Text
                style={{
                  color: isActive ? '#78a764' : '#c83c3c',
                  fontSize: 11,
                  fontWeight: '700',
                }}
              >
                {isActive ? '● Ativo' : '○ Inativo'}
              </Text>
            </View>

            {/* Custo Produção */}
            {item.fichaTecnica && item.fichaTecnica.length > 0 && (
              <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(204, 158, 111, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 8 }}>
                <Text style={{ color: '#ae7d4a', fontSize: 12, fontWeight: '800' }}>
                   Custo R$ {calculateTotalCost(item.fichaTecnica).toFixed(2).replace('.', ',')}
                </Text>
              </View>
            )}
          </View>

          {/* Ações: Editar + Toggle */}
          <View style={{ alignItems: 'center', marginLeft: 8, gap: 8 }}>
            <TouchableOpacity
              onPress={() => handleEdit(item)}
              activeOpacity={0.7}
              style={{
                backgroundColor: 'rgba(204, 158, 111, 0.12)',
                borderWidth: 1.5,
                borderColor: '#cc9e6f',
                borderRadius: 12,
                padding: 8,
                alignItems: 'center',
              }}
            >
              <Ionicons name="create-outline" size={18} color="#cc9e6f" />
            </TouchableOpacity>
            <Switch
              value={isActive}
              onValueChange={() => toggleDrinkStatus(item)}
              trackColor={{ false: '#c8cac6', true: 'rgba(120, 167, 100, 0.4)' }}
              thumbColor={isActive ? '#78a764' : '#e8e4de'}
              ios_backgroundColor="#c8cac6"
              style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
            />
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0EA' }}>
      <View style={{ flex: 1, paddingHorizontal: 20 }}>
        {/* Header */}
        <Animated.View entering={FadeInUp.duration(500)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 20 }}>
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
              <Ionicons name="wine-outline" size={24} color="#cc9e6f" />
              <Text style={{ color: '#1c1f0f', fontSize: 22, fontWeight: '700' }}>
                Gerenciar Drinks
              </Text>
            </View>

            <View style={{ width: 42 }} />
          </View>
        </Animated.View>

        {/* Busca */}
        <Animated.View entering={FadeInUp.duration(500).delay(100)}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              paddingHorizontal: 16,
              paddingVertical: 12,
              marginBottom: 14,
              borderWidth: 1.5,
              borderColor: '#c8cac6',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.04,
              shadowRadius: 6,
              elevation: 2,
            }}
          >
            <Ionicons name="search-outline" size={20} color="#c8cac6" style={{ marginRight: 10 }} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Buscar drinks..."
              placeholderTextColor="#c8cac6"
              style={{ flex: 1, color: '#1c1f0f', fontSize: 15 }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#c8cac6" />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* Filtros de status */}
        <Animated.View entering={FadeInUp.duration(500).delay(150)}>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            {statusFilters.map((f) => (
              <TouchableOpacity
                key={f.key}
                onPress={() => setFilterStatus(f.key)}
                activeOpacity={0.85}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: filterStatus === f.key ? '#1c1f0f' : '#FFFFFF',
                  borderWidth: filterStatus === f.key ? 0 : 1.5,
                  borderColor: '#c8cac6',
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Text
                  style={{
                    color: filterStatus === f.key ? '#cc9e6f' : '#707b55',
                    fontSize: 12,
                    fontWeight: '600',
                  }}
                >
                  {f.label}
                </Text>
                <View
                  style={{
                    backgroundColor: filterStatus === f.key ? 'rgba(204, 158, 111, 0.3)' : 'rgba(112, 123, 85, 0.12)',
                    borderRadius: 8,
                    paddingHorizontal: 6,
                    paddingVertical: 1,
                    minWidth: 22,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: filterStatus === f.key ? '#cc9e6f' : '#707b55',
                      fontSize: 11,
                      fontWeight: '700',
                    }}
                  >
                    {f.count}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Ações em massa */}
        <Animated.View entering={FadeInUp.duration(500).delay(200)}>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            <TouchableOpacity
              onPress={activateAll}
              activeOpacity={0.85}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(120, 167, 100, 0.12)',
                paddingVertical: 10,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: '#78a764',
                gap: 6,
              }}
            >
              <Ionicons name="checkmark-done-outline" size={16} color="#78a764" />
              <Text style={{ color: '#78a764', fontWeight: '600', fontSize: 12 }}>Ativar Todos</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={deactivateAll}
              activeOpacity={0.85}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(200, 60, 60, 0.06)',
                paddingVertical: 10,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: 'rgba(200, 60, 60, 0.3)',
                gap: 6,
              }}
            >
              <Ionicons name="close-circle-outline" size={16} color="#c83c3c" />
              <Text style={{ color: '#c83c3c', fontWeight: '600', fontSize: 12 }}>Desativar Todos</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Lista */}
        <FlatList
          data={filteredDrinks}
          keyExtractor={(item) => item.id || item.name}
          renderItem={renderDrink}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Animated.View entering={FadeInUp.duration(500)} style={{ alignItems: 'center', paddingTop: 60 }}>
              <View
                style={{
                  backgroundColor: 'rgba(204, 158, 111, 0.1)',
                  borderRadius: 50,
                  padding: 24,
                  marginBottom: 16,
                }}
              >
                <Ionicons name="wine-outline" size={48} color="#cc9e6f" />
              </View>
              <Text style={{ color: '#1c1f0f', fontSize: 16, fontWeight: '500', marginBottom: 4 }}>
                {searchQuery ? 'Nenhum drink encontrado' : 'Nenhum drink cadastrado'}
              </Text>
              <Text style={{ color: '#707b55', fontSize: 13, textAlign: 'center' }}>
                {searchQuery
                  ? `Não encontramos resultados para "${searchQuery}"`
                  : 'Cadastre seus drinks para começar'}
              </Text>
            </Animated.View>
          }
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      </View>

      {/* ===== MODAL DE EDIÇÃO ===== */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(28, 31, 15, 0.5)',
            justifyContent: 'flex-end',
          }}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View
              style={{
                backgroundColor: '#F5F0EA',
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                maxHeight: '92%',
              }}
            >
              {/* Handle */}
              <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#c8cac6' }} />
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
              >
                {/* Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, marginTop: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ backgroundColor: 'rgba(204, 158, 111, 0.15)', borderRadius: 14, padding: 10 }}>
                      <Ionicons name="create-outline" size={22} color="#cc9e6f" />
                    </View>
                    <View>
                      <Text style={{ color: '#1c1f0f', fontSize: 20, fontWeight: '700' }}>Editar Drink</Text>
                      <Text style={{ color: '#707b55', fontSize: 13, marginTop: 2 }}>Altere as informações</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={closeModal} activeOpacity={0.7}>
                    <View style={{ backgroundColor: '#FFFFFF', borderRadius: 10, padding: 8, borderWidth: 1, borderColor: '#c8cac6' }}>
                      <Ionicons name="close" size={22} color="#707b55" />
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Image Preview */}
                {image ? (
                  <Image
                    source={{ uri: image }}
                    style={{ width: '100%', height: 180, borderRadius: 18, marginBottom: 20, borderWidth: 1, borderColor: '#c8cac6' }}
                    resizeMode="cover"
                  />
                ) : null}

                {/* Nome */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={labelStyle}>Nome do Drink</Text>
                  <View style={inputStyle}>
                    <Ionicons name="pencil-outline" size={18} color="#cc9e6f" style={{ marginRight: 12 }} />
                    <TextInput value={name} onChangeText={setName} placeholder="Nome do Drink" placeholderTextColor="#c8cac6" style={{ flex: 1, color: '#1c1f0f', fontSize: 15 }} autoCapitalize="words" />
                  </View>
                </View>

                {/* Ingredientes */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={labelStyle}>Ingredientes</Text>
                  <View style={{ ...inputStyle, alignItems: 'flex-start', minHeight: 80 }}>
                    <Ionicons name="list-outline" size={18} color="#cc9e6f" style={{ marginRight: 12, marginTop: 2 }} />
                    <TextInput value={ingredients} onChangeText={setIngredients} placeholder="Ex: Vodka, Limão..." placeholderTextColor="#c8cac6" style={{ flex: 1, color: '#1c1f0f', fontSize: 15, textAlignVertical: 'top' }} multiline numberOfLines={3} />
                  </View>
                </View>

                {/* Tipo */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={labelStyle}>Tipo</Text>
                  <View style={{ backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 16, borderWidth: 1.5, borderColor: '#c8cac6' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="wine-outline" size={18} color="#cc9e6f" style={{ marginRight: 12 }} />
                      <Picker selectedValue={type} onValueChange={setType} style={{ flex: 1, color: '#1c1f0f' }} dropdownIconColor="#cc9e6f">
                        <Picker.Item label="Selecione o tipo" value="" enabled={false} />
                        <Picker.Item label="Alcoólico" value="alcoholic" />
                        <Picker.Item label="Não Alcoólico" value="non-alcoholic" />
                      </Picker>
                    </View>
                  </View>
                </View>

                {/* Ficha Técnica (Insumos Segredos do Bar) */}
                <View style={{ marginBottom: 24 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <View>
                      <Text style={{ ...labelStyle, marginBottom: 0 }}>Ficha Técnica (Controle)</Text>
                      <Text style={{ color: '#a0a29f', fontSize: 11, marginLeft: 4 }}>Invisível para o cliente</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setFichasTecnicas([...fichasTecnicas, { name: '', quantity: '', unit: 'ml' }])}
                      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(120, 167, 100, 0.15)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}
                    >
                      <Ionicons name="add" size={16} color="#78a764" />
                      <Text style={{ color: '#78a764', fontSize: 13, fontWeight: '700', marginLeft: 4 }}>Insumo</Text>
                    </TouchableOpacity>
                  </View>

                  {fichasTecnicas.map((item, index) => (
                    <View key={index} style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                      <View style={{ flex: 2, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#e8e4de', justifyContent: 'center' }}>
                        <Picker
                          selectedValue={item.insumoId || ''}
                          onValueChange={(val) => {
                            const newFicha = [...fichasTecnicas];
                            newFicha[index].insumoId = val;
                            const chosen = insumos.find(i => i.id === val);
                            if (chosen) {
                               newFicha[index].name = chosen.nome;
                               newFicha[index].unit = chosen.unidade;
                            }
                            setFichasTecnicas(newFicha);
                          }}
                          style={{ color: '#1c1f0f', transform: [{ scale: 0.85 }], height: 44 }}
                        >
                          <Picker.Item label="Selecione..." value="" enabled={false} color="#a0a29f" />
                          {insumos.map(ins => (
                            <Picker.Item key={ins.id} label={ins.nome} value={ins.id} />
                          ))}
                        </Picker>
                      </View>
                      <TextInput
                        value={item.quantity}
                        onChangeText={(text) => {
                          const newFicha = [...fichasTecnicas];
                          newFicha[index].quantity = text;
                          setFichasTecnicas(newFicha);
                        }}
                        placeholder="Qtd"
                        keyboardType="numeric"
                        placeholderTextColor="#c8cac6"
                        style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: '#e8e4de', color: '#1c1f0f', fontSize: 14 }}
                      />
                      <View style={{ flex: 1, backgroundColor: '#F5F0EA', borderRadius: 10, borderWidth: 1, borderColor: '#e8e4de', justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ color: '#a0a29f', fontSize: 13, fontWeight: '600' }}>
                          {item.unit || '-'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          const newFicha = [...fichasTecnicas];
                          newFicha.splice(index, 1);
                          setFichasTecnicas(newFicha);
                        }}
                        style={{ backgroundColor: 'rgba(200, 60, 60, 0.08)', borderRadius: 10, padding: 12, justifyContent: 'center', alignItems: 'center' }}
                      >
                        <Ionicons name="trash-outline" size={18} color="#c83c3c" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  
                  {fichasTecnicas.length > 0 && (
                    <View style={{ backgroundColor: 'rgba(120, 167, 100, 0.08)', borderRadius: 14, padding: 16, marginTop: 4, borderWidth: 1.5, borderColor: '#78a764', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={{ color: '#1c1f0f', fontSize: 15, fontWeight: '700' }}>Custo de Produção:</Text>
                      <Text style={{ color: '#78a764', fontSize: 18, fontWeight: '800' }}>{formatCurrency(calculateTotalCost(fichasTecnicas))}</Text>
                    </View>
                  )}

                  {fichasTecnicas.length === 0 && (
                    <View style={{ backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: '#e8e4de', borderStyle: 'dashed', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={{ color: '#c8cac6', fontSize: 13, textAlign: 'center' }}>Cadastre insumos em 'Gestão de Custos' antes de usar nesta ficha.</Text>
                    </View>
                  )}
                </View>

                {/* URL Imagem */}
                <View style={{ marginBottom: 24 }}>
                  <Text style={labelStyle}>URL da Imagem</Text>
                  <View style={inputStyle}>
                    <Ionicons name="image-outline" size={18} color="#cc9e6f" style={{ marginRight: 12 }} />
                    <TextInput value={image} onChangeText={setImage} placeholder="https://..." placeholderTextColor="#c8cac6" style={{ flex: 1, color: '#1c1f0f', fontSize: 15 }} keyboardType="url" autoCapitalize="none" />
                  </View>
                </View>

                {/* Botões */}
                <View style={{ gap: 12 }}>
                  <TouchableOpacity
                    onPress={saveDrink}
                    disabled={saving}
                    activeOpacity={0.85}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#78a764',
                      paddingVertical: 18,
                      borderRadius: 16,
                      gap: 8,
                      opacity: saving ? 0.7 : 1,
                      shadowColor: '#78a764',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.25,
                      shadowRadius: 12,
                      elevation: 6,
                    }}
                  >
                    {saving ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" />}
                    <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 16 }}>{saving ? 'Salvando...' : 'Salvar Alterações'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={closeModal}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#FFFFFF',
                      paddingVertical: 18,
                      borderRadius: 16,
                      borderWidth: 1.5,
                      borderColor: '#c8cac6',
                      gap: 8,
                    }}
                  >
                    <Ionicons name="close-outline" size={20} color="#707b55" />
                    <Text style={{ color: '#707b55', fontWeight: '600', fontSize: 16 }}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}