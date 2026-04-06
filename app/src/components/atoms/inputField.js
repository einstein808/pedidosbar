import React from 'react';
import { TextInput, Text, View, StyleSheet } from 'react-native';

export default function InputField({ label, value, onChangeText, ...props }) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 10 },
  label: { fontSize: 18 },
  input: { borderWidth: 1, padding: 8 },
});
