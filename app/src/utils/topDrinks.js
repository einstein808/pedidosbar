import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, Dimensions } from 'react-native';
import { db } from '../config/firebaseConfig';
import { ref, onValue, get } from 'firebase/database';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import '../../../global.css';

export default function TopDrinks() {
  const [ranking, setRanking] = useState([]);
  const { height: screenHeight } = Dimensions.get('window');

  useEffect(() => {
    const pedidosRef = ref(db, 'pedidos');
    const unsubscribe = onValue(pedidosRef, async (snapshot) => {
      const data = snapshot.val();
      const contagem = {};

      if (data) {
        Object.values(data).forEach((pedido) => {
          const drinks = pedido.drinks || [];
          drinks.forEach((drink) => {
            const nome = drink.drinkName?.trim();
            const qtd = Number(drink.quantity);
            if (nome && qtd) {
              contagem[nome] = (contagem[nome] || 0) + qtd;
            }
          });
        });
      }

      const rankingArray = Object.entries(contagem)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([drink, quantidade], i) => ({ drink, quantidade, rank: i + 1 }));

      const enrichedRanking = await Promise.all(
        rankingArray.map(async (item) => {
          try {
            const drinkRef = ref(db, `drinks/${item.drink}`);
            const drinkSnapshot = await get(drinkRef);
            const drinkData = drinkSnapshot.exists() ? drinkSnapshot.val() : {};
            return { ...item, image: drinkData.image || null };
          } catch (error) {
            return { ...item, image: null };
          }
        })
      );

      setRanking(enrichedRanking);
    });

    return () => unsubscribe();
  }, []);

  const medalha = ['🥇', '🥈', '🥉'];

  return (
    <View className="w-[80%] mx-auto min-h-24 max-h-40 bg-[#F5F5F5] rounded-xl p-4 shadow-sm" style={{ elevation: 2 }}>
      <Animated.View entering={FadeInUp.duration(500)} className="flex-row items-center mb-4">
        <Ionicons name="flame-outline" size={24} color="#D4A017" className="mr-2" />
        <Text className="text-2xl font-bold text-[#1F2937]">Top 3 Drinks</Text>
      </Animated.View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 4 }}
      >
        {ranking.map(({ drink, quantidade, rank, image }, index) => (
          <Animated.View
            key={drink}
            entering={FadeInUp.duration(500).delay(index * 150)}
            className="flex-row items-center bg-gradient-to-b from-[#FFFFFF] to-[#EDEDED] rounded-xl p-3 mr-4 border border-[#D4A017]/20 shadow-sm"
            style={{ width: 120, elevation: 2 }}
          >
            <Text className="text-xl mr-2" style={{ color: '#D4A017' }}>
              {medalha[index]}
            </Text>
            <View className="mr-2">
              {image ? (
                <Image
                  source={{ uri: image }}
                  className="w-10 h-10 rounded-full"
                  resizeMode="cover"
                />
              ) : (
                <Ionicons name="wine-outline" size={32} color="#D4A017" />
              )}
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-[#1F2937]" numberOfLines={1}>
                {drink}
              </Text>
              <Text className="text-sm text-[#6B7280]">Pedidos: {quantidade}</Text>
            </View>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}