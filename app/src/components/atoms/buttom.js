// src/components/atoms/buttom.js
import { Text, Pressable } from "react-native";
import { Link } from "expo-router";
import "../../../../global.css"
export default function Button({ children, href, onPress, className }) {
  const content = (
    <Pressable
      onPress={onPress}
      className={`${className}`}
    >
      <Text className="text-white text-center font-bold">{children}</Text>
    </Pressable>
  );

  // Se existir href, renderiza como Link
  if (href) {
    return <Link href={href} asChild>{content}</Link>;
  }

  return content;
}
