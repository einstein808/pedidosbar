import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform, ActivityIndicator } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

export default function PartyForm({ 
  initialData = null, 
  onSubmit, 
  onCancel = null, 
  loading = false, 
  submitLabel = "Salvar" 
}) {
  const PARTY_TYPES = ['Casamento', '15 Anos', 'Formatura', 'Corporativo', 'Aniversário', 'Outros'];

  const [nome, setNome] = useState(initialData?.nome || '');
  const [data, setData] = useState(initialData?.data || '');
  const [tipoFesta, setTipoFesta] = useState(initialData?.tipoFesta || 'Casamento');
  const [quantidadeConvidados, setQuantidadeConvidados] = useState(initialData?.quantidadeConvidados?.toString() || '');
  const [nomePacote, setNomePacote] = useState(initialData?.pacote?.nome || '');
  const [valorPorConvidado, setValorPorConvidado] = useState(initialData?.pacote?.valorPorConvidado?.toString() || '');
  const [custoMaoDeObra, setCustoMaoDeObra] = useState(initialData?.custoMaoDeObra?.toString() || '350');
  
  const [showDatePicker, setShowDatePicker] = useState(false);

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
          placeholder="Nome da Festa"
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

      <Text style={labelStyle}>Tipo de Festa</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 4 }}>
          {PARTY_TYPES.map(type => (
            <TouchableOpacity
              key={type}
              onPress={() => setTipoFesta(type)}
              activeOpacity={0.8}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 20,
                backgroundColor: tipoFesta === type ? '#78a764' : '#F5F0EA',
                borderWidth: 1.5,
                borderColor: tipoFesta === type ? '#78a764' : '#e8e4de',
                shadowColor: '#1c1f0f',
                shadowOffset: { width: 0, height: tipoFesta === type ? 2 : 0 },
                shadowOpacity: tipoFesta === type ? 0.2 : 0,
                shadowRadius: 4,
                elevation: tipoFesta === type ? 4 : 0,
              }}
            >
              <Text style={{
                color: tipoFesta === type ? '#FFF' : '#707b55',
                fontWeight: tipoFesta === type ? '800' : '600',
                fontSize: 14
              }}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Detalhes Financeiros */}
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
