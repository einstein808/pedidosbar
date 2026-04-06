// components/atoms/Title.js
import { Text } from "react-native";
import React from "react";

export default function Title({ children }) {
  return (
    <Text className="text-2xl font-bold text-center mb-6">
      {children}
    </Text>
  );
}
