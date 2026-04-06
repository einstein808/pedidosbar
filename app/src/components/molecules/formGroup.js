import React from 'react';
import InputField from '../atoms/inputField';

export default function FormGroup({ form, handlers }) {
  return (
    <>
      <InputField label="Nome" value={form.nome} onChangeText={handlers.setNome} placeholder="Digite o nome" />
      <InputField label="WhatsApp" value={form.whatsapp} onChangeText={handlers.setWhatsapp} placeholder="Digite o WhatsApp" />
      <InputField label="Drink" value={form.drink} onChangeText={handlers.setDrink} placeholder="Digite o drink" />
      <InputField label="Quantidade" value={form.quantidade} onChangeText={handlers.setQuantidade} placeholder="Quantidade" keyboardType="numeric" />
    </>
  );
}
