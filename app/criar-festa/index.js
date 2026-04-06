// app/index.js
import { View, Text } from "react-native";
import { useEffect } from "react";
import { router } from "expo-router";
import Button from "../src/components/atoms/buttom";

export default function Home() {
 

  return (
    

      <Button href="/criar-festa/festa" className="bg-blue-600">
        Cadastrar Drinks
      </Button>
      
   
  );
}
