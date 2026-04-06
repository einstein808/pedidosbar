import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  ScrollView,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getDatabase, ref, onValue } from 'firebase/database';
import { app } from '../src/config/firebaseConfig';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Animated, { FadeInUp, FadeIn, SlideInUp } from 'react-native-reanimated';
import { useCallback } from 'react';
import OfflineBanner from '../src/components/atoms/OfflineBanner';
import { cacheData, getCachedData, CACHE_KEYS } from '../src/services/offlineCache';
import { useNetworkStore } from '../src/store/useNetworkStore';

const { height, width } = Dimensions.get('window');

export default function DrinksMenuScreen() {
  const [drinks, setDrinks] = useState([]);
  const [filter, setFilter] = useState('alcoholic');
  const [selectedDrink, setSelectedDrink] = useState(null);
  const [expandedDrink, setExpandedDrink] = useState(null);
  const router = useRouter();
  const isOffline = useNetworkStore(s => s.isOffline);

  useFocusEffect(
    useCallback(() => {
      const loadCache = async () => {
        const cached = await getCachedData(CACHE_KEYS.DRINKS_CATALOG, []);
        if (cached.length > 0) {
          // No menu, só mostramos drinks que não estão inativos
          setDrinks(cached.filter((drink) => !drink.inactive));
        }
      };
      loadCache();
    }, [])
  );

  // Mantém a escuta do Firebase (útil quando online para receber atualizações de outras pessoas)
  useEffect(() => {
    const db = getDatabase(app);
    const drinksRef = ref(db, 'drinks/');
    const unsubscribe = onValue(drinksRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Guarda o catálogo completo no cache (para a engrenagem e outros lugares)
        const fullCatalog = Object.keys(data).map((key) => ({ id: key, ...data[key] }));
        cacheData(CACHE_KEYS.DRINKS_CATALOG, fullCatalog);
        
        // No menu de seleção, só mostra os que estão ativos
        setDrinks(fullCatalog.filter((drink) => !drink.inactive));
      } else {
        setDrinks([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const filteredDrinks = drinks.filter((drink) => {
    return filter === 'alcoholic'
      ? drink.type === 'alcoholic'
      : drink.type === 'non-alcoholic';
  });

  const renderDrink = ({ item, index }) => {
    const ingredientsArray = Array.isArray(item.ingredients)
      ? item.ingredients
      : typeof item.ingredients === 'string'
      ? item.ingredients.split(',')
      : [];

    const shortIngredients = ingredientsArray.slice(0, 2);

    return (
      <Animated.View entering={FadeInUp.duration(400).delay(index * 80)} style={{ flex: 1 / 2, margin: 6 }}>
        <TouchableOpacity
          onPress={() => setSelectedDrink(item)}
          onLongPress={() => setExpandedDrink(item)}
          delayLongPress={500}
          activeOpacity={0.85}
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 18,
            padding: 12,
            borderWidth: 1.5,
            borderColor: '#c8cac6',
            minHeight: height * 0.26,
            justifyContent: 'space-between',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          {item.image && (
            <Image
              source={{ uri: item.image }}
              style={{
                width: '100%',
                height: height * 0.13,
                borderRadius: 14,
              }}
              resizeMode="cover"
            />
          )}
          <Text
            style={{
              color: '#1c1f0f',
              fontWeight: '700',
              marginTop: 10,
              fontSize: 18,
              textAlign: 'center',
            }}
            numberOfLines={1}
          >
            {item.name}
          </Text>

          <View style={{ marginTop: 6, alignItems: 'center' }}>
            <View
              style={{
                backgroundColor: item.type === 'alcoholic'
                  ? 'rgba(204, 158, 111, 0.15)'
                  : 'rgba(120, 167, 100, 0.15)',
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: 10,
                marginBottom: 6,
              }}
            >
              <Text
                style={{
                  color: item.type === 'alcoholic' ? '#cc9e6f' : '#78a764',
                  fontSize: 13,
                  fontWeight: '600',
                }}
              >
                {item.type === 'alcoholic' ? '🍸 Alcoólico' : '🍹 Sem álcool'}
              </Text>
            </View>

            {shortIngredients.map((ing, i) => (
              <Text
                key={i}
                style={{ color: '#707b55', fontSize: 14, textAlign: 'center' }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                • {ing.trim()}
              </Text>
            ))}

            {ingredientsArray.length > 2 && (
              <Text style={{ color: '#c8cac6', fontSize: 12, textAlign: 'center', marginTop: 2 }}>
                +{ingredientsArray.length - 2} outros
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0EA' }}>
      <OfflineBanner />
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ backgroundColor: '#1c1f0f', borderRadius: 14, padding: 10 }}>
            <Ionicons name="book-outline" size={20} color="#cc9e6f" />
          </View>
          <Text style={{ color: '#1c1f0f', fontSize: 24, fontWeight: '700' }}>Cardápio</Text>
        </View>

        {/* QR Code */}
        <View style={{ alignItems: 'center' }}>
          <Image
            source={{ uri: 'https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=https://instagram.com/laboratoriodedrink' }}
            style={{
              width: 52,
              height: 52,
              borderRadius: 10,
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: '#c8cac6',
            }}
          />
          <Text style={{ color: '#707b55', fontSize: 9, marginTop: 2 }}>@laboratoriodedrink</Text>
        </View>
      </View>

      {/* Filtros */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 16, gap: 10, paddingHorizontal: 20 }}>
        <TouchableOpacity
          onPress={() => setFilter('alcoholic')}
          activeOpacity={0.85}
          style={{
            flex: 1,
            paddingVertical: 14,
            borderRadius: 14,
            backgroundColor: filter === 'alcoholic' ? '#1c1f0f' : '#FFFFFF',
            borderWidth: filter === 'alcoholic' ? 0 : 1.5,
            borderColor: '#c8cac6',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: filter === 'alcoholic' ? '#cc9e6f' : '#707b55', fontSize: 15, fontWeight: '600' }}>
            🍸 Alcoólicos
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setFilter('non-alcoholic')}
          activeOpacity={0.85}
          style={{
            flex: 1,
            paddingVertical: 14,
            borderRadius: 14,
            backgroundColor: filter === 'non-alcoholic' ? '#1c1f0f' : '#FFFFFF',
            borderWidth: filter === 'non-alcoholic' ? 0 : 1.5,
            borderColor: '#c8cac6',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: filter === 'non-alcoholic' ? '#cc9e6f' : '#707b55', fontSize: 15, fontWeight: '600' }}>
            🍹 Sem Álcool
          </Text>
        </TouchableOpacity>
      </View>

      {/* Grid */}
      <FlatList
        data={filteredDrinks}
        renderItem={renderDrink}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      />

      {/* Botão Fazer Pedido */}
      <TouchableOpacity
        onPress={() => router.push('/pedidosBar')}
        activeOpacity={0.85}
        style={{
          position: 'absolute',
          bottom: 16,
          left: 20,
          right: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1c1f0f',
          paddingVertical: 18,
          borderRadius: 16,
          gap: 8,
          shadowColor: '#1c1f0f',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 10,
          elevation: 8,
        }}
      >
        <Ionicons name="cart-outline" size={20} color="#cc9e6f" />
        <Text style={{ color: '#cc9e6f', fontWeight: '700', fontSize: 17 }}>Fazer Pedido</Text>
      </TouchableOpacity>

      {/* Modal de detalhes */}
      <Modal
        visible={!!selectedDrink}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedDrink(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(28, 31, 15, 0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#F5F0EA', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '80%' }}>
            {/* Handle */}
            <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#c8cac6' }} />
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
              {selectedDrink?.image && (
                <Image
                  source={{ uri: selectedDrink.image }}
                  style={{ width: '100%', height: 220, borderRadius: 18, marginBottom: 20, borderWidth: 1, borderColor: '#c8cac6' }}
                  resizeMode="cover"
                />
              )}

              <Text style={{ color: '#1c1f0f', fontSize: 26, fontWeight: '700', marginBottom: 8 }}>
                {selectedDrink?.name}
              </Text>

              <View
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: selectedDrink?.type === 'alcoholic'
                    ? 'rgba(204, 158, 111, 0.15)'
                    : 'rgba(120, 167, 100, 0.15)',
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: 12,
                  marginBottom: 20,
                }}
              >
                <Text style={{
                  color: selectedDrink?.type === 'alcoholic' ? '#cc9e6f' : '#78a764',
                  fontSize: 13,
                  fontWeight: '600',
                }}>
                  {selectedDrink?.type === 'alcoholic' ? '🍸 Alcoólico' : '🍹 Não Alcoólico'}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Ionicons name="list-outline" size={18} color="#cc9e6f" />
                <Text style={{ color: '#1c1f0f', fontWeight: '700', fontSize: 17 }}>Ingredientes</Text>
              </View>

              {(
                Array.isArray(selectedDrink?.ingredients)
                  ? selectedDrink.ingredients
                  : typeof selectedDrink?.ingredients === 'string'
                    ? selectedDrink.ingredients.split(',')
                    : []
              ).map((ingredient, index) => (
                <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, paddingLeft: 4 }}>
                  <Ionicons name="leaf-outline" size={14} color="#78a764" />
                  <Text style={{ color: '#707b55', fontSize: 15 }}>{ingredient.trim()}</Text>
                </View>
              ))}

              <TouchableOpacity
                onPress={() => setSelectedDrink(null)}
                activeOpacity={0.85}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#FFFFFF',
                  marginTop: 24,
                  paddingVertical: 16,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: '#c8cac6',
                  gap: 6,
                }}
              >
                <Ionicons name="close-outline" size={20} color="#707b55" />
                <Text style={{ color: '#707b55', fontWeight: '600', fontSize: 15 }}>Fechar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Expandido (Long Press) */}
      <Modal
        visible={!!expandedDrink}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setExpandedDrink(null)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(28, 31, 15, 0.85)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 16,
        }}>
          <Animated.View
            entering={SlideInUp.duration(400).springify()}
            style={{
              backgroundColor: '#F5F0EA',
              borderRadius: 28,
              width: width - 32,
              maxHeight: height * 0.85,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.25,
              shadowRadius: 20,
              elevation: 16,
            }}
          >
            {/* Botão minimizar no topo */}
            <TouchableOpacity
              onPress={() => setExpandedDrink(null)}
              activeOpacity={0.7}
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                zIndex: 10,
                backgroundColor: 'rgba(28, 31, 15, 0.7)',
                borderRadius: 20,
                width: 40,
                height: 40,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="close" size={22} color="#F5F0EA" />
            </TouchableOpacity>

            <ScrollView
              contentContainerStyle={{ paddingBottom: 30 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Imagem grande */}
              {expandedDrink?.image && (
                <Image
                  source={{ uri: expandedDrink.image }}
                  style={{
                    width: '100%',
                    height: height * 0.35,
                    borderTopLeftRadius: 28,
                    borderTopRightRadius: 28,
                  }}
                  resizeMode="cover"
                />
              )}

              <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
                {/* Nome do drink em destaque */}
                <Text style={{
                  color: '#1c1f0f',
                  fontSize: 32,
                  fontWeight: '800',
                  marginBottom: 12,
                  letterSpacing: -0.5,
                }}>
                  {expandedDrink?.name}
                </Text>

                {/* Badge tipo */}
                <View
                  style={{
                    alignSelf: 'flex-start',
                    backgroundColor: expandedDrink?.type === 'alcoholic'
                      ? 'rgba(204, 158, 111, 0.2)'
                      : 'rgba(120, 167, 100, 0.2)',
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 14,
                    marginBottom: 24,
                  }}
                >
                  <Text style={{
                    color: expandedDrink?.type === 'alcoholic' ? '#cc9e6f' : '#78a764',
                    fontSize: 16,
                    fontWeight: '700',
                  }}>
                    {expandedDrink?.type === 'alcoholic' ? '🍸 Alcoólico' : '🍹 Não Alcoólico'}
                  </Text>
                </View>

                {/* Seção ingredientes */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 16,
                }}>
                  <View style={{
                    backgroundColor: '#1c1f0f',
                    borderRadius: 12,
                    padding: 8,
                  }}>
                    <Ionicons name="list-outline" size={20} color="#cc9e6f" />
                  </View>
                  <Text style={{ color: '#1c1f0f', fontWeight: '700', fontSize: 20 }}>Ingredientes</Text>
                </View>

                {(
                  Array.isArray(expandedDrink?.ingredients)
                    ? expandedDrink.ingredients
                    : typeof expandedDrink?.ingredients === 'string'
                      ? expandedDrink.ingredients.split(',')
                      : []
                ).map((ingredient, index) => (
                  <View key={index} style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 10,
                    paddingLeft: 6,
                    paddingVertical: 8,
                    backgroundColor: '#FFFFFF',
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    borderWidth: 1,
                    borderColor: '#e8e4de',
                  }}>
                    <Ionicons name="leaf-outline" size={18} color="#78a764" />
                    <Text style={{ color: '#1c1f0f', fontSize: 18, fontWeight: '500', flex: 1 }}>
                      {ingredient.trim()}
                    </Text>
                  </View>
                ))}

                {/* Descrição se existir */}
                {expandedDrink?.description && (
                  <View style={{ marginTop: 20 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <View style={{ backgroundColor: '#1c1f0f', borderRadius: 12, padding: 8 }}>
                        <Ionicons name="document-text-outline" size={20} color="#cc9e6f" />
                      </View>
                      <Text style={{ color: '#1c1f0f', fontWeight: '700', fontSize: 20 }}>Descrição</Text>
                    </View>
                    <Text style={{ color: '#707b55', fontSize: 17, lineHeight: 26 }}>
                      {expandedDrink.description}
                    </Text>
                  </View>
                )}

                {/* Botão minimizar grande */}
                <TouchableOpacity
                  onPress={() => setExpandedDrink(null)}
                  activeOpacity={0.85}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#1c1f0f',
                    marginTop: 28,
                    paddingVertical: 18,
                    borderRadius: 16,
                    gap: 8,
                  }}
                >
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