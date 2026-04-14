# Warm Cache on App Startup — Offline Persistence Fix

## Problema

Ao abrir o aplicativo **sem internet** (ou com internet instável), drinks, pedidos e festas ativas não aparecem porque:

1. **`WarmCache.js` aborta se já está offline** — a linha `if (isOffline) return;` impede qualquer hidratação dos listeners de Firebase. Mas o `isOffline` vem do `NetInfo`, que **demora alguns ms para detectar o estado real da rede**. Nesse gap, o componente pode montar, ver `isOffline=false`, e só então a rede cair — ou pior, montar com `isOffline=true` e não fazer nada.
2. **Cache não é lido imediato ao abrir o app** — o `WarmCache` usa `onValue()` (real-time), mas quando offline, o Firebase SDK não entrega o cache do snapshot local automaticamente. Os dados do AsyncStorage não são pré-carregados na memória antes da tela renderizar.
3. **`useAppStore` persiste apenas `festaSelecionada`, `clientInfo`, `screensaverEnabled` e `selectedDrinks`** — `pedidosGlobais` fica fora do `partialize`, então pedidos locais são perdidos entre sessões.
4. **Corrida entre `loadCache` e `onValue`** em `gerenciarPedidos.js` — o `onValue` online pode sobrescrever dados antes do `loadCache` terminar, ou o listener offline retorna `null` e limpa dados (mesmo com o guarda `if (!isOffline)`).

---

## Solução Proposta

### Strategy: "Cache-First, Firebase-Second"

1. **Novo serviço `warmCacheService.js`** — Lê TODO o AsyncStorage de forma paralela ao iniciar o app, antes da primeira tela renderizar. Coloca tudo em um estado global (`useBootStore`).
2. **`useBootStore` (novo Zustand store)** — Guarda o estado de boot: `isBooting`, `cachedDrinks`, `cachedOrders`, `cachedFestas`. Usado por todas as telas para renderizar imediatamente com dados offline.
3. **`_layout.js`** — Executa o `warmCacheService` como primeiríssimo efeito. Enquanto carrega, mostra um splash mínimo. Depois libera as telas.
4. **`WarmCache.js`** — Muda de lógica: **sempre** lê o AsyncStorage na montagem (independente de estar offline/online). Os listeners Firebase atualizam o cache quando disponíveis.
5. **`useAppStore.js`** — Adiciona `pedidosGlobais` ao `partialize` para persistir pedidos entre sessões.

---

## User Review Required

> [!IMPORTANT]
> A mudança em `partialize` do `useAppStore` vai começar a persistir `pedidosGlobais` no AsyncStorage. Isso é intencional (pedidos offline não se perdem ao reiniciar o app), mas se o array crescer muito pode aumentar o uso de armazenamento. Confirme se isso é OK.

> [!WARNING]
> O `useBootStore` é um novo Zustand store sem `persist`. Ele vive apenas na sessão atual (memória). Ao fechar e reabrir o app, o `warmCacheService` roda novamente para re-hidratar da AsyncStorage.

---

## Proposed Changes

### Boot Layer (novo)

#### [NEW] `app/src/services/warmCacheService.js`
Serviço puro (sem React) que lê todos os CACHE_KEYS em paralelo e retorna um objeto com todos os dados. Chamado em `_layout.js`.

#### [NEW] `app/src/store/useBootStore.js`
Zustand store (sem persist) que expõe:
- `isBooting: true` (enquanto carrega cache)
- `cachedDrinks`, `cachedOrders`, `cachedFestas`
- `hydrate(data)` — preenche tudo de uma vez
- `setBooting(false)` — libera a UI

---

### Layout — Root App

#### [MODIFY] `app/_layout.js`
- Importa `useBootStore` e `warmCacheService`
- Roda `warmCacheService().then(hydrate).finally(setBooting(false))` **antes** de qualquer render das telas filhas
- Exibe um `<View>` de loading mínimo enquanto `isBooting === true`

---

### WarmCache Component

#### [MODIFY] `app/src/components/WarmCache.js`
- **Remove** o `if (isOffline) return;` que impede hidratação
- Adiciona leitura imediata do AsyncStorage na montagem (independente da rede)
- Mantém os listeners `onValue` do Firebase para atualizar quando online

---

### Global State

#### [MODIFY] `app/src/store/useAppStore.js`
- Adiciona `pedidosGlobais` no `partialize` para persistir entre sessões
- Adiciona limpeza de pedidos antigos no `onRehydrateStorage` (ex: pedidos com mais de 24h são removidos)

---

### Telas que consomem os dados offline

#### [MODIFY] `app/pedidosBar/gerenciarPedidos.js`
- Usa `useBootStore` para pré-carregar dados enquanto o Firebase não responde
- Resolve a corrida `loadCache vs onValue`: cache do Boot é fonte primária; `onValue` só sobrescreve quando retorna dados válidos (não `null`)

#### [MODIFY] `app/pedidosBar/selecaoBebidas.js`
- Usa `cachedDrinks` do `useBootStore` como estado inicial dos drinks (elimina flash de lista vazia)

---

## Verification Plan

### Automated Tests
Arquivo `__tests__/warmCacheService.test.js` já não existe — criaremos apenas como teste manual.

### Manual Verification
1. **Teste Offline Puro**: Ativar modo avião → fechar app → reabrir → drinks e pedidos devem aparecer imediatamente
2. **Teste de Resiliência**: Desativar Wi-Fi após o app abrir → navegar para gerenciarPedidos → dados devem estar presentes
3. **Teste de Sincronização**: Reativar Wi-Fi → verificar que os dados do Firebase sobrescrevem o cache corretamente
4. **Teste de Pedido Offline**: Criar pedido offline → fechar app → reabrir → pedido deve estar na fila ainda
