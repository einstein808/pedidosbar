import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { getDatabase, ref, set, onValue } from 'firebase/database';
import { app } from '../src/config/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { withTimeout } from '../src/utils/firebaseHelpers';
import { cacheData, getCachedData, CACHE_KEYS } from '../src/services/offlineCache';
import { useNetworkStore } from '../src/store/useNetworkStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import '../../global.css';

export default function CreateDrink() {
  const [image, setImage] = useState('');
  const [name, setName] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [fichasTecnicas, setFichasTecnicas] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [type, setType] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const db = getDatabase(app);
    const insumosRef = ref(db, 'insumos');
    const unsubscribe = onValue(insumosRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const lista = Object.keys(data).map((key) => ({ id: key, ...data[key] }));
        setInsumos(lista);
      } else {
        setInsumos([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const calculateTotalCost = () => {
    return fichasTecnicas.reduce((total, ficha) => {
      const insumoInfo = insumos.find(i => i.id === ficha.insumoId);
      if (!insumoInfo || !ficha.quantity) return total;
      const qtd = parseFloat(ficha.quantity);
      if (isNaN(qtd)) return total;
      return total + (insumoInfo.custoUnidadeMinima * qtd);
    }, 0);
  };

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);


  const isOffline = useNetworkStore(s => s.isOffline);

  const saveDrink = async () => {
    if (!name || !ingredients || !type || !image) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos!');
      return;
    }

    setSaving(true);
    const parsedPrice = price ? parseFloat(price.replace(',', '.')) : null;
    const drinkData = { name, ingredients, type, image, fichaTecnica: fichasTecnicas, price: parsedPrice };

    try {
      if (isOffline) {
        // Fallback offline: salva no cache local e enfileira para sync
        const cachedCatalog = await getCachedData(CACHE_KEYS.DRINKS_CATALOG, []);
        const newEntry = { id: name, ...drinkData };
        const updatedCatalog = [...cachedCatalog.filter(d => d.id !== name), newEntry];
        await cacheData(CACHE_KEYS.DRINKS_CATALOG, updatedCatalog);

        // Enfileira criação para sync posterior
        const DRINK_CREATE_KEY = '@barman_drinks_create_queue';
        const queueJson = await AsyncStorage.getItem(DRINK_CREATE_KEY);
        const queue = queueJson ? JSON.parse(queueJson) : [];
        queue.push({ id: name, data: drinkData });
        await AsyncStorage.setItem(DRINK_CREATE_KEY, JSON.stringify(queue));

        Alert.alert('Salvo Localmente ☁️', 'Drink salvo offline. Será sincronizado quando a internet voltar.');
        setName('');
        setIngredients('');
        setFichasTecnicas([]);
        setType('');
        setPrice('');
        setImage('');
      } else {
        const db = getDatabase(app);
        const drinksRef = ref(db, 'drinks/' + name);
        await withTimeout(set(drinksRef, drinkData), 4000);

        Alert.alert('Sucesso', 'Drink adicionado com sucesso!');
        setName('');
        setIngredients('');
        setFichasTecnicas([]);
        setType('');
        setPrice('');
        setImage('');
      }
    } catch (error) {
      if (error.message === 'TIMEOUT_FIREBASE') {
        // Timeout = rede fraca, salva offline como fallback
        const cachedCatalog = await getCachedData(CACHE_KEYS.DRINKS_CATALOG, []);
        const newEntry = { id: name, ...drinkData };
        const updatedCatalog = [...cachedCatalog.filter(d => d.id !== name), newEntry];
        await cacheData(CACHE_KEYS.DRINKS_CATALOG, updatedCatalog);

        const DRINK_CREATE_KEY = '@barman_drinks_create_queue';
        const queueJson = await AsyncStorage.getItem(DRINK_CREATE_KEY);
        const queue = queueJson ? JSON.parse(queueJson) : [];
        queue.push({ id: name, data: drinkData });
        await AsyncStorage.setItem(DRINK_CREATE_KEY, JSON.stringify(queue));

        Alert.alert('Rede Fraca', 'Drink salvo localmente. Será sincronizado automaticamente.');
        setName('');
        setIngredients('');
        setFichasTecnicas([]);
        setType('');
        setPrice('');
        setImage('');
      } else {
        Alert.alert('Erro', 'Erro ao salvar o drink: ' + error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#c8cac6',
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0EA' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View entering={FadeInUp.duration(500)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 24 }}>
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
                <Ionicons name="add-circle-outline" size={24} color="#78a764" />
                <Text style={{ color: '#1c1f0f', fontSize: 22, fontWeight: '700' }}>
                  Criar Novo Drink
                </Text>
              </View>

              <View style={{ width: 42 }} />
            </View>
          </Animated.View>

          {/* Preview da Imagem */}
          <Animated.View entering={FadeInUp.duration(500).delay(100)}>
            {image ? (
              <Image
                source={{ uri: image }}
                style={{
                  width: '100%',
                  height: 200,
                  borderRadius: 18,
                  marginBottom: 24,
                  borderWidth: 1,
                  borderColor: '#c8cac6',
                }}
                resizeMode="cover"
                onError={() => Alert.alert('Erro', 'URL da imagem inválida!')}
              />
            ) : (
              <View
                style={{
                  width: '100%',
                  height: 160,
                  borderRadius: 18,
                  marginBottom: 24,
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1.5,
                  borderColor: '#c8cac6',
                  borderStyle: 'dashed',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="image-outline" size={40} color="#c8cac6" />
                <Text style={{ color: '#707b55', fontSize: 13, marginTop: 8 }}>
                  Cole a URL abaixo para ver a prévia
                </Text>
              </View>
            )}
          </Animated.View>

          {/* Campo Nome */}
          <Animated.View entering={FadeInUp.duration(500).delay(200)}>
            <Text style={labelStyle}>Nome do Drink</Text>
            <View style={inputStyle}>
              <Ionicons name="pencil-outline" size={18} color="#cc9e6f" style={{ marginRight: 12 }} />
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Ex: Mojito, Caipirinha..."
                placeholderTextColor="#c8cac6"
                style={{ flex: 1, color: '#1c1f0f', fontSize: 15 }}
                autoCapitalize="words"
              />
            </View>
          </Animated.View>

          {/* Campo Ingredientes */}
          <Animated.View entering={FadeInUp.duration(500).delay(300)}>
            <Text style={labelStyle}>Ingredientes</Text>
            <View style={{ ...inputStyle, alignItems: 'flex-start', minHeight: 80 }}>
              <Ionicons name="list-outline" size={18} color="#cc9e6f" style={{ marginRight: 12, marginTop: 2 }} />
              <TextInput
                value={ingredients}
                onChangeText={setIngredients}
                placeholder="Ex: Vodka, Limão, Açúcar..."
                placeholderTextColor="#c8cac6"
                style={{ flex: 1, color: '#1c1f0f', fontSize: 15, textAlignVertical: 'top' }}
                multiline
                numberOfLines={3}
              />
            </View>
          </Animated.View>

          {/* Dropdown Tipo */}
          <Animated.View entering={FadeInUp.duration(500).delay(400)}>
            <Text style={labelStyle}>Tipo</Text>
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 14,
                paddingHorizontal: 16,
                marginBottom: 24,
                borderWidth: 1.5,
                borderColor: '#c8cac6',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="wine-outline" size={18} color="#cc9e6f" style={{ marginRight: 12 }} />
                <Picker
                  selectedValue={type}
                  onValueChange={(itemValue) => setType(itemValue)}
                  style={{ flex: 1, color: '#1c1f0f' }}
                  dropdownIconColor="#cc9e6f"
                >
                  <Picker.Item label="Selecione o tipo" value="" enabled={false} />
                  <Picker.Item label="Alcoólico" value="alcoholic" />
                  <Picker.Item label="Não Alcoólico" value="non-alcoholic" />
                </Picker>
              </View>
            </View>
          </Animated.View>

          {/* Ficha Técnica (Insumos Segredos do Bar) */}
          <Animated.View entering={FadeInUp.duration(500).delay(450)}>
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
                <Text style={{ color: '#78a764', fontSize: 18, fontWeight: '800' }}>{formatCurrency(calculateTotalCost())}</Text>
              </View>
            )}

            {fichasTecnicas.length === 0 && (
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: '#e8e4de', borderStyle: 'dashed', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ color: '#c8cac6', fontSize: 13, textAlign: 'center' }}>Cadastre insumos em 'Gestão de Custos' antes de usar nesta ficha.</Text>
              </View>
            )}
            <View style={{ marginBottom: 24 }} />
          </Animated.View>

          {/* Campo URL da Imagem */}
          <Animated.View entering={FadeInUp.duration(500).delay(500)}>
            <Text style={labelStyle}>URL da Imagem</Text>
            <View style={{ ...inputStyle, marginBottom: 16 }}>
              <Ionicons name="image-outline" size={18} color="#cc9e6f" style={{ marginRight: 12 }} />
              <TextInput
                value={image}
                onChangeText={setImage}
                placeholder="https://exemplo.com/imagem.jpg"
                placeholderTextColor="#c8cac6"
                style={{ flex: 1, color: '#1c1f0f', fontSize: 15 }}
                keyboardType="url"
                autoCapitalize="none"
              />
            </View>
          </Animated.View>

          {/* Campo Preço de Venda */}
          <Animated.View entering={FadeInUp.duration(500).delay(550)}>
            <Text style={labelStyle}>Preço de Venda (R$) — Opcional</Text>
            <View style={{ ...inputStyle, marginBottom: 28 }}>
              <Ionicons name="pricetag-outline" size={18} color="#78a764" style={{ marginRight: 12 }} />
              <TextInput
                value={price}
                onChangeText={setPrice}
                placeholder="Ex: 25,00"
                placeholderTextColor="#c8cac6"
                style={{ flex: 1, color: '#1c1f0f', fontSize: 15 }}
                keyboardType="decimal-pad"
              />
            </View>
            <Text style={{ color: '#a0a29f', fontSize: 11, marginLeft: 4, marginTop: -22, marginBottom: 20 }}>
              Usado apenas no modo Venda de Rua. Festas não exibem preço.
            </Text>
          </Animated.View>

          {/* Botão Salvar */}
          <Animated.View entering={FadeInUp.duration(500).delay(600)}>
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
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
              )}
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>
                {saving ? 'Salvando...' : 'Salvar Drink'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}