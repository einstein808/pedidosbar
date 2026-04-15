import { View, Text, ScrollView } from "react-native";
import { useAuthStore } from "../src/store/useAuthStore";
import { useEffect } from "react";
import { router } from "expo-router";
import Button from "../src/components/atoms/buttom";
import { useAppStore } from "../src/store/useAppStore";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInUp } from "react-native-reanimated";
import "../../global.css";

export default function Home() {
  const user = useAuthStore(s => s.user);
  const isLoading = useAuthStore(s => s.isLoading);
  const festaSelecionada = useAppStore(s => s.festaSelecionada);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading]);

  const menuItems = [
    {
      href: "/drinks",
      label: "Laboratório de Drinks",
      desc: "Gerenciar receitas e fichas técnicas",
      icon: "wine",
      bg: '#FFFFFF',
      iconBg: 'rgba(204, 158, 111, 0.15)',
      iconColor: '#cc9e6f',
      textColor: '#1c1f0f',
      descColor: '#707b55',
    },
    {
      href: "/pedidosBar/gerenciarPedidos",
      label: "Gerenciar Pedidos",
      desc: "Ver pedidos em andamento",
      icon: "receipt",
      bg: '#1c1f0f',
      iconBg: 'rgba(204, 158, 111, 0.2)',
      iconColor: '#cc9e6f',
      textColor: '#cc9e6f',
      descColor: 'rgba(204, 158, 111, 0.65)',
    },
    {
      href: "/pedidosBar/festa",
      label: "Gerenciar Eventos",
      desc: "Criar festas, vendas de rua e eventos",
      icon: "sparkles",
      bg: '#78a764',
      iconBg: 'rgba(255, 255, 255, 0.25)',
      iconColor: '#FFFFFF',
      textColor: '#FFFFFF',
      descColor: 'rgba(255, 255, 255, 0.85)',
    },
    {
      href: "/pedidosBar/ultimosPedidos",
      label: "Últimos Pedidos",
      desc: "Histórico e tela de exibição",
      icon: "time",
      bg: '#FFFFFF',
      iconBg: 'rgba(112, 123, 85, 0.12)',
      iconColor: '#707b55',
      textColor: '#1c1f0f',
      descColor: '#707b55',
    },
    {
      href: "/pedidosBar/estoqueFesta",
      label: "Estoque do Evento",
      desc: "Controlar e dar baixa de bebidas",
      icon: "cube",
      bg: '#1c1f0f',
      iconBg: 'rgba(204, 158, 111, 0.2)',
      iconColor: '#cc9e6f',
      textColor: '#cc9e6f',
      descColor: 'rgba(204, 158, 111, 0.65)',
    },
    {
      href: "/pedidosBar/custosInsumos",
      label: "Gestão de Custos",
      desc: "Preço de insumos e embalagens",
      icon: "cash",
      bg: '#FFFFFF',
      iconBg: 'rgba(120, 167, 100, 0.15)',
      iconColor: '#78a764',
      textColor: '#1c1f0f',
      descColor: '#707b55',
    },
    {
      href: "/pedidosBar/relatorioFesta",
      label: "Fechamento de Evento",
      desc: "Lucro, despesas e relatórios",
      icon: "bar-chart",
      bg: '#cc9e6f',
      iconBg: 'rgba(28, 31, 15, 0.15)',
      iconColor: '#1c1f0f',
      textColor: '#1c1f0f',
      descColor: 'rgba(28, 31, 15, 0.7)',
    },
    {
      href: "/pedidosBar/insights",
      label: "Inteligência Estratégica",
      desc: "Estatísticas, rankings e lucro",
      icon: "trending-up",
      bg: '#1c1f0f',
      iconBg: 'rgba(204, 158, 111, 0.2)',
      iconColor: '#cc9e6f',
      textColor: '#FFFFFF',
      descColor: 'rgba(255, 255, 255, 0.7)',
    },
    {
      href: "/pedidosBar/cadastrarVIP",
      label: "Convidar Cliente (VIP)",
      desc: "Criar link mágico com senha",
      icon: "mail-unread",
      bg: '#78a764',
      iconBg: 'rgba(255, 255, 255, 0.25)',
      iconColor: '#FFFFFF',
      textColor: '#FFFFFF',
      descColor: 'rgba(255, 255, 255, 0.85)',
    },
    {
      href: "/pedidosBar/configWhatsapp",
      label: "API WhatsApp",
      desc: "Configurar API Key de mensagens",
      icon: "logo-whatsapp",
      bg: '#FFFFFF',
      iconBg: 'rgba(56, 168, 82, 0.15)',
      iconColor: '#38a852',
      textColor: '#1c1f0f',
      descColor: '#707b55',
    },
    {
      href: "/configRede",
      label: "Rede Local (Offline)",
      desc: "Antena P2P para Quedas de Rede",
      icon: "wifi",
      bg: '#1c1f0f',
      iconBg: 'rgba(255, 255, 255, 0.15)',
      iconColor: '#FFFFFF',
      textColor: '#FFFFFF',
      descColor: 'rgba(255, 255, 255, 0.7)',
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0EA' }}>
      <ScrollView 
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >

        {/* Decorative circles */}
        <View style={{ position: 'absolute', top: 30, right: -15, width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(120, 167, 100, 0.1)' }} />

        {/* Header */}
        <Animated.View entering={FadeInUp.duration(500)}>
          <View style={{ marginTop: 20, marginBottom: 32 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <View
                style={{
                  backgroundColor: '#1c1f0f',
                  borderRadius: 16,
                  padding: 12,
                  shadowColor: '#1c1f0f',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <Ionicons name="beer-outline" size={22} color="#cc9e6f" />
              </View>
              <View>
                <Text style={{ color: '#707b55', fontSize: 14 }}>
                  Bem-vindo de volta,
                </Text>
                <Text style={{ color: '#1c1f0f', fontSize: 24, fontWeight: '700' }}>
                  {user?.role === 'barista' ? 'Barista' : 'Cliente'} 👋
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Menu */}
        <View style={{ gap: 16 }}>
          {menuItems.map((item, index) => (
            <Animated.View
              key={item.href}
              entering={FadeInUp.duration(400).delay(100 + index * 80)}
            >
              <Button href={item.href} className="w-full rounded-[20px]">
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: item.bg,
                    borderWidth: item.bg === '#FFFFFF' ? 1.5 : 0,
                    borderColor: '#e8e4de',
                    borderRadius: 20,
                    padding: 20,
                    gap: 16,
                    shadowColor: item.bg === '#FFFFFF' ? '#000' : item.bg,
                    shadowOffset: { width: 0, height: item.bg === '#FFFFFF' ? 4 : 6 },
                    shadowOpacity: item.bg === '#FFFFFF' ? 0.05 : 0.25,
                    shadowRadius: item.bg === '#FFFFFF' ? 12 : 16,
                    elevation: item.bg === '#FFFFFF' ? 2 : 8,
                  }}
                >
                  <View
                    style={{
                      backgroundColor: item.iconBg,
                      borderRadius: 16,
                      padding: 14,
                    }}
                  >
                    <Ionicons name={item.icon} size={28} color={item.iconColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: item.textColor, fontWeight: '800', fontSize: 19, letterSpacing: -0.3 }}>
                      {item.label}
                    </Text>
                    <Text style={{ color: item.descColor, fontSize: 13, marginTop: 4, fontWeight: '500' }}>
                      {item.desc}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={item.bg === '#FFFFFF' ? '#c8cac6' : 'rgba(255,255,255,0.3)'} />
                </View>
              </Button>
            </Animated.View>
          ))}
        </View>


      </ScrollView>
    </SafeAreaView>
  );
}
