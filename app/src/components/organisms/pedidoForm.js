import React, { useState } from 'react';
import { View, Alert, TouchableOpacity, Text, StyleSheet } from 'react-native';
import FormGroup from '../molecules/formGroup';
import { enviarPedido } from '../../services/pedidoService';

export default function PedidoForm() {
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [drink, setDrink] = useState('');
  const [quantidade, setQuantidade] = useState('1');

  const handleSubmit = async () => {
    try {
      await enviarPedido({ nome, whatsapp, drink, quantidade });
      Alert.alert('Pedido enviado com sucesso!');
      setNome('');
      setWhatsapp('');
      setDrink('');
      setQuantidade('1');
    } catch (error) {
      Alert.alert('Erro ao enviar pedido', error.message);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <FormGroup
        form={{ nome, whatsapp, drink, quantidade }}
        handlers={{ setNome, setWhatsapp, setDrink, setQuantidade }}
      />
      <TouchableOpacity onPress={handleSubmit} style={styles.button}>
        <Text style={styles.buttonText}>Enviar Pedido</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#8B0000',
    padding: 15,
    borderRadius: 10,
  },
  buttonText: {
    color: '#FFD700',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});
