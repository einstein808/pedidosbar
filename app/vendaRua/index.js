import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, Alert, ScrollView, Modal,
  Dimensions, useWindowDimensions,
} from 'react-native';
import { getDatabase, ref, onValue } from 'firebase/database';
import { app } from '../src/config/firebaseConfig';
import { useAppStore } from '../src/store/useAppStore';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, SlideInUp } from 'react-native-reanimated';
import '../../global.css';
import { SafeAreaView } from 'react-native-safe-area-context';
import OfflineBanner from '../src/components/atoms/OfflineBanner';
import { useNetworkStore } from '../src/store/useNetworkStore';
import { cacheData, getCachedData, CACHE_KEYS } from '../src/services/offlineCache';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

export default function VendaRuaCatalogoScreen() {
  const selectedDrinks = useAppStore(s => s.selectedDrinks);
  const setSelectedDrinks = useAppStore(s => s.setSelectedDrinks);
  const [drinks, setDrinks] = useState([]);
  const [filter, setFilter] = useState('alcoholic');
  const [cartExpanded, setCartExpanded] = useState(false);
  const [expandedDrink, setExpandedDrink] = useState(null);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isOffline = useNetworkStore(s => s.isOffline);
  const numColumns = width > 768 ? 4 : 3;

  const formatCurrency = (val) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  useEffect(() => { setSelectedDrinks([]); }, []);

  useEffect(() => {
    const loadCachedDrinks = async () => {
      const cached = await getCachedData(CACHE_KEYS.DRINKS_CATALOG, []);
      if (cached.length > 0) setDrinks(cached.filter(d => !d.inactive));
    };
    loadCachedDrinks();
    const db = getDatabase(app);
    const drinksRef = ref(db, 'drinks/');
    const unsubscribe = onValue(drinksRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const fullCatalog = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        cacheData(CACHE_KEYS.DRINKS_CATALOG, fullCatalog);
        setDrinks(fullCatalog.filter(d => !d.inactive));
      } else if (!isOffline) { setDrinks([]); }
    });
    return () => unsubscribe();
  }, [isOffline]);

  const filteredDrinks = drinks.filter(drink =>
    filter === 'all' ? true : filter === 'alcoholic' ? drink.type === 'alcoholic' : drink.type === 'non-alcoholic'
  );
  const totalDrinksCount = selectedDrinks.reduce((sum, d) => sum + d.quantity, 0);
  const totalValue = selectedDrinks.reduce((sum, d) => {
    const drink = drinks.find(dr => dr.name === d.drinkName);
    return sum + ((drink?.price || 0) * d.quantity);
  }, 0);

  const addDrink = (drink) => {
    const index = selectedDrinks.findIndex(d => d.drinkName === drink.name);
    if (index !== -1) {
      const updated = [...selectedDrinks];
      updated[index].quantity += 1;
      setSelectedDrinks(updated);
    } else {
      setSelectedDrinks([...selectedDrinks, { drinkName: drink.name, quantity: 1 }]);
    }
  };
  const removeDrink = (drinkName) => {
    const updated = selectedDrinks
      .map(d => (d.drinkName === drinkName ? { ...d, quantity: d.quantity - 1 } : d))
      .filter(d => d.quantity > 0);
    setSelectedDrinks(updated);
  };
  const removeAll = (drinkName) => setSelectedDrinks(selectedDrinks.filter(d => d.drinkName !== drinkName));
  const clearCart = () => {
    Alert.alert('Limpar pedido', 'Deseja remover todos os drinks?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Limpar', style: 'destructive', onPress: () => setSelectedDrinks([]) },
    ]);
  };
  const handleNext = () => {
    if (selectedDrinks.length === 0) { Alert.alert('Erro', 'Selecione pelo menos um drink.'); return; }
    router.push('/vendaRua/resumo');
  };

  const renderItem = ({ item }) => {
    const selected = selectedDrinks.find(d => d.drinkName === item.name);
    const hasPrice = item.price != null && item.price > 0;
    return (
      <Animated.View entering={FadeInUp.duration(500)} style={{
        flex: 1, marginHorizontal: 4, marginBottom: 12, borderRadius: 18,
        backgroundColor: '#FFFFFF', borderWidth: 1.5,
        borderColor: selected ? '#1e824c' : '#c8cac6', elevation: 2,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, overflow: 'hidden',
      }}>
        <TouchableOpacity onPress={() => addDrink(item)} onLongPress={() => setExpandedDrink(item)} delayLongPress={500} activeOpacity={0.85}>
          {selected && (
            <View style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, backgroundColor: '#1e824c', borderRadius: 14, minWidth: 28, height: 28, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 }}>
              <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>{selected.quantity}</Text>
            </View>
          )}
          {item.image && <Image source={{ uri: item.image }} style={{ width: '100%', height: 120, borderTopLeftRadius: 16, borderTopRightRadius: 16 }} resizeMode="cover" />}
          <View style={{ padding: 12, gap: 4 }}>
            <Text style={{ color: '#1c1f0f', fontSize: 17, fontWeight: '700' }} numberOfLines={1}>{item.name}</Text>
            {hasPrice ? (
              <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(30, 130, 76, 0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                <Text style={{ color: '#1e824c', fontSize: 15, fontWeight: '800' }}>{formatCurrency(item.price)}</Text>
              </View>
            ) : (
              <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(200, 60, 60, 0.08)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                <Text style={{ color: '#c83c3c', fontSize: 11, fontWeight: '600' }}>Sem preço</Text>
              </View>
            )}
            <View style={{ alignSelf: 'flex-start', backgroundColor: item.type === 'alcoholic' ? 'rgba(204, 158, 111, 0.15)' : 'rgba(120, 167, 100, 0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 2 }}>
              <Text style={{ color: item.type === 'alcoholic' ? '#cc9e6f' : '#78a764', fontSize: 12, fontWeight: '600' }}>
                {item.type === 'alcoholic' ? '🍸 Alcoólico' : '🍹 Sem álcool'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0EA' }}>
      <OfflineBanner />
      <View style={{ flex: 1, backgroundColor: '#F5F0EA', padding: 16 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
            <Ionicons name="arrow-back" size={24} color="#1c1f0f" />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ backgroundColor: '#1e824c', borderRadius: 12, padding: 8 }}>
              <Ionicons name="storefront-outline" size={20} color="#FFFFFF" />
            </View>
            <Text style={{ color: '#1c1f0f', fontSize: 22, fontWeight: '700' }}>Venda de Rua</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Filters */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 16, gap: 8 }}>
          {[{ key: 'alcoholic', label: 'Alcoólicos' }, { key: 'non-alcoholic', label: 'Sem Álcool' }].map(f => (
            <TouchableOpacity key={f.key} style={{
              flex: 1, paddingVertical: 12, borderRadius: 14,
              backgroundColor: filter === f.key ? '#1c1f0f' : '#FFFFFF',
              borderWidth: filter === f.key ? 0 : 1.5, borderColor: '#c8cac6', alignItems: 'center',
            }} onPress={() => setFilter(f.key)} activeOpacity={0.85}>
              <Text style={{ color: filter === f.key ? '#cc9e6f' : '#707b55', fontSize: 13, fontWeight: '600' }}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Grid */}
        <FlatList key={numColumns} data={filteredDrinks} keyExtractor={item => item.id} numColumns={numColumns}
          columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 4 }}
          contentContainerStyle={{ paddingBottom: 140 }} renderItem={renderItem} showsVerticalScrollIndicator={false} />

        {/* FLOATING CART */}
        {selectedDrinks.length > 0 && (
          <View style={{ position: 'absolute', bottom: 16, left: 16, right: 16 }}>
            {cartExpanded && (
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1.5, borderColor: '#1e824c', padding: 20, marginBottom: 12, maxHeight: 320, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="cart" size={20} color="#1e824c" />
                    <Text style={{ color: '#1c1f0f', fontSize: 18, fontWeight: '700' }}>Pedido</Text>
                    <View style={{ backgroundColor: '#1e824c', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, minWidth: 24, alignItems: 'center' }}>
                      <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>{totalDrinksCount}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={clearCart} style={{ backgroundColor: 'rgba(200, 60, 60, 0.08)', borderRadius: 8, padding: 6 }}>
                      <Ionicons name="trash-outline" size={18} color="#c83c3c" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setCartExpanded(false)} style={{ backgroundColor: 'rgba(112, 123, 85, 0.1)', borderRadius: 8, padding: 6 }}>
                      <Ionicons name="chevron-down" size={18} color="#707b55" />
                    </TouchableOpacity>
                  </View>
                </View>
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 160 }}>
                  {selectedDrinks.map((drink, idx) => {
                    const unitPrice = drinks.find(d => d.name === drink.drinkName)?.price || 0;
                    return (
                      <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(30, 130, 76, 0.04)', borderRadius: 12, padding: 12, marginBottom: 8 }}>
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <Text style={{ color: '#1c1f0f', fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{drink.drinkName}</Text>
                          <Text style={{ color: '#707b55', fontSize: 12 }}>{formatCurrency(unitPrice)} × {drink.quantity}</Text>
                        </View>
                        <Text style={{ color: '#1e824c', fontSize: 15, fontWeight: '800', marginRight: 8 }}>{formatCurrency(unitPrice * drink.quantity)}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <TouchableOpacity onPress={() => removeDrink(drink.drinkName)} style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(200, 60, 60, 0.08)', borderWidth: 1.5, borderColor: 'rgba(200, 60, 60, 0.4)', justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name="remove" size={18} color="#c83c3c" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => addDrink({ name: drink.drinkName })} style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(30, 130, 76, 0.12)', borderWidth: 1.5, borderColor: '#1e824c', justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name="add" size={18} color="#1e824c" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => removeAll(drink.drinkName)} style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(200, 202, 198, 0.3)', justifyContent: 'center', alignItems: 'center', marginLeft: 2 }}>
                            <Ionicons name="close" size={16} color="#707b55" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
                <View style={{ marginTop: 8, backgroundColor: 'rgba(30, 130, 76, 0.08)', borderRadius: 12, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: '#1c1f0f', fontSize: 16, fontWeight: '700' }}>Total</Text>
                  <Text style={{ color: '#1e824c', fontSize: 22, fontWeight: '900' }}>{formatCurrency(totalValue)}</Text>
                </View>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => setCartExpanded(!cartExpanded)} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 14, borderWidth: 1.5, borderColor: '#1e824c', gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 }}>
                <Ionicons name="cart" size={20} color="#1e824c" />
                <View style={{ backgroundColor: '#1e824c', borderRadius: 10, minWidth: 24, height: 24, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 }}>
                  <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>{totalDrinksCount}</Text>
                </View>
                <Text style={{ color: '#1e824c', fontSize: 14, fontWeight: '800' }}>{formatCurrency(totalValue)}</Text>
                <Ionicons name={cartExpanded ? 'chevron-down' : 'chevron-up'} size={14} color="#707b55" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleNext} activeOpacity={0.85} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e824c', borderRadius: 14, paddingVertical: 16, gap: 8, shadowColor: '#1e824c', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 }}>
                <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 16 }}>Finalizar</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Expanded Drink Modal */}
      <Modal visible={!!expandedDrink} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setExpandedDrink(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(28, 31, 15, 0.85)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <Animated.View entering={SlideInUp.duration(400).springify()} style={{ backgroundColor: '#F5F0EA', borderRadius: 28, width: screenWidth - 32, maxHeight: screenHeight * 0.85, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 16 }}>
            <TouchableOpacity onPress={() => setExpandedDrink(null)} style={{ position: 'absolute', top: 14, right: 14, zIndex: 10, backgroundColor: 'rgba(28, 31, 15, 0.7)', borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={22} color="#F5F0EA" />
            </TouchableOpacity>
            <ScrollView contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
              {expandedDrink?.image && <Image source={{ uri: expandedDrink.image }} style={{ width: '100%', height: screenHeight * 0.35, borderTopLeftRadius: 28, borderTopRightRadius: 28 }} resizeMode="cover" />}
              <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
                <Text style={{ color: '#1c1f0f', fontSize: 32, fontWeight: '800', marginBottom: 12, letterSpacing: -0.5 }}>{expandedDrink?.name}</Text>
                {expandedDrink?.price != null && expandedDrink?.price > 0 && (
                  <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(30, 130, 76, 0.12)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 14, marginBottom: 12 }}>
                    <Text style={{ color: '#1e824c', fontSize: 22, fontWeight: '900' }}>{formatCurrency(expandedDrink.price)}</Text>
                  </View>
                )}
                <View style={{ alignSelf: 'flex-start', backgroundColor: expandedDrink?.type === 'alcoholic' ? 'rgba(204, 158, 111, 0.2)' : 'rgba(120, 167, 100, 0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 14, marginBottom: 24 }}>
                  <Text style={{ color: expandedDrink?.type === 'alcoholic' ? '#cc9e6f' : '#78a764', fontSize: 16, fontWeight: '700' }}>
                    {expandedDrink?.type === 'alcoholic' ? '🍸 Alcoólico' : '🍹 Não Alcoólico'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <View style={{ backgroundColor: '#1c1f0f', borderRadius: 12, padding: 8 }}><Ionicons name="list-outline" size={20} color="#cc9e6f" /></View>
                  <Text style={{ color: '#1c1f0f', fontWeight: '700', fontSize: 20 }}>Ingredientes</Text>
                </View>
                {(Array.isArray(expandedDrink?.ingredients) ? expandedDrink.ingredients : typeof expandedDrink?.ingredients === 'string' ? expandedDrink.ingredients.split(',') : []).map((ingredient, index) => (
                  <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10, paddingVertical: 8, backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#e8e4de' }}>
                    <Ionicons name="leaf-outline" size={18} color="#78a764" />
                    <Text style={{ color: '#1c1f0f', fontSize: 18, fontWeight: '500', flex: 1 }}>{ingredient.trim()}</Text>
                  </View>
                ))}
                <TouchableOpacity onPress={() => { addDrink(expandedDrink); setExpandedDrink(null); }} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e824c', marginTop: 28, paddingVertical: 18, borderRadius: 16, gap: 8 }}>
                  <Ionicons name="add-circle-outline" size={22} color="#FFF" />
                  <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 17 }}>Adicionar ao Pedido</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setExpandedDrink(null)} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1c1f0f', marginTop: 10, paddingVertical: 18, borderRadius: 16, gap: 8 }}>
                  <Ionicons name="chevron-down-outline" size={22} color="#cc9e6f" />
                  <Text style={{ color: '#cc9e6f', fontWeight: '700', fontSize: 17 }}>Minimizar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
