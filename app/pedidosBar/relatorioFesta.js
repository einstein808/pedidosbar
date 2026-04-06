import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { getDatabase, ref, onValue, update } from 'firebase/database';
import { app } from '../src/config/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import '../../global.css';

import OfflineBanner from '../src/components/atoms/OfflineBanner';
import { useNetworkStore } from '../src/store/useNetworkStore';
import { cacheData, getCachedData, CACHE_KEYS } from '../src/services/offlineCache';

export default function FechamentoFestaScreen() {
  const [festas, setFestas] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [drinks, setDrinks] = useState([]);
  const [insumos, setInsumos] = useState([]);
  
  const [selectedFestaId, setSelectedFestaId] = useState('');
  
  // Finance States
  const [receita, setReceita] = useState('');
  const [convidados, setConvidados] = useState('');
  const [transporte, setTransporte] = useState('');
  const [ajudante, setAjudante] = useState('');
  const [outros, setOutros] = useState('');
  
  // Perdas
  const [perdas, setPerdas] = useState([]);
  
  // Congelamento de Valores (Snapshot Contábil)
  const [forceRecalc, setForceRecalc] = useState(false);

  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const db = getDatabase(app);
  const isOffline = useNetworkStore(s => s.isOffline);

  useEffect(() => {
    const loadCache = async () => {
      const cachedFestas = await getCachedData(CACHE_KEYS.FESTAS, []);
      if (cachedFestas.length > 0) setFestas(cachedFestas);

      const cachedPedidos = await getCachedData(CACHE_KEYS.PEDIDOS, []);
      if (cachedPedidos.length > 0) setPedidos(cachedPedidos);

      const cachedDrinks = await getCachedData(CACHE_KEYS.DRINKS_CATALOG, []);
      if (cachedDrinks.length > 0) setDrinks(cachedDrinks);

      const cachedInsumos = await getCachedData(CACHE_KEYS.INSUMOS, []);
      if (cachedInsumos.length > 0) setInsumos(cachedInsumos);
    };
    loadCache();

    const fetchAll = () => {
      // Festas
      onValue(ref(db, 'festas'), (snap) => {
        if (snap.exists()) {
          const data = snap.val();
          const festasList = Object.keys(data).map(k => ({ id: k, ...data[k] })).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
          setFestas(festasList);
          cacheData(CACHE_KEYS.FESTAS, festasList);
        } else setFestas([]);
      });
      // Pedidos
      onValue(ref(db, 'pedidos'), (snap) => {
        if (snap.exists()) {
          const data = snap.val();
          const pedidosList = Object.keys(data).map(k => ({ id: k, ...data[k] }));
          setPedidos(pedidosList);
          cacheData(CACHE_KEYS.PEDIDOS, pedidosList);
        } else setPedidos([]);
      });
      // Drinks
      onValue(ref(db, 'drinks'), (snap) => {
        if (snap.exists()) {
          const data = snap.val();
          const drinksList = Object.keys(data).map(k => ({ id: k, ...data[k] }));
          setDrinks(drinksList);
          cacheData(CACHE_KEYS.DRINKS_CATALOG, drinksList);
        } else setDrinks([]);
      });
      // Insumos
      onValue(ref(db, 'insumos'), (snap) => {
        if (snap.exists()) {
          const data = snap.val();
          const insumosList = Object.keys(data).map(k => ({ id: k, ...data[k] }));
          setInsumos(insumosList);
          cacheData(CACHE_KEYS.INSUMOS, insumosList);
        } else setInsumos([]);
      });
    };
    fetchAll();
  }, []);

  // When a party is selected, load its saved closure data if it exists
  useEffect(() => {
    if (selectedFestaId) {
      const party = festas.find(f => f.id === selectedFestaId);
      if (party && party.fechamento) {
        setReceita(party.fechamento.receita?.toString() || '');
        setConvidados(party.fechamento.convidados?.toString() || '');
        setTransporte(party.fechamento.transporte?.toString() || '');
        setAjudante(party.fechamento.ajudante?.toString() || '');
        setOutros(party.fechamento.outros?.toString() || '');
        setPerdas(party.fechamento.perdas || []);
      } else {
        const precoPacote = party?.pacote?.valorPorConvidado || 0;
        const convidadosBase = party?.quantidadeConvidados || 0;
        const receitaSugerida = precoPacote * convidadosBase;

        setReceita(receitaSugerida > 0 ? receitaSugerida.toString() : '');
        setConvidados(convidadosBase > 0 ? convidadosBase.toString() : '');
        setTransporte('');
        setAjudante((party?.custoMaoDeObra || 350).toString());
        setOutros('');
        setPerdas([]);
      }
      setForceRecalc(false); // Reseta o destravamento
    }
  }, [selectedFestaId, festas]);

  // Calculations
  const calcString = (val) => {
    let clean = (val || '').toString().replace(/,/g, '.').replace(/[^0-9.]/g, '');
    return parseFloat(clean) || 0;
  };

  const activeOrders = pedidos.filter(p => (p.partyId === selectedFestaId || p.festaId === selectedFestaId) && p.status !== 'cancelado');
  const party = festas.find(f => f.id === selectedFestaId);
  const isFrozen = party?.fechamento?.custoBarHistorico !== undefined && !forceRecalc;

  // Custo Bar Padrão Dinâmico
  let dynamicTotalBar = 0;
  activeOrders.forEach(pedido => {
    if (pedido.drinks && Array.isArray(pedido.drinks)) {
      pedido.drinks.forEach(drink => {
         const drinkObj = drinks.find(d => d.name === drink.drinkName);
         if (drinkObj && drinkObj.fichaTecnica) {
           const drinkCost = drinkObj.fichaTecnica.reduce((dTotal, fItem) => {
             const insumoObj = insumos.find(ins => ins.id === fItem.insumoId);
             if (!insumoObj) return dTotal;
             return dTotal + (insumoObj.custoUnidadeMinima * (parseFloat(fItem.quantity) || 0));
           }, 0);
           dynamicTotalBar += (drinkCost * (parseFloat(drink.quantity) || 0));
         }
      });
    }
  });

  // Perdas Dinâmicas
  let dynamicTotalPerdas = perdas.reduce((tot, perda) => {
      const insumoObj = insumos.find(ins => ins.id === perda.insumoId);
      if(!insumoObj) return tot;
      return tot + ((insumoObj.custoUnidadeMinima || 0) * (parseFloat(perda.quantity) || 0));
  }, 0);

  // Decisão do valor (Snap Histórico ou Dinâmico)
  const totalBar = isFrozen ? party.fechamento.custoBarHistorico : dynamicTotalBar;
  
  // Se as perdas editadas na tela forem diferentes (length ou items) das do snapshot, considera como editado e usa dinâmico.
  const isPerdasEdited = JSON.stringify(perdas) !== JSON.stringify(party?.fechamento?.perdas || []);
  const totalPerdas = (isFrozen && !isPerdasEdited) 
      ? (party.fechamento.custoPerdasHistorico ?? dynamicTotalPerdas) 
      : dynamicTotalPerdas;

  const receitaNum = calcString(receita);
  const convidadosNum = calcString(convidados);
  const transporteNum = calcString(transporte);
  const ajudanteNum = calcString(ajudante);
  const outrosNum = calcString(outros);

  const custosLogistica = transporteNum + ajudanteNum + outrosNum;
  const custosTotaisOperacao = totalBar + totalPerdas + custosLogistica;
  const lucroLiquido = receitaNum - custosTotaisOperacao;

  // Ticket Medio metrics
  const custoPorConvidado = convidadosNum > 0 ? (custosTotaisOperacao / convidadosNum) : 0;
  const lucroPorConvidado = convidadosNum > 0 ? (lucroLiquido / convidadosNum) : 0;
  
  // Novas Métricas de Insights
  const margemContribuicao = receitaNum > 0 ? (lucroLiquido / receitaNum) * 100 : 0;
  const precoSugerido20 = convidadosNum > 0 ? (custosTotaisOperacao / 0.8) / convidadosNum : 0;

  // Calculo de Top 3 Drinks Mais Caros na Festa
  const topDrinksCost = {};
  activeOrders.forEach(pedido => {
    if (pedido.drinks && Array.isArray(pedido.drinks)) {
      pedido.drinks.forEach(drink => {
         const drinkObj = drinks.find(d => d.name === drink.drinkName);
         if (drinkObj && drinkObj.fichaTecnica) {
           const drinkCost = drinkObj.fichaTecnica.reduce((dTotal, fItem) => {
             const insumoObj = insumos.find(ins => ins.id === fItem.insumoId);
             if (!insumoObj) return dTotal;
             return dTotal + (insumoObj.custoUnidadeMinima * (parseFloat(fItem.quantity) || 0));
           }, 0);
           const totalDrinkCost = drinkCost * (parseFloat(drink.quantity) || 0);
           
           if (!topDrinksCost[drink.drinkName]) topDrinksCost[drink.drinkName] = 0;
           topDrinksCost[drink.drinkName] += totalDrinkCost;
         }
      });
    }
  });

  const top3DrinksArr = Object.entries(topDrinksCost)
    .map(([name, cost]) => ({ name, cost }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 3);


  const handleSave = async () => {
    if (isOffline) {
      if (Platform.OS === 'web') window.alert("Operação bloqueada, você está sem conexão!");
      else Alert.alert('Aviso', 'Não é possível gravar fechamento sem internet.');
      return;
    }

    if (!selectedFestaId) {
      Alert.alert('Erro', 'Selecione uma festa primeiro.');
      return;
    }
    setSaving(true);
    try {
      const fechamento = {
        receita: receitaNum,
        convidados: convidadosNum,
        transporte: transporteNum,
        ajudante: ajudanteNum,
        outros: outrosNum,
        perdas: perdas,
        lucroLiquidoConsolidado: lucroLiquido,
        // Custo Histórico Salvo Fixo:
        custoBarHistorico: totalBar,
        custoPerdasHistorico: totalPerdas,
        timestampAtualizacao: new Date().toISOString()
      };
      
      await update(ref(db, `festas/${selectedFestaId}`), { fechamento });
      setForceRecalc(false);
      Alert.alert('Fechamento Snapshot', 'Dados financeiros foram selados e gravados com sucesso!');
    } catch (error) {
      Alert.alert('Erro', 'Ocorreu um problema ao salvar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const inputGroup = (label, value, setter, icon, placeholder, isCurrency = true) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: '#707b55', fontSize: 13, fontWeight: '600', marginBottom: 6, marginLeft: 4, textTransform: 'uppercase' }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1.5, borderColor: '#c8cac6', opacity: isOffline ? 0.6 : 1 }}>
        <Ionicons name={icon} size={18} color="#cc9e6f" style={{ marginRight: 10 }} />
        {isCurrency && <Text style={{ color: '#cc9e6f', fontSize: 15, fontWeight: '700', marginRight: 8 }}>R$</Text>}
        <TextInput
          value={value}
          onChangeText={setter}
          placeholder={placeholder}
          keyboardType="numeric"
          placeholderTextColor="#a0a29f"
          editable={!isOffline}
          style={{ flex: 1, color: '#1c1f0f', fontSize: 15, fontWeight: '600' }}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0EA' }}>
      <OfflineBanner />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        
        {/* Header */}
        <Animated.View entering={FadeInUp.duration(500)} style={{ paddingHorizontal: 20, marginTop: 12, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#c8cac6' }}>
              <Ionicons name="arrow-back" size={22} color="#1c1f0f" />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="bar-chart" size={24} color="#cc9e6f" />
              <Text style={{ color: '#1c1f0f', fontSize: 20, fontWeight: '700' }}>Fechamento</Text>
            </View>
            <View style={{ width: 42 }} />
          </View>
        </Animated.View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          
          {/* Party Selector */}
          <Animated.View entering={FadeInUp.duration(500).delay(100)}>
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1.5, borderColor: '#c8cac6', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 }}>
              <Text style={{ color: '#1c1f0f', fontSize: 14, fontWeight: '700', marginBottom: 8 }}>Selecionar Evento</Text>
              <View style={{ backgroundColor: 'rgba(204, 158, 111, 0.1)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(204, 158, 111, 0.3)' }}>
                <Picker
                  selectedValue={selectedFestaId}
                  onValueChange={setSelectedFestaId}
                  style={{ color: '#1c1f0f' }}
                  dropdownIconColor="#cc9e6f"
                >
                  <Picker.Item label="Escolha a Festa..." value="" enabled={false} />
                  {festas.map(f => (
                    <Picker.Item key={f.id} label={`${f.nome} (${f.data})`} value={f.id} />
                  ))}
                </Picker>
              </View>
              {isOffline && <Text style={{ color: '#707b55', fontSize: 12, marginTop: 8, fontStyle: 'italic' }}>*Somente festas gravadas no cache.</Text>}
            </View>
          </Animated.View>

          {selectedFestaId ? (
            <Animated.View entering={FadeInUp.duration(500).delay(200)}>
              
              {/* Resumo Insumos */}
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#e8e4de' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="wine-outline" size={20} color="#78a764" style={{ marginRight: 8 }} />
                    <Text style={{ color: '#1c1f0f', fontSize: 16, fontWeight: '700' }}>Custo Padrão do Bar</Text>
                  </View>
                  {isFrozen && !isOffline && (
                    <TouchableOpacity onPress={() => setForceRecalc(true)} style={{ backgroundColor: 'rgba(204, 158, 111, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="refresh" size={14} color="#cc9e6f" />
                      <Text style={{ color: '#cc9e6f', fontSize: 11, fontWeight: '700' }}>Atualizar</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {!isFrozen && party?.fechamento?.custoBarHistorico !== undefined && (
                   <Text style={{ color: '#cc9e6f', fontSize: 12, marginBottom: 4, fontStyle: 'italic' }}>⚠️ Valores atuais recalibrados por inflação ou novos pedidos.</Text>
                )}
                <Text style={{ color: '#707b55', fontSize: 13, marginBottom: 8 }}>{isFrozen ? 'Valor do painel fixado no dia do fechamento.' : `Baseado em ${activeOrders.length} pedidos da noite.`}</Text>
                <Text style={{ color: '#78a764', fontSize: 24, fontWeight: '800' }}>{formatCurrency(totalBar)}</Text>
              </View>

              {/* Formulário Administrativo */}
              <View style={{ backgroundColor: 'rgba(28, 31, 15, 0.04)', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#e8e4de' }}>
                <Text style={{ color: '#1c1f0f', fontSize: 16, fontWeight: '700', marginBottom: 16 }}>Contrato e Receita (Entrada)</Text>
                {inputGroup('Receita Bruta Cobrada', receita, setReceita, 'cash-outline', 'Ex: 3500')}
                {inputGroup('Qtd Convidados Reais', convidados, (text) => {
                  setConvidados(text);
                  const numConv = parseFloat(text) || 0;
                  const preco = party?.pacote?.valorPorConvidado || 0;
                  if (preco > 0 && !party?.fechamento && !forceRecalc) {
                    setReceita((numConv * preco).toString());
                  }
                }, 'people-outline', 'Cabeças presentes', false)}

                <View style={{ height: 1, backgroundColor: '#c8cac6', marginVertical: 10 }} />

                <Text style={{ color: '#1c1f0f', fontSize: 16, fontWeight: '700', marginBottom: 16, marginTop: 8 }}>Custos Logísticos</Text>
                {inputGroup('Transporte / Van', transporte, setTransporte, 'car-outline', 'Custos de viagem')}
                {inputGroup('Staff e Ajudantes', ajudante, setAjudante, 'hand-left-outline', 'Comissões da noite')}
                {inputGroup('Outros Diversos', outros, setOutros, 'options-outline', 'Imprevistos')}
              </View>

              {/* Perdas Operacionais */}
              <View style={{ backgroundColor: 'rgba(200, 60, 60, 0.05)', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(200, 60, 60, 0.2)' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="warning-outline" size={20} color="#c83c3c" style={{ marginRight: 8 }} />
                    <Text style={{ color: '#c83c3c', fontSize: 16, fontWeight: '700' }}>Perdas e Quebras</Text>
                  </View>
                  {!isOffline && (
                    <TouchableOpacity
                      onPress={() => setPerdas([...perdas, { insumoId: '', quantity: '', unit: 'ml' }])}
                      style={{ backgroundColor: 'rgba(200, 60, 60, 0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
                    >
                      <Text style={{ color: '#c83c3c', fontSize: 12, fontWeight: '700' }}>+ Perda</Text>
                    </TouchableOpacity>
                  )}
                </View>
                
                {perdas.map((item, index) => (
                  <View key={index} style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                    <View style={{ flex: 2, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#e8e4de', justifyContent: 'center', opacity: isOffline ? 0.6 : 1 }}>
                      <Picker
                        selectedValue={item.insumoId || ''}
                        enabled={!isOffline}
                        onValueChange={(val) => {
                          const newPerdas = [...perdas];
                          newPerdas[index].insumoId = val;
                          const chosen = insumos.find(i => i.id === val);
                          if (chosen) newPerdas[index].unit = chosen.unidade;
                          setPerdas(newPerdas);
                        }}
                        style={{ color: '#1c1f0f', transform: [{ scale: 0.85 }], height: 44 }}
                      >
                        <Picker.Item label="O que quebrou?" value="" enabled={false} color="#a0a29f" />
                        {insumos.map(ins => <Picker.Item key={ins.id} label={ins.nome} value={ins.id} />)}
                      </Picker>
                    </View>
                    <TextInput
                      value={item.quantity}
                      editable={!isOffline}
                      onChangeText={(text) => {
                        const newP = [...perdas];
                        newP[index].quantity = text;
                        setPerdas(newP);
                      }}
                      placeholder="Qtd"
                      keyboardType="numeric"
                      style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e8e4de', color: '#1c1f0f', fontSize: 14, opacity: isOffline ? 0.6 : 1 }}
                    />
                    <View style={{ flex: 1, backgroundColor: '#F5F0EA', borderRadius: 10, borderWidth: 1, borderColor: '#e8e4de', justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: '#a0a29f', fontSize: 13, fontWeight: '600' }}>{item.unit || '-'}</Text>
                    </View>
                    {!isOffline && (
                      <TouchableOpacity
                        onPress={() => {
                          const newP = [...perdas];
                          newP.splice(index, 1);
                          setPerdas(newP);
                        }}
                        style={{ backgroundColor: 'rgba(200, 60, 60, 0.1)', borderRadius: 10, padding: 12, justifyContent: 'center', alignItems: 'center' }}
                      >
                        <Ionicons name="trash-outline" size={18} color="#c83c3c" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                {perdas.length > 0 && (
                  <Text style={{ color: '#c83c3c', fontSize: 13, fontWeight: '600', alignSelf: 'flex-end', marginTop: 4 }}>
                    Total Perda: {formatCurrency(totalPerdas)}
                  </Text>
                )}
                {perdas.length === 0 && (
                  <Text style={{ color: 'rgba(200, 60, 60, 0.6)', fontSize: 13 }}>Nenhuma quebra registrada. Parabéns!</Text>
                )}
              </View>

              {/* MEGA TOTALIZER */}
              <View style={{ backgroundColor: '#1c1f0f', borderRadius: 20, padding: 24, marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 }}>
                 <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ color: '#c8cac6', fontSize: 14 }}>(+) Receita Bruta:</Text>
                    <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}>{formatCurrency(receitaNum)}</Text>
                 </View>
                 <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ color: '#c8cac6', fontSize: 14 }}>(-) Custo Bar & Logística:</Text>
                    <Text style={{ color: '#cc9e6f', fontSize: 14, fontWeight: '600' }}>- {formatCurrency(totalBar + custosLogistica)}</Text>
                 </View>
                 <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                    <Text style={{ color: '#c8cac6', fontSize: 14 }}>(-) Perdas Registradas:</Text>
                    <Text style={{ color: '#c83c3c', fontSize: 14, fontWeight: '600' }}>- {formatCurrency(totalPerdas)}</Text>
                 </View>
                 
                 <View style={{ height: 1, backgroundColor: 'rgba(255, 255, 255, 0.15)', marginBottom: 16 }} />
                 
                 <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>LUCRO LÍQUIDO:</Text>
                    <View style={{ alignItems: 'flex-end' }}>
                       <Text style={{ color: lucroLiquido >= 0 ? '#78a764' : '#c83c3c', fontSize: 26, fontWeight: '800' }}>
                         {formatCurrency(lucroLiquido)}
                       </Text>
                       <Text style={{ color: margemContribuicao >= 0 ? '#78a764' : '#c83c3c', fontSize: 13, fontWeight: '700' }}>
                         {margemContribuicao.toFixed(1)}% de Margem
                       </Text>
                    </View>
                 </View>
                 <View style={{ alignSelf: 'flex-end', backgroundColor: 'rgba(255, 255, 255, 0.1)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}>
                    <Text style={{ color: '#cc9e6f', fontSize: 12, fontWeight: '700' }}>MÉDIA: {formatCurrency(lucroPorConvidado)} lucro / conv.</Text>
                 </View>
                 <View style={{ alignSelf: 'flex-end', marginTop: 4 }}>
                    <Text style={{ color: '#c8cac6', fontSize: 11 }}>Custo da operação: {formatCurrency(custoPorConvidado)} / conv.</Text>
                 </View>

                 {/* Insights Estratégicos Section */}
                 <View style={{ marginTop: 20, backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                       <Ionicons name="bulb-outline" size={18} color="#eab308" style={{ marginRight: 6 }} />
                       <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>Insights Estratégicos</Text>
                    </View>
                    
                    <View style={{ marginBottom: 12 }}>
                       <Text style={{ color: '#c8cac6', fontSize: 12, marginBottom: 4 }}>Preço Sugerido / Conv. (Para 20% Lucro exato):</Text>
                       <Text style={{ color: '#eab308', fontSize: 16, fontWeight: '700' }}>{formatCurrency(precoSugerido20)}</Text>
                    </View>

                    {top3DrinksArr.length > 0 && (
                      <View>
                        <Text style={{ color: '#c8cac6', fontSize: 12, marginBottom: 6 }}>Top 3 Drinks Mais Caros p/ o Bar:</Text>
                        {top3DrinksArr.map((d, i) => (
                           <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                              <Text style={{ color: '#FFFFFF', fontSize: 13 }}>{i+1}. {d.name}</Text>
                              <Text style={{ color: '#cc9e6f', fontSize: 13, fontWeight: '600' }}>{formatCurrency(d.cost)}</Text>
                           </View>
                        ))}
                      </View>
                    )}
                 </View>

                 {/* Save Button */}
                 <TouchableOpacity
                    onPress={handleSave}
                    disabled={saving || isOffline}
                    activeOpacity={0.8}
                    style={{ backgroundColor: isOffline ? '#8A8C86' : '#cc9e6f', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 14, borderRadius: 12, marginTop: 24, opacity: isOffline ? 0.5 : 1 }}
                 >
                    {saving ? <ActivityIndicator color="#1c1f0f" /> : <Ionicons name={isOffline ? "cloud-offline" : "checkmark-done"} size={20} color="#1c1f0f" style={{ marginRight: 8 }} />}
                    <Text style={{ color: '#1c1f0f', fontSize: 16, fontWeight: '800' }}>{isOffline ? 'MODO SOMENTE LEITURA' : 'GRAVAR FECHAMENTO'}</Text>
                 </TouchableOpacity>
              </View>

            </Animated.View>
          ) : (
            <Animated.View entering={FadeInUp.duration(500).delay(200)} style={{ alignItems: 'center', marginTop: 40, opacity: 0.5 }}>
               <Ionicons name="bar-chart-outline" size={64} color="#cc9e6f" />
               <Text style={{ color: '#707b55', fontSize: 15, marginTop: 12, textAlign: 'center' }}>Selecione um evento acima para carregar as métricas financeiras.</Text>
            </Animated.View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
