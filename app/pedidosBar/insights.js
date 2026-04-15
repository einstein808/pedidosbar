import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, Modal } from 'react-native';
import { LineChart, PieChart, StackedBarChart } from 'react-native-chart-kit';
import { getDatabase, ref, onValue } from 'firebase/database';
import { app } from '../src/config/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import '../../global.css';

const { width } = Dimensions.get('window');

export default function InsightsScreen() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [ruaMetrics, setRuaMetrics] = useState(null);
  const [selectedPartyDetail, setSelectedPartyDetail] = useState(null);
  const [activeTab, setActiveTab] = useState('eventos');
  const router = useRouter();
  const db = getDatabase(app);

  useEffect(() => {
    let rawFestas = [];
    let rawPedidos = [];
    let rawInsumos = [];
    let festasLoaded = false;
    let pedidosLoaded = false;
    let insumosLoaded = false;

    const processMetrics = () => {
      if (!festasLoaded || !pedidosLoaded || !insumosLoaded) return;

      const closedParties = rawFestas.filter(f => f.fechamento && f.tipoFesta !== 'Venda de Rua');
      const closedRuaParties = rawFestas.filter(f => f.fechamento && f.tipoFesta === 'Venda de Rua');

      let totalReceita = 0;
      let totalLucro = 0;
      let totalConvidados = 0;
      let totalPerdasReal = 0;

      let totalTransporte = 0;
      let totalAjudante = 0;
      let totalOutrosCustos = 0;
      let totalCustoBar = 0;
      let totalCustoPerdas = 0;

      let partyStats = {};

      closedParties.forEach(party => {
        const fech = party.fechamento;
        const rec = parseFloat(fech.receita) || 0;
        const luc = parseFloat(fech.lucroLiquidoConsolidado) || 0;
        const conv = parseFloat(fech.convidados) || 0;
        
        totalReceita += rec;
        totalLucro += luc;
        totalConvidados += conv;

        totalTransporte += parseFloat(fech.transporte) || 0;
        totalAjudante += parseFloat(fech.ajudante) || 0;
        totalOutrosCustos += parseFloat(fech.outros) || 0;
        totalCustoBar += parseFloat(fech.custoBarHistorico) || 0;
        totalCustoPerdas += parseFloat(fech.custoPerdasHistorico) || 0;

        let custOpe = rec - luc;
        let pData = party.criadaEm ? new Date(party.criadaEm) : new Date('2023-01-01');

        partyStats[party.id] = {
           id: party.id,
           nome: party.nomeFesta || party.nomeCliente || party.nome || 'Festa',
           tipoFesta: party.tipoFesta || 'Outros',
           data: pData,
           receita: rec,
           lucro: luc,
           convidados: conv,
           custo: custOpe,
           custoPorConvidado: conv > 0 ? (custOpe / conv) : 0,
           margem: rec > 0 ? (luc / rec) * 100 : 0,
           totalDrinks: 0
        };

        if (fech.perdas && Array.isArray(fech.perdas)) {
          fech.perdas.forEach(perda => {
            const ins_ = rawInsumos.find(i => i.id === perda.insumoId);
            if (ins_) {
              totalPerdasReal += (ins_.custoUnidadeMinima * (parseFloat(perda.quantity) || 0));
            }
          });
        }
      });

      const margemLucro = totalReceita > 0 ? (totalLucro / totalReceita) * 100 : 0;
      const custoOperacaoGlobal = totalReceita - totalLucro;
      const custoPorConvidado = totalConvidados > 0 ? (custoOperacaoGlobal / totalConvidados) : 0;
      
      const lucroMedioPorEvento = closedParties.length > 0 ? (totalLucro / closedParties.length) : 0;
      const custoMedioPorEvento = closedParties.length > 0 ? (custoOperacaoGlobal / closedParties.length) : 0;

      const closedPartyIds = closedParties.map(p => p.id);
      const relevantPedidos = rawPedidos.filter(p => 
         (closedPartyIds.includes(p.partyId) || closedPartyIds.includes(p.festaId)) && 
         p.status !== 'cancelado'
      );

      let drinkCounts = {};
      let totalDrinksServidos = 0;

      relevantPedidos.forEach(pedido => {
        const pid = pedido.partyId || pedido.festaId;
        if (pedido.drinks && Array.isArray(pedido.drinks)) {
          pedido.drinks.forEach(drink => {
             const qty = parseFloat(drink.quantity) || 0;
             totalDrinksServidos += qty;
             
             if (partyStats[pid]) {
                partyStats[pid].totalDrinks += qty;
             }

             const name = drink.drinkName || 'Desconhecido';
             drinkCounts[name] = (drinkCounts[name] || 0) + qty;
          });
        }
      });

      const partyStatsArray = Object.values(partyStats).map(p => ({
         ...p,
         drinksPorConvidado: p.convidados > 0 ? (p.totalDrinks / p.convidados) : 0
      }));

      const topFestasDrinks = [...partyStatsArray]
         .sort((a, b) => b.drinksPorConvidado - a.drinksPorConvidado)
         .slice(0, 3);
      
      const topFestasCusto = [...partyStatsArray]
         .sort((a, b) => b.custoPorConvidado - a.custoPorConvidado)
         .slice(0, 3);

      const timelineStats = [...partyStatsArray].sort((a, b) => a.data - b.data);

      const mediaDrinksPorConvidado = totalConvidados > 0 ? (totalDrinksServidos / totalConvidados) : 0;

      const topDrinks = Object.entries(drinkCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(arr => ({ name: arr[0], count: arr[1] }));

      let categoryStats = {};
      partyStatsArray.forEach(p => {
         const cat = p.tipoFesta || 'Outros';
         if (!categoryStats[cat]) {
            categoryStats[cat] = { tipo: cat, lucroTotal: 0, receitaTotal: 0, convidadosTotal: 0, custoTotal: 0, eventosCount: 0 };
         }
         categoryStats[cat].lucroTotal += p.lucro;
         categoryStats[cat].receitaTotal += p.receita;
         categoryStats[cat].convidadosTotal += p.convidados;
         categoryStats[cat].custoTotal += p.custo;
         categoryStats[cat].eventosCount += 1;
      });

      const categoriasRentaveis = Object.values(categoryStats).map(c => ({
         ...c,
         lucroMedioPorEvento: c.eventosCount > 0 ? (c.lucroTotal / c.eventosCount) : 0,
         margemMedia: c.receitaTotal > 0 ? (c.lucroTotal / c.receitaTotal) * 100 : 0
      })).sort((a, b) => b.lucroMedioPorEvento - a.lucroMedioPorEvento);

      const totalCostsIdentified = totalTransporte + totalAjudante + totalOutrosCustos + totalCustoBar + totalCustoPerdas;
      const unmappedCost = custoOperacaoGlobal - totalCostsIdentified;
      
      const pieData = [
         { name: 'Bebidas/Bar', population: totalCustoBar, color: '#eab308', legendFontColor: '#c8cac6', legendFontSize: 12 },
         { name: 'Logística', population: totalTransporte, color: '#3b82f6', legendFontColor: '#c8cac6', legendFontSize: 12 },
         { name: 'Staff/Mão Obra', population: totalAjudante, color: '#a855f7', legendFontColor: '#c8cac6', legendFontSize: 12 },
         { name: 'Quebras', population: totalCustoPerdas, color: '#dc2626', legendFontColor: '#c8cac6', legendFontSize: 12 },
         { name: 'Diversos', population: totalOutrosCustos, color: '#f97316', legendFontColor: '#c8cac6', legendFontSize: 12 },
      ];
      if (unmappedCost > 1) {
         pieData.push({ name: 'Legados Mapeados', population: unmappedCost, color: '#64748b', legendFontColor: '#c8cac6', legendFontSize: 12 });
      }

      setMetrics({
        eventosFechados: closedParties.length,
        totalReceita,
        totalLucro,
        margemLucro,
        custoPorConvidado,
        mediaDrinksPorConvidado,
        topDrinks,
        totalPerdasReal,
        lucroMedioPorEvento,
        custoMedioPorEvento,
        totalConvidados,
        totalDrinksServidos,
        topFestasDrinks,
        topFestasCusto,
        timelineStats,
        categoriasRentaveis,
        pieData: pieData.filter(d => d.population > 0).sort((a,b) => b.population - a.population),
        custoOperacaoGlobal
      });

      // === STREET SALES METRICS ===
      let ruaTotalReceita = 0;
      let ruaTotalLucro = 0;
      let ruaTotalPedidos = 0;
      let ruaDrinkCounts = {};
      let ruaHoraMap = {};
      let ruaPartyStats = [];

      closedRuaParties.forEach(party => {
        const fech = party.fechamento;
        const rec = parseFloat(fech.receita) || 0;
        const luc = parseFloat(fech.lucroLiquidoConsolidado) || 0;
        const pedidosCount = parseFloat(fech.totalPedidosRua) || 0;
        ruaTotalReceita += rec;
        ruaTotalLucro += luc;
        ruaTotalPedidos += pedidosCount;

        ruaPartyStats.push({
          id: party.id,
          nome: party.nome || 'Venda Rua',
          data: party.data || party.timestamp,
          receita: rec,
          lucro: luc,
          pedidos: pedidosCount,
          ticketMedio: pedidosCount > 0 ? rec / pedidosCount : 0,
          margem: rec > 0 ? (luc / rec) * 100 : 0,
        });
      });

      // Drinks & hour data from orders linked to rua parties
      const ruaPartyIds = closedRuaParties.map(p => p.id);
      const ruaPedidos = rawPedidos.filter(p =>
        (ruaPartyIds.includes(p.partyId) || ruaPartyIds.includes(p.festaId)) &&
        p.status !== 'cancelado'
      );

      ruaPedidos.forEach(pedido => {
        // Hour tracking
        const ts = pedido.timestamp || pedido.createdAt;
        if (ts) {
          const hour = new Date(ts).getHours();
          ruaHoraMap[hour] = (ruaHoraMap[hour] || 0) + 1;
        }
        // Drink tracking
        if (pedido.drinks && Array.isArray(pedido.drinks)) {
          pedido.drinks.forEach(drink => {
            const name = drink.drinkName || 'Desconhecido';
            const qty = parseFloat(drink.quantity) || 0;
            ruaDrinkCounts[name] = (ruaDrinkCounts[name] || 0) + qty;
          });
        }
      });

      const ruaTopDrinks = Object.entries(ruaDrinkCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      const ruaHoraPico = Object.entries(ruaHoraMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([hour, count]) => ({ hour: parseInt(hour), count }));

      const ruaMargemMedia = ruaTotalReceita > 0 ? (ruaTotalLucro / ruaTotalReceita) * 100 : 0;
      const ruaTicketMedioGlobal = ruaTotalPedidos > 0 ? ruaTotalReceita / ruaTotalPedidos : 0;

      const ruaTopEventos = [...ruaPartyStats].sort((a, b) => b.receita - a.receita).slice(0, 5);

      setRuaMetrics({
        eventosFechados: closedRuaParties.length,
        totalReceita: ruaTotalReceita,
        totalLucro: ruaTotalLucro,
        totalPedidos: ruaTotalPedidos,
        ticketMedioGlobal: ruaTicketMedioGlobal,
        margemMedia: ruaMargemMedia,
        topDrinks: ruaTopDrinks,
        horaPico: ruaHoraPico,
        topEventos: ruaTopEventos,
      });

      setLoading(false);
    };

    const unsubFestas = onValue(ref(db, 'festas'), snap => {
      if (snap.exists()) {
        const data = snap.val();
        rawFestas = Object.keys(data).map(k => ({ id: k, ...data[k] }));
      } else rawFestas = [];
      festasLoaded = true;
      processMetrics();
    });

    const unsubPedidos = onValue(ref(db, 'pedidos'), snap => {
      if (snap.exists()) {
        const data = snap.val();
        rawPedidos = Object.keys(data).map(k => ({ id: k, ...data[k] }));
      } else rawPedidos = [];
      pedidosLoaded = true;
      processMetrics();
    });

    const unsubInsumos = onValue(ref(db, 'insumos'), snap => {
      if (snap.exists()) {
        const data = snap.val();
        rawInsumos = Object.keys(data).map(k => ({ id: k, ...data[k] }));
      } else rawInsumos = [];
      insumosLoaded = true;
      processMetrics();
    });

    return () => {
      unsubFestas();
      unsubPedidos();
      unsubInsumos();
    };
  }, []);

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  const formatNum = (val, dec = 1) => Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: dec });
  const formatData = (data) => {
    if (!data) return '';
    const d = new Date(data);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  };

  if (loading || !metrics) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#1c1f0f', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#cc9e6f" size="large" />
        <Text style={{ color: '#cc9e6f', marginTop: 12, fontWeight: '600' }}>Processando Inteligência...</Text>
      </SafeAreaView>
    );
  }

  if ((activeTab === 'eventos' && metrics.eventosFechados === 0) || (activeTab === 'rua' && (!ruaMetrics || ruaMetrics.eventosFechados === 0))) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0EA' }}>
        <View style={{ padding: 20 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: '#FFFFFF', alignSelf: 'flex-start', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#c8cac6', marginBottom: 20 }}>
            <Ionicons name="arrow-back" size={22} color="#1c1f0f" />
          </TouchableOpacity>
          {/* Tab Switcher */}
          <View style={{ flexDirection: 'row', backgroundColor: '#e8e4de', borderRadius: 14, padding: 4, marginBottom: 20 }}>
            <TouchableOpacity onPress={() => setActiveTab('eventos')} style={{ flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: activeTab === 'eventos' ? '#FFFFFF' : 'transparent', alignItems: 'center' }}>
              <Text style={{ color: activeTab === 'eventos' ? '#1c1f0f' : '#707b55', fontWeight: activeTab === 'eventos' ? '700' : '500', fontSize: 14 }}>🎉 Eventos</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setActiveTab('rua')} style={{ flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: activeTab === 'rua' ? '#FFFFFF' : 'transparent', alignItems: 'center' }}>
              <Text style={{ color: activeTab === 'rua' ? '#1c1f0f' : '#707b55', fontWeight: activeTab === 'rua' ? '700' : '500', fontSize: 14 }}>🛒 Venda de Rua</Text>
            </TouchableOpacity>
          </View>
          <View style={{ alignItems: 'center', marginTop: 40, opacity: 0.6 }}>
            <Ionicons name="pie-chart-outline" size={64} color="#cc9e6f" />
            <Text style={{ color: '#1c1f0f', fontSize: 18, fontWeight: '700', marginTop: 16 }}>Nenhum Dado Consolidado</Text>
            <Text style={{ color: '#707b55', fontSize: 14, textAlign: 'center', marginTop: 8 }}>
              Você precisa realizar o 'Fechamento de Evento' de pelo menos um {activeTab === 'rua' ? 'evento de venda de rua' : 'evento'} para gerar relatórios.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0EA' }}>
      
      {/* Tab Switcher */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 1, borderColor: '#e8e4de', backgroundColor: '#FFFFFF', zIndex: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: '#F5F0EA', borderRadius: 12, padding: 10 }}>
            <Ionicons name="arrow-back" size={22} color="#1c1f0f" />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="trending-up" size={24} color="#78a764" />
            <Text style={{ color: '#1c1f0f', fontSize: 20, fontWeight: '800' }}>Insights</Text>
          </View>
          <View style={{ width: 42 }} />
        </View>
        <View style={{ flexDirection: 'row', backgroundColor: '#e8e4de', borderRadius: 14, padding: 4 }}>
          <TouchableOpacity onPress={() => setActiveTab('eventos')} style={{ flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: activeTab === 'eventos' ? '#FFFFFF' : 'transparent', alignItems: 'center', shadowColor: activeTab === 'eventos' ? '#000' : 'transparent', shadowOpacity: 0.08, shadowRadius: 4, elevation: activeTab === 'eventos' ? 2 : 0 }}>
            <Text style={{ color: activeTab === 'eventos' ? '#1c1f0f' : '#707b55', fontWeight: activeTab === 'eventos' ? '800' : '500', fontSize: 14 }}>🎉 Eventos</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab('rua')} style={{ flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: activeTab === 'rua' ? '#FFFFFF' : 'transparent', alignItems: 'center', shadowColor: activeTab === 'rua' ? '#000' : 'transparent', shadowOpacity: 0.08, shadowRadius: 4, elevation: activeTab === 'rua' ? 2 : 0 }}>
            <Text style={{ color: activeTab === 'rua' ? '#1c1f0f' : '#707b55', fontWeight: activeTab === 'rua' ? '800' : '500', fontSize: 14 }}>🛒 Venda de Rua</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }}>

        {activeTab === 'rua' && ruaMetrics ? (
          <>
            {/* BARÔMETRO RUA */}
            <Animated.View entering={FadeInUp.duration(500)}>
              <View style={{ backgroundColor: '#1c1f0f', borderRadius: 24, padding: 24, marginBottom: 20, shadowColor: '#1c1f0f', shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                  <Ionicons name="storefront-outline" size={18} color="#cc9e6f" />
                  <Text style={{ color: '#cc9e6f', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>Venda de Rua</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
                  <View>
                    <Text style={{ color: '#c8cac6', fontSize: 13, marginBottom: 4 }}>Lucro Total de Rua</Text>
                    <Text style={{ color: '#78a764', fontSize: 28, fontWeight: '800' }}>{formatCurrency(ruaMetrics.totalLucro)}</Text>
                  </View>
                  <View style={{ backgroundColor: 'rgba(120, 167, 100, 0.15)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 }}>
                    <Text style={{ color: '#78a764', fontSize: 16, fontWeight: '800' }}>+{formatNum(ruaMetrics.margemMedia)}%</Text>
                  </View>
                </View>
                <View style={{ height: 1, backgroundColor: 'rgba(255, 255, 255, 0.1)', marginBottom: 16 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ color: '#c8cac6', fontSize: 12 }}>Receita Total</Text>
                    <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>{formatCurrency(ruaMetrics.totalReceita)}</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: '#c8cac6', fontSize: 12 }}>Pedidos</Text>
                    <Text style={{ color: '#cc9e6f', fontSize: 16, fontWeight: '600' }}>{ruaMetrics.totalPedidos}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: '#c8cac6', fontSize: 12 }}>Eventos</Text>
                    <Text style={{ color: '#cc9e6f', fontSize: 16, fontWeight: '600' }}>{ruaMetrics.eventosFechados}</Text>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* TICKET MÉDIO + MARGEM */}
            <View style={{ flexDirection: 'row', gap: 14, marginBottom: 20 }}>
              <Animated.View entering={FadeInUp.duration(500).delay(100)} style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1.5, borderColor: '#c8cac6' }}>
                <Ionicons name="pricetag-outline" size={24} color="#cc9e6f" style={{ marginBottom: 8 }} />
                <Text style={{ color: '#1c1f0f', fontSize: 24, fontWeight: '800' }}>{formatCurrency(ruaMetrics.ticketMedioGlobal)}</Text>
                <Text style={{ color: '#707b55', fontSize: 13, fontWeight: '600', marginTop: 4 }}>Ticket Médio{'\n'}por Pedido</Text>
              </Animated.View>
              <Animated.View entering={FadeInUp.duration(500).delay(200)} style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1.5, borderColor: '#c8cac6' }}>
                <Ionicons name="trending-up" size={24} color="#78a764" style={{ marginBottom: 8 }} />
                <Text style={{ color: '#1c1f0f', fontSize: 24, fontWeight: '800' }}>{formatNum(ruaMetrics.margemMedia)}%</Text>
                <Text style={{ color: '#707b55', fontSize: 13, fontWeight: '600', marginTop: 4 }}>Margem Média{'\n'}de Lucro</Text>
              </Animated.View>
            </View>

            {/* TOP DRINKS DE RUA */}
            <Animated.View entering={FadeInUp.duration(500).delay(250)}>
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1.5, borderColor: '#c8cac6' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <Ionicons name="trophy" size={20} color="#e5a93d" />
                  <Text style={{ color: '#1c1f0f', fontSize: 16, fontWeight: '800' }}>Drinks Mais Vendidos (Rua)</Text>
                </View>
                {ruaMetrics.topDrinks.length > 0 ? (
                  ruaMetrics.topDrinks.map((drink, index) => (
                    <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: index === ruaMetrics.topDrinks.length -1 ? 0 : 14 }}>
                      <View style={{ width: 28, height: 28, backgroundColor: index === 0 ? '#e5a93d' : (index === 1 ? '#c0c0c0' : '#cd7f32'), borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                        <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>{index + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#1c1f0f', fontSize: 16, fontWeight: '700' }}>{drink.name}</Text>
                        <View style={{ width: '100%', height: 4, backgroundColor: '#F5F0EA', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                          <View style={{ width: `${Math.min((drink.count / ruaMetrics.topDrinks[0].count) * 100, 100)}%`, height: '100%', backgroundColor: index === 0 ? '#e5a93d' : '#888' }} />
                        </View>
                      </View>
                      <Text style={{ color: '#707b55', fontSize: 15, fontWeight: '700', marginLeft: 16 }}>{drink.count} un</Text>
                    </View>
                  ))
                ) : (
                  <Text style={{ color: '#707b55', fontStyle: 'italic' }}>Nenhuma venda registrada.</Text>
                )}
              </View>
            </Animated.View>

            {/* HORÁRIO PICO */}
            <Animated.View entering={FadeInUp.duration(500).delay(300)}>
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1.5, borderColor: '#c8cac6' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <Ionicons name="time-outline" size={20} color="#3b82f6" />
                  <Text style={{ color: '#1c1f0f', fontSize: 16, fontWeight: '800' }}>Horários de Pico</Text>
                </View>
                <Text style={{ color: '#707b55', fontSize: 12, marginBottom: 16 }}>Horários com mais pedidos registrados nas vendas de rua.</Text>
                {ruaMetrics.horaPico.length > 0 ? (
                  ruaMetrics.horaPico.map((h, index) => (
                    <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: index === ruaMetrics.horaPico.length -1 ? 0 : 12 }}>
                      <View style={{ width: 56, height: 36, backgroundColor: index === 0 ? '#3b82f6' : 'rgba(59, 130, 246, 0.12)', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                        <Text style={{ color: index === 0 ? '#FFF' : '#3b82f6', fontWeight: '800', fontSize: 15 }}>{h.hour}h</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ height: 8, backgroundColor: '#F5F0EA', borderRadius: 4, overflow: 'hidden' }}>
                          <View style={{ width: `${Math.min((h.count / ruaMetrics.horaPico[0].count) * 100, 100)}%`, height: '100%', backgroundColor: index === 0 ? '#3b82f6' : 'rgba(59, 130, 246, 0.4)', borderRadius: 4 }} />
                        </View>
                      </View>
                      <Text style={{ color: '#1c1f0f', fontSize: 14, fontWeight: '700', marginLeft: 14, width: 60, textAlign: 'right' }}>{h.count} ped.</Text>
                    </View>
                  ))
                ) : (
                  <Text style={{ color: '#707b55', fontStyle: 'italic' }}>Sem dados de horário.</Text>
                )}
              </View>
            </Animated.View>

            {/* TOP EVENTOS DE RUA */}
            <Animated.View entering={FadeInUp.duration(500).delay(350)}>
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1.5, borderColor: '#c8cac6' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <Ionicons name="podium-outline" size={20} color="#78a764" />
                  <Text style={{ color: '#1c1f0f', fontSize: 16, fontWeight: '800' }}>Top Eventos de Rua</Text>
                </View>
                <Text style={{ color: '#707b55', fontSize: 12, marginBottom: 16 }}>Eventos de venda de rua com maior faturamento.</Text>
                {ruaMetrics.topEventos.map((ev, index) => (
                  <View key={ev.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: index === ruaMetrics.topEventos.length -1 ? 0 : 14 }}>
                    <View style={{ width: 28, height: 28, backgroundColor: 'rgba(120, 167, 100, 0.15)', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                      <Text style={{ color: '#78a764', fontWeight: '800', fontSize: 14 }}>{index + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#1c1f0f', fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{ev.nome}</Text>
                      <Text style={{ color: '#707b55', fontSize: 12, marginTop: 2 }}>{ev.data} • {ev.pedidos} pedidos • {formatNum(ev.margem)}% margem</Text>
                    </View>
                    <Text style={{ color: '#78a764', fontSize: 16, fontWeight: '800', marginLeft: 12 }}>{formatCurrency(ev.receita)}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          </>
        ) : (
          <>
        
        {/* BARÔMETRO DE PERFORMANCE */}
        <Animated.View entering={FadeInUp.duration(500)}>
          <View style={{ backgroundColor: '#1c1f0f', borderRadius: 24, padding: 24, marginBottom: 20, shadowColor: '#1c1f0f', shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}>
              <Ionicons name="speedometer" size={18} color="#cc9e6f" />
              <Text style={{ color: '#cc9e6f', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>Barômetro de Lucratividade</Text>
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
              <View>
                <Text style={{ color: '#c8cac6', fontSize: 13, marginBottom: 4 }}>Lucro Histórico Global</Text>
                <Text style={{ color: '#78a764', fontSize: 28, fontWeight: '800' }}>{formatCurrency(metrics.totalLucro)}</Text>
              </View>
              <View style={{ backgroundColor: 'rgba(120, 167, 100, 0.15)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ color: '#78a764', fontSize: 16, fontWeight: '800' }}>+{formatNum(metrics.margemLucro)}%</Text>
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: 'rgba(255, 255, 255, 0.1)', marginBottom: 16 }} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
               <View>
                  <Text style={{ color: '#c8cac6', fontSize: 12 }}>Receita Bruta</Text>
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>{formatCurrency(metrics.totalReceita)}</Text>
               </View>
               <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: '#c8cac6', fontSize: 12 }}>Eventos Analisados</Text>
                  <Text style={{ color: '#cc9e6f', fontSize: 16, fontWeight: '600' }}>{metrics.eventosFechados} Festas</Text>
               </View>
            </View>
          </View>
        </Animated.View>

        {/* COMPORTAMENTO PER CAPITA (Meio a meio) */}
        <View style={{ flexDirection: 'row', gap: 14, marginBottom: 20 }}>
          <Animated.View entering={FadeInUp.duration(500).delay(100)} style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1.5, borderColor: '#c8cac6' }}>
            <Ionicons name="wine" size={24} color="#cc9e6f" style={{ marginBottom: 8 }} />
            <Text style={{ color: '#1c1f0f', fontSize: 24, fontWeight: '800' }}>{formatNum(metrics.mediaDrinksPorConvidado, 2)}</Text>
            <Text style={{ color: '#707b55', fontSize: 13, fontWeight: '600', marginTop: 4 }}>Média de Drinks{'\n'}por Convidado</Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(500).delay(200)} style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1.5, borderColor: '#c8cac6' }}>
            <Ionicons name="card" size={24} color="#78a764" style={{ marginBottom: 8 }} />
            <Text style={{ color: '#1c1f0f', fontSize: 24, fontWeight: '800' }}>{formatCurrency(metrics.custoPorConvidado)}</Text>
            <Text style={{ color: '#707b55', fontSize: 13, fontWeight: '600', marginTop: 4 }}>Custo Médio{'\n'}por Convidado</Text>
          </Animated.View>
        </View>

        {/* GRÁFICO BARRA (STACKED) DE RECEITA VS CUSTO POR FESTA */}
        {metrics.timelineStats.length > 0 && (
          <Animated.View entering={FadeInUp.duration(500).delay(250)}>
            <View style={{ backgroundColor: '#1c1f0f', borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: '#1c1f0f', shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Ionicons name="bar-chart-outline" size={20} color="#cc9e6f" />
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }}>Receita Bruta vs Custo Realizado</Text>
              </View>
              <Text style={{ color: '#c8cac6', fontSize: 13, marginBottom: 16, lineHeight: 18 }}>
                O Custo da Operação (Base <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>Vermelha</Text>) diminuindo a Receita de cada festa para sobrar o Lucro Líquido (Topo <Text style={{ color: '#22c55e', fontWeight: 'bold' }}>Verde</Text>).
              </Text>
              
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ marginLeft: -10 }}>
                  <StackedBarChart
                    data={{
                      labels: metrics.timelineStats.map(s => {
                        const d = new Date(s.data);
                        return `${d.getDate()}/${d.getMonth()+1}`;
                      }),
                      legend: ['Custo', 'Lucro'],
                      data: metrics.timelineStats.map(s => [Math.max(0, s.custo), Math.max(0, s.lucro)]),
                      barColors: ['rgba(239, 68, 68, 0.85)', 'rgba(34, 197, 94, 0.85)'],
                    }}
                    width={Math.max(width - 40, metrics.timelineStats.length * 60 + 100)}
                    height={220}
                    chartConfig={{
                      backgroundColor: '#1c1f0f',
                      backgroundGradientFrom: '#1c1f0f',
                      backgroundGradientTo: '#1c1f0f',
                      decimalPlaces: 0,
                      color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                      labelColor: (opacity = 1) => `rgba(200, 202, 198, ${opacity})`,
                      barPercentage: 0.5,
                      propsForBackgroundLines: { strokeWidth: 1, stroke: 'rgba(255,255,255,0.05)' },
                    }}
                    hideLegend={false}
                    style={{
                      marginVertical: 8,
                      borderRadius: 16
                    }}
                  />
                </View>
              </ScrollView>
            </View>
          </Animated.View>
        )}

        {/* RANKING FESTAS TOP DRINKS POR CONVIDADO */}
        <Animated.View entering={FadeInUp.duration(500).delay(270)}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1.5, borderColor: '#c8cac6' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Ionicons name="wine" size={20} color="#9333ea" />
              <Text style={{ color: '#1c1f0f', fontSize: 16, fontWeight: '800' }}>Top Festas: Bebem Mais</Text>
            </View>
            <Text style={{ color: '#707b55', fontSize: 12, marginBottom: 16 }}>Média de drinks servidos por convidado logados na festa.</Text>
            
            {metrics.topFestasDrinks.length > 0 ? (
              metrics.topFestasDrinks.map((festa, index) => (
                <TouchableOpacity key={index} onPress={() => setSelectedPartyDetail(festa)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: index === metrics.topFestasDrinks.length -1 ? 0 : 16 }}>
                  <View style={{ width: 28, height: 28, backgroundColor: '#f3e8ff', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                    <Text style={{ color: '#9333ea', fontWeight: '800', fontSize: 14 }}>{index + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#1c1f0f', fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{festa.nome}</Text>
                    <Text style={{ color: '#707b55', fontSize: 12, marginTop: 2 }}>{formatData(festa.data)} • {festa.convidados} conv.</Text>
                  </View>
                  <Text style={{ color: '#9333ea', fontSize: 16, fontWeight: '800', marginLeft: 16 }}>
                    {formatNum(festa.drinksPorConvidado, 1)} un/p
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
               <Text style={{ color: '#707b55', fontStyle: 'italic' }}>Nenhuma festa com dados.</Text>
            )}
          </View>
        </Animated.View>

        {/* RANKING FESTAS MAIOR CUSTO POR CONVIDADO */}
        <Animated.View entering={FadeInUp.duration(500).delay(290)}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1.5, borderColor: '#c8cac6' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Ionicons name="cash" size={20} color="#c83c3c" />
              <Text style={{ color: '#1c1f0f', fontSize: 16, fontWeight: '800' }}>Top Festas: Mais Caras</Text>
            </View>
            <Text style={{ color: '#707b55', fontSize: 12, marginBottom: 16 }}>Festas que deram maior custo operacional por pessoa.</Text>
            
            {metrics.topFestasCusto.length > 0 ? (
              metrics.topFestasCusto.map((festa, index) => (
                <TouchableOpacity key={index} onPress={() => setSelectedPartyDetail(festa)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: index === metrics.topFestasCusto.length -1 ? 0 : 16 }}>
                  <View style={{ width: 28, height: 28, backgroundColor: '#fee2e2', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                    <Text style={{ color: '#c83c3c', fontWeight: '800', fontSize: 14 }}>{index + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#1c1f0f', fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{festa.nome}</Text>
                    <Text style={{ color: '#707b55', fontSize: 12, marginTop: 2 }}>{formatData(festa.data)} • {festa.convidados} conv.</Text>
                  </View>
                  <Text style={{ color: '#c83c3c', fontSize: 16, fontWeight: '800', marginLeft: 16 }}>
                    {formatCurrency(festa.custoPorConvidado)}/p
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
               <Text style={{ color: '#707b55', fontStyle: 'italic' }}>Nenhuma festa com dados.</Text>
            )}
          </View>
        </Animated.View>

        {/* RANKING TOP DRINKS */}
        <Animated.View entering={FadeInUp.duration(500).delay(300)}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1.5, borderColor: '#c8cac6' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Ionicons name="trophy" size={20} color="#e5a93d" />
              <Text style={{ color: '#1c1f0f', fontSize: 16, fontWeight: '800' }}>Drinks Campeões</Text>
            </View>
            
            {metrics.topDrinks.length > 0 ? (
              metrics.topDrinks.map((drink, index) => (
                <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: index === metrics.topDrinks.length -1 ? 0 : 16 }}>
                  <View style={{ width: 28, height: 28, backgroundColor: index === 0 ? '#e5a93d' : (index === 1 ? '#c0c0c0' : '#cd7f32'), borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                    <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>{index + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#1c1f0f', fontSize: 16, fontWeight: '700' }}>{drink.name}</Text>
                    <View style={{ width: '100%', height: 4, backgroundColor: '#F5F0EA', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                       <View style={{ width: `${Math.min((drink.count / metrics.topDrinks[0].count) * 100, 100)}%`, height: '100%', backgroundColor: index === 0 ? '#e5a93d' : '#888' }} />
                    </View>
                  </View>
                  <Text style={{ color: '#707b55', fontSize: 15, fontWeight: '700', marginLeft: 16 }}>{drink.count} un</Text>
                </View>
              ))
            ) : (
              <Text style={{ color: '#707b55', fontStyle: 'italic' }}>Nenhuma venda identificada.</Text>
            )}
          </View>
        </Animated.View>

        {/* TERMÔMETRO DE DESPERDÍCIO */}
        <Animated.View entering={FadeInUp.duration(500).delay(400)}>
          <View style={{ backgroundColor: 'rgba(200, 60, 60, 0.04)', borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(200, 60, 60, 0.2)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Ionicons name="warning-outline" size={20} color="#c83c3c" />
              <Text style={{ color: '#c83c3c', fontSize: 16, fontWeight: '800' }}>Termômetro de Desperdício</Text>
            </View>
            <Text style={{ color: '#707b55', fontSize: 13, marginBottom: 16 }}>Soma de todas as garrafas e limões que quebraram ou estragaram durante o fechamento de festas da história da empresa.</Text>
            <View style={{ backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e8e4de' }}>
              <Text style={{ color: '#1c1f0f', fontSize: 14 }}>Dinheiro Perdido na Operação</Text>
              <Text style={{ color: '#c83c3c', fontSize: 28, fontWeight: '800', marginTop: 4 }}>- {formatCurrency(metrics.totalPerdasReal)}</Text>
            </View>
          </View>
        </Animated.View>

        {/* RANKING CATEGORIAS MAIS LUCRATIVAS */}
        <Animated.View entering={FadeInUp.duration(500).delay(450)}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1.5, borderColor: '#c8cac6' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="bookmark" size={20} color="#78a764" />
                <Text style={{ color: '#1c1f0f', fontSize: 16, fontWeight: '800' }}>Categorias Lucrativas</Text>
              </View>
            </View>
            <Text style={{ color: '#707b55', fontSize: 12, marginBottom: 16 }}>Média de Lucro Limpo que cada nicho de festa traz no seu bolso por evento.</Text>
            
            {metrics.categoriasRentaveis.map((cat, index) => (
              <View key={cat.tipo} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: index === metrics.categoriasRentaveis.length -1 ? 0 : 16 }}>
                <View style={{ width: 28, height: 28, backgroundColor: 'rgba(120, 167, 100, 0.15)', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <Text style={{ color: '#78a764', fontWeight: '800', fontSize: 14 }}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#1c1f0f', fontSize: 15, fontWeight: '700' }}>{cat.tipo}</Text>
                  <Text style={{ color: '#707b55', fontSize: 12, marginTop: 2 }}>{cat.eventosCount} evento(s) consolidados</Text>
                  
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <View style={{ width: '60%', height: 4, backgroundColor: '#F5F0EA', borderRadius: 2, overflow: 'hidden' }}>
                      <View style={{ width: `${Math.min((cat.lucroMedioPorEvento / metrics.categoriasRentaveis[0].lucroMedioPorEvento) * 100, 100)}%`, height: '100%', backgroundColor: '#78a764' }} />
                    </View>
                    <Text style={{ color: '#78a764', fontSize: 11, fontWeight: '700' }}>MGM: {formatNum(cat.margemMedia, 0)}%</Text>
                  </View>
                </View>
                <Text style={{ color: '#1c1f0f', fontSize: 16, fontWeight: '800', marginLeft: 16 }}>
                  {formatCurrency(cat.lucroMedioPorEvento)}
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* TICKET FINANCEIRO DO BUFFET */}
        <Animated.View entering={FadeInUp.duration(500).delay(500)}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1.5, borderColor: '#c8cac6' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Ionicons name="podium-outline" size={20} color="#1c1f0f" />
              <Text style={{ color: '#1c1f0f', fontSize: 16, fontWeight: '800' }}>Médias Por Evento</Text>
            </View>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderColor: '#F5F0EA' }}>
               <Text style={{ color: '#707b55', fontSize: 14, fontWeight: '600' }}>Custo por Festa (Contrato):</Text>
               <Text style={{ color: '#1c1f0f', fontSize: 16, fontWeight: '700' }}>{formatCurrency(metrics.custoMedioPorEvento)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
               <Text style={{ color: '#707b55', fontSize: 14, fontWeight: '600' }}>Lucro Limpo por Festa:</Text>
               <Text style={{ color: '#78a764', fontSize: 16, fontWeight: '800' }}>{formatCurrency(metrics.lucroMedioPorEvento)}</Text>
            </View>
          </View>
        </Animated.View>

        {/* GRAFICO DE DISTRIBUIÇÃO DE CUSTOS (PIECHART) */}
        {metrics.pieData && metrics.pieData.length > 0 && (
          <Animated.View entering={FadeInUp.duration(500).delay(550)}>
            <View style={{ backgroundColor: '#1c1f0f', borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: '#1c1f0f', shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Ionicons name="pie-chart-outline" size={20} color="#cc9e6f" />
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }}>Distribuição de Custos</Text>
              </View>
              <Text style={{ color: '#c8cac6', fontSize: 13, marginBottom: 10 }}>Onde a maior parte do seu dinheiro está sendo gasta nos eventos.</Text>
              
              <View style={{ alignItems: 'center', marginVertical: 10 }}>
                <PieChart
                  data={metrics.pieData}
                  width={width - 80}
                  height={180}
                  chartConfig={{
                    color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                  }}
                  accessor={"population"}
                  backgroundColor={"transparent"}
                  paddingLeft={"10"}
                  absolute={false}
                />
              </View>

              <View style={{ marginTop: 12, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingTop: 16, gap: 10 }}>
                {metrics.pieData.map((d, index) => {
                   const pct = ((d.population / metrics.custoOperacaoGlobal) * 100).toFixed(1);
                   return (
                     <View key={index} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: d.color }} />
                          <Text style={{ color: '#FFF', fontSize: 13 }}>{d.name}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <Text style={{ color: '#c8cac6', fontSize: 13 }}>{formatCurrency(d.population)}</Text>
                          <Text style={{ color: d.color, fontSize: 13, fontWeight: '700', width: 44, textAlign: 'right' }}>{pct}%</Text>
                        </View>
                     </View>
                   );
                })}
              </View>
            </View>
          </Animated.View>
        )}
        </>
        )}

      </ScrollView>

      {activeTab === 'eventos' && (
      <Modal visible={!!selectedPartyDetail} transparent={true} animationType="fade" onRequestClose={() => setSelectedPartyDetail(null)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setSelectedPartyDetail(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
           <TouchableOpacity activeOpacity={1} style={{ backgroundColor: '#FFF', borderRadius: 24, padding: 24, width: '100%', maxWidth: 400 }}>
              {selectedPartyDetail && (
                 <>
                   <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                     <View style={{ flex: 1 }}>
                       <Text style={{ color: '#1c1f0f', fontSize: 20, fontWeight: '800' }}>{selectedPartyDetail.nome}</Text>
                       <Text style={{ color: '#707b55', fontSize: 14, marginTop: 4 }}>{formatData(selectedPartyDetail.data)} • {selectedPartyDetail.convidados} convidados</Text>
                     </View>
                     <TouchableOpacity onPress={() => setSelectedPartyDetail(null)} style={{ padding: 4 }}>
                       <Ionicons name="close" size={26} color="#1c1f0f" />
                     </TouchableOpacity>
                   </View>
                   
                   <View style={{ backgroundColor: '#F5F0EA', borderRadius: 16, padding: 16, gap: 12 }}>
                     <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: '#707b55', fontSize: 15, fontWeight: '600' }}>Total de Drinks Servidos:</Text>
                        <Text style={{ color: '#9333ea', fontSize: 16, fontWeight: '800' }}>{formatNum(selectedPartyDetail.totalDrinks, 0)} unidades</Text>
                     </View>
                     <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: '#707b55', fontSize: 15, fontWeight: '600' }}>Receita do Fechamento:</Text>
                        <Text style={{ color: '#1c1f0f', fontSize: 16, fontWeight: '700' }}>{formatCurrency(selectedPartyDetail.receita)}</Text>
                     </View>
                     <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: '#707b55', fontSize: 15, fontWeight: '600' }}>Lucro Líquido:</Text>
                        <Text style={{ color: '#78a764', fontSize: 16, fontWeight: '800' }}>{formatCurrency(selectedPartyDetail.lucro)}</Text>
                     </View>
                     <View style={{ height: 1, backgroundColor: '#e8e4de', marginVertical: 4 }} />
                     <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: '#707b55', fontSize: 15, fontWeight: '600' }}>Custo Operacional Total:</Text>
                        <Text style={{ color: '#c83c3c', fontSize: 16, fontWeight: '800' }}>{formatCurrency(selectedPartyDetail.custo)}</Text>
                     </View>
                   </View>
                 </>
              )}
           </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      )}

    </SafeAreaView>
  );
}
