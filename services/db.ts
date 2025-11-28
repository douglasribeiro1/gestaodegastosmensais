import { Transaction, MonthlyBudget, BackupData } from '../types';

const DB_NAME = 'ExpenseManagerDB';
const DB_VERSION = 2; // Incrementado para garantir migração se necessário
const STORE_TRANSACTIONS = 'transactions';
const STORE_BUDGETS = 'budgets';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_TRANSACTIONS)) {
        const store = db.createObjectStore(STORE_TRANSACTIONS, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_BUDGETS)) {
        db.createObjectStore(STORE_BUDGETS, { keyPath: 'month' });
      }
    };
  });
};

export const addTransaction = async (transaction: Transaction): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TRANSACTIONS, 'readwrite');
    const store = tx.objectStore(STORE_TRANSACTIONS);
    const request = store.add(transaction);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const updateTransaction = async (transaction: Transaction): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TRANSACTIONS, 'readwrite');
    const store = tx.objectStore(STORE_TRANSACTIONS);
    const request = store.put(transaction); // put atualiza se a chave existir
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const deleteTransaction = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TRANSACTIONS, 'readwrite');
    const store = tx.objectStore(STORE_TRANSACTIONS);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getTransactionsByMonth = async (month: string): Promise<Transaction[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TRANSACTIONS, 'readonly');
    const store = tx.objectStore(STORE_TRANSACTIONS);
    const index = store.index('date');
    const start = `${month}-01`;
    const end = `${month}-31`; 
    const range = IDBKeyRange.bound(start, end);
    
    const request = index.getAll(range);
    
    request.onsuccess = () => {
      const results = request.result as Transaction[];
      // Sort by date desc, then time desc, then created desc
      results.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        if (a.time && b.time && a.time !== b.time) return b.time.localeCompare(a.time);
        return b.createdAt - a.createdAt;
      });
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
};

export const setMonthlyBudget = async (budget: MonthlyBudget): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BUDGETS, 'readwrite');
    const store = tx.objectStore(STORE_BUDGETS);
    const request = store.put(budget);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getMonthlyBudget = async (month: string): Promise<number> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BUDGETS, 'readonly');
    const store = tx.objectStore(STORE_BUDGETS);
    const request = store.get(month);
    request.onsuccess = () => {
      const data = request.result as MonthlyBudget | undefined;
      resolve(data ? data.limit : 0);
    };
    request.onerror = () => reject(request.error);
  });
};

// --- Funções de Gerenciamento de Dados (Backup/Restore) ---

export const clearAllData = async (): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_TRANSACTIONS, STORE_BUDGETS], 'readwrite');
    
    tx.objectStore(STORE_TRANSACTIONS).clear();
    tx.objectStore(STORE_BUDGETS).clear();

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const exportDatabase = async (): Promise<BackupData> => {
  const db = await openDB();
  
  const getStoreData = (storeName: string): Promise<any[]> => {
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      store.getAll().onsuccess = (e) => resolve((e.target as IDBRequest).result);
    });
  };

  const [transactions, budgets] = await Promise.all([
    getStoreData(STORE_TRANSACTIONS),
    getStoreData(STORE_BUDGETS)
  ]);

  return {
    version: 1,
    timestamp: Date.now(),
    transactions,
    budgets
  };
};

export const importDatabase = async (data: BackupData): Promise<void> => {
  // Limpa tudo antes de importar para evitar conflitos/duplicatas estranhas
  await clearAllData();
  
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_TRANSACTIONS, STORE_BUDGETS], 'readwrite');
    
    const txStore = tx.objectStore(STORE_TRANSACTIONS);
    data.transactions.forEach(t => txStore.add(t));
    
    const budgetStore = tx.objectStore(STORE_BUDGETS);
    data.budgets.forEach(b => budgetStore.add(b));

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};