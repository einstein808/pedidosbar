import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null, // { role: 'cliente' | 'barista' }
      isLoading: false,

      // Ações
      loginCliente: () => set({ user: { role: 'cliente' } }),
      
      loginBarista: (username, password) => {
        if (username === 'bar' && password === 'barista') {
          set({ user: { role: 'barista' } });
          return true;
        }
        return false;
      },
      
      logout: () => set({ user: null }),
      
      setIsLoading: (val) => set({ isLoading: val })
    }),
    {
      name: '@barman_user_zustand', // Nomeado diferente para não crachar com os dados antigos enquanto migramos
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
