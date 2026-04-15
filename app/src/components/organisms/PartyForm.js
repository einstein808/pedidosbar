import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform, ActivityIndicator, Modal } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

export default function PartyForm({ 
  initialData = null, 
  onSubmit, 
  onCancel = null, 
  loading = false, 
  submitLabel = "Salvar" 
}) {
  const PARTY_TYPES = ['Casamento', '15 Anos', 'Formatura', 'Corporativo', 'Aniversário', 'Venda de Rua', 'Outros'];

  const [nome, setNome] = useState(initialData?.nome || '');
  const [data, setData] = useState(initialData?.data || '');
  const [tipoFesta, setTipoFesta] = useState(initialData?.tipoFesta || 'Casamento');
  const [quantidadeConvidados, setQuantidadeConvidados] = useState(initialData?.quantidadeConvidados?.toString() || '');
  const [nomePacote, setNomePacote] = useState(initialData?.pacote?.nome || '');
  const [valorPorConvidado, setValorPorConvidado] = useState(initialData?.pacote?.valorPorConvidado?.toString() || '');
  const [custoMaoDeObra, setCustoMaoDeObra] = useState(initialData?.custoMaoDeObra?.toString() || '350');
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [typeSearch, setTypeSearch] = useState('');

  const EVENT_ICONS = {
    'Casamento': 'heart-outline',
    '15 Anos': 'gift-outline',
    'Formatura': 'school-outline',
    'Corporativo': 'briefcase-outline',
    'Aniversário': 'happy-outline',
    'Venda de Rua': 'storefront-outline',
    'Outros': 'ellipsis-horizontal-outline',
  };

  const filteredTypes = PARTY_TYPES.filter(type =>
    type.toLowerCase().includes(typeSearch.toLowerCase())
  );

  useEffect(() => {
    if (initialData) {
      setNome(initialData.nome || '');
      setData(initialData.data || '');
      setTipoFesta(initialData.tipoFesta || 'Casamento');
      setQuantidadeConvidados(initialData.quantidadeConvidados?.toString() || '');
      setNomePacote(initialData.pacote?.nome || '');
      setValorPorConvidado(initialData.pacote?.valorPorConvidado?.toString() || '');
      setCustoMaoDeObra(initialData.custoMaoDeObra?.toString() || '350');
    }
  }, [initialData]);

  const onChangeDate = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      if (Platform.OS !== 'ios') setShowDatePicker(false);
      const formatted = selectedDate.toISOString().split('T')[0];
      setData(formatted);
    } else {
      setShowDatePicker(false);
    }
  };

  const handleCallback = () => {
    onSubmit({
      nome,
      data,
      tipoFesta,
      quantidadeConvidados: quantidadeConvidados ? parseInt(quantidadeConvidados, 10) : 0,
      pacote: {
        nome: nomePacote,
        valorPorConvidado: valorPorConvidado ? parseFloat(valorPorConvidado) : 0
      },
      custoMaoDeObra: custoMaoDeObra ? parseFloat(custoMaoDeObra) : 0
    });
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

  return (
    <View>
      <Text style={labelStyle}>Nome</Text>
      <View style={inputStyle}>
        <Ionicons name="sparkles-outline" size={18} color="#cc9e6f" style={{ marginRight: 12 }} />
        <TextInput
          value={nome}
          onChangeText={setNome}
          placeholder="Nome do Evento"
          placeholderTextColor="#c8cac6"
          style={{ flex: 1, color: '#1c1f0f', fontSize: 15 }}
        />
      </View>

      <Text style={labelStyle}>Data</Text>
      <View style={inputStyle}>
        <Ionicons name="calendar-outline" size={18} color="#cc9e6f" style={{ marginRight: 12 }} />
        {Platform.OS === 'web' ? (
          <input 
            type="date" 
            value={data} 
            onChange={(e) => setData(e.target.value)} 
            style={{ flex: 1, color: '#1c1f0f', fontSize: 15, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'inherit' }} 
          />
        ) : (
          <View style={{ flex: 1 }}>
            <TouchableOpacity onPress={() => setShowDatePicker(true)} activeOpacity={0.8}>
              <Text style={{ color: data ? '#1c1f0f' : '#c8cac6', fontSize: 15 }}>
                {data ? data : "Ex: AAAA-MM-DD"}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={data ? new Date(data + 'T12:00:00') : new Date()}
                mode="date"
                display="default"
                onChange={onChangeDate}
              />
            )}
          </View>
        )}
      </View>

      <Text style={labelStyle}>Tipo do Evento</Text>
      <TouchableOpacity
        onPress={() => setShowTypePicker(true)}
        activeOpacity={0.8}
        style={{
          ...inputStyle,
          marginBottom: 20,
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <View style={{
            backgroundColor: tipoFesta ? 'rgba(120, 167, 100, 0.12)' : 'rgba(200, 202, 198, 0.2)',
            borderRadius: 10,
            padding: 8,
            marginRight: 12,
          }}>
            <Ionicons
              name={EVENT_ICONS[tipoFesta] || 'calendar-outline'}
              size={18}
              color={tipoFesta ? '#78a764' : '#c8cac6'}
            />
          </View>
          <Text style={{
            color: tipoFesta ? '#1c1f0f' : '#c8cac6',
            fontSize: 15,
            fontWeight: tipoFesta ? '600' : '400',
          }}>
            {tipoFesta || 'Selecione o tipo de evento'}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={18} color="#c8cac6" />
      </TouchableOpacity>

      {/* Modal de Seleção de Tipo */}
      <Modal
        visible={showTypePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTypePicker(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(28, 31, 15, 0.6)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setShowTypePicker(false)}
        >
          <View style={{
            backgroundColor: '#F5F0EA',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            maxHeight: '70%',
            paddingBottom: 30,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.15,
            shadowRadius: 16,
            elevation: 20,
          }}>
            <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#c8cac6' }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ backgroundColor: '#1c1f0f', borderRadius: 12, padding: 10 }}>
                  <Ionicons name="pricetags-outline" size={20} color="#cc9e6f" />
                </View>
                <Text style={{ fontSize: 20, fontWeight: '800', color: '#1c1f0f' }}>Tipo do Evento</Text>
              </View>
              <TouchableOpacity onPress={() => setShowTypePicker(false)} style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: 8, borderWidth: 1, borderColor: '#e8e4de' }}>
                <Ionicons name="close" size={20} color="#707b55" />
              </TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: 24, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1.5, borderColor: '#e8e4de' }}>
                <Ionicons name="search-outline" size={18} color="#c8cac6" style={{ marginRight: 10 }} />
                <TextInput value={typeSearch} onChangeText={setTypeSearch} placeholder="Buscar tipo de evento..." placeholderTextColor="#c8cac6" style={{ flex: 1, color: '#1c1f0f', fontSize: 15 }} autoFocus />
                {typeSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setTypeSearch('')} style={{ padding: 4 }}>
                    <Ionicons name="close-circle" size={18} color="#c8cac6" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <ScrollView style={{ paddingHorizontal: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {filteredTypes.map((type, index) => {
                const isSelected = tipoFesta === type;
                return (
                  <TouchableOpacity key={type} onPress={() => { setTipoFesta(type); setTypeSearch(''); setShowTypePicker(false); }} activeOpacity={0.7}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, marginBottom: 4, borderRadius: 14, backgroundColor: isSelected ? 'rgba(120, 167, 100, 0.12)' : index % 2 === 0 ? '#FFFFFF' : 'transparent', borderWidth: isSelected ? 1.5 : 0, borderColor: isSelected ? '#78a764' : 'transparent' }}
                  >
                    <View style={{ backgroundColor: isSelected ? '#78a764' : 'rgba(204, 158, 111, 0.12)', borderRadius: 12, padding: 10, marginRight: 14 }}>
                      <Ionicons name={EVENT_ICONS[type] || 'calendar-outline'} size={20} color={isSelected ? '#FFFFFF' : '#cc9e6f'} />
                    </View>
                    <Text style={{ flex: 1, fontSize: 16, color: '#1c1f0f', fontWeight: isSelected ? '700' : '500' }}>{type}</Text>
                    {isSelected && (
                      <View style={{ backgroundColor: '#78a764', borderRadius: 10, padding: 4 }}>
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
              {filteredTypes.length === 0 && (
                <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                  <Ionicons name="search-outline" size={36} color="#c8cac6" />
                  <Text style={{ color: '#707b55', fontSize: 14, marginTop: 8 }}>Nenhum tipo encontrado</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {tipoFesta !== 'Venda de Rua' && (
        <>
          <Text style={labelStyle}>Quantidade de Convidados</Text>
          <View style={inputStyle}>
            <Ionicons name="people-outline" size={18} color="#cc9e6f" style={{ marginRight: 12 }} />
            <TextInput
              value={quantidadeConvidados}
              onChangeText={setQuantidadeConvidados}
              placeholder="Qtd Convidados"
              keyboardType="numeric"
              placeholderTextColor="#c8cac6"
              style={{ flex: 1, color: '#1c1f0f', fontSize: 15 }}
            />
          </View>
        </>
      )}

      {tipoFesta !== 'Venda de Rua' && (
      <View style={{ backgroundColor: 'rgba(204, 158, 111, 0.05)', padding: 16, borderRadius: 14, marginBottom: 16, borderWidth: 1, borderColor: '#e8e4de' }}>
        <Text style={{ color: '#1c1f0f', fontSize: 16, fontWeight: '700', marginBottom: 12 }}>Detalhes do Pacote</Text>
        
        <Text style={labelStyle}>Nome do Pacote</Text>
        <TextInput
          value={nomePacote}
          onChangeText={setNomePacote}
          placeholder="Ex: Casamento Premium"
          placeholderTextColor="#c8cac6"
          style={{ backgroundColor: '#FFF', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#c8cac6', marginBottom: 12, color: '#1c1f0f' }}
        />

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={labelStyle}>Valor p/ Convidado</Text>
            <TextInput
              value={valorPorConvidado}
              onChangeText={setValorPorConvidado}
              placeholder="R$"
              keyboardType="numeric"
              placeholderTextColor="#c8cac6"
              style={{ backgroundColor: '#FFF', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#c8cac6', color: '#1c1f0f' }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={labelStyle}>Mão de Obra</Text>
            <TextInput
              value={custoMaoDeObra}
              onChangeText={setCustoMaoDeObra}
              placeholder="R$"
              keyboardType="numeric"
              placeholderTextColor="#c8cac6"
              style={{ backgroundColor: '#FFF', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#c8cac6', color: '#1c1f0f' }}
            />
          </View>
        </View>
      </View>
      )}

      <View style={{ flexDirection: onCancel ? 'row' : 'column', gap: 10 }}>
        <TouchableOpacity
          onPress={handleCallback}
          disabled={loading}
          activeOpacity={0.85}
          style={{
            flex: onCancel ? 1 : undefined,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#78a764',
            paddingVertical: 16,
            borderRadius: 14,
            gap: 8,
            opacity: loading ? 0.7 : 1,
            shadowColor: '#78a764',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          {loading ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name={onCancel ? "checkmark" : "add-circle-outline"} size={18} color="#FFF" />}
          <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>{loading ? 'Aguarde...' : submitLabel}</Text>
        </TouchableOpacity>

        {onCancel && (
          <TouchableOpacity
            onPress={onCancel}
            activeOpacity={0.85}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FFFFFF',
              paddingVertical: 14,
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: '#c8cac6',
              gap: 6
            }}
          >
            <Ionicons name="close" size={18} color="#707b55" />
            <Text style={{ color: '#707b55', fontWeight: '600', fontSize: 15 }}>Cancelar</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
