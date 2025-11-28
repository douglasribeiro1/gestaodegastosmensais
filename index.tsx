import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  PlusCircle, CreditCard, Banknote, Save, X, Pencil, Check, 
  Trash2, ChevronLeft, ChevronRight, Calendar, Settings, 
  Download, Upload, Trash, Database 
} from 'lucide-react';

// --- TYPES ---
type PaymentMethod = 'DEBIT' | 'CREDIT';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  method: PaymentMethod;
  date: string; // ISO string YYYY-MM-DD
  time: string; // HH:MM
  createdAt: number;
}

interface MonthlyBudget {
  month: string; // YYYY-MM
  limit: number;
}

interface BackupData {
  version: number;
  timestamp: number;
  transactions: Transaction[];
  budgets: MonthlyBudget[];
}

// --- DATABASE SERVICE (IndexedDB) ---
const DB_NAME = 'ExpenseManagerDB';
const DB_VERSION = 2;
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

const dbService = {
  addTransaction: async (transaction: Transaction): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TRANSACTIONS, 'readwrite');
      tx.objectStore(STORE_TRANSACTIONS).add(transaction);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  updateTransaction: async (transaction: Transaction): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TRANSACTIONS, 'readwrite');
      tx.objectStore(STORE_TRANSACTIONS).put(transaction);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  deleteTransaction: async (id: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TRANSACTIONS, 'readwrite');
      tx.objectStore(STORE_TRANSACTIONS).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  getTransactionsByMonth: async (month: string): Promise<Transaction[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TRANSACTIONS, 'readonly');
      const index = tx.objectStore(STORE_TRANSACTIONS).index('date');
      const range = IDBKeyRange.bound(`${month}-01`, `${month}-31`);
      const request = index.getAll(range);
      request.onsuccess = () => {
        const results = request.result as Transaction[];
        results.sort((a, b) => {
          if (a.date !== b.date) return b.date.localeCompare(a.date);
          if (a.time && b.time && a.time !== b.time) return b.time.localeCompare(a.time);
          return b.createdAt - a.createdAt;
        });
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  },
  setMonthlyBudget: async (budget: MonthlyBudget): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_BUDGETS, 'readwrite');
      tx.objectStore(STORE_BUDGETS).put(budget);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  getMonthlyBudget: async (month: string): Promise<number> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_BUDGETS, 'readonly');
      const request = tx.objectStore(STORE_BUDGETS).get(month);
      request.onsuccess = () => resolve((request.result as MonthlyBudget)?.limit || 0);
      request.onerror = () => reject(request.error);
    });
  },
  clearAllData: async (): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_TRANSACTIONS, STORE_BUDGETS], 'readwrite');
      tx.objectStore(STORE_TRANSACTIONS).clear();
      tx.objectStore(STORE_BUDGETS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  exportDatabase: async (): Promise<BackupData> => {
    const db = await openDB();
    const getStoreData = (storeName: string): Promise<any[]> => {
      return new Promise((resolve) => {
        const tx = db.transaction(storeName, 'readonly');
        tx.objectStore(storeName).getAll().onsuccess = (e) => resolve((e.target as IDBRequest).result);
      });
    };
    const [transactions, budgets] = await Promise.all([
      getStoreData(STORE_TRANSACTIONS),
      getStoreData(STORE_BUDGETS)
    ]);
    return { version: 1, timestamp: Date.now(), transactions, budgets };
  },
  importDatabase: async (data: BackupData): Promise<void> => {
    await dbService.clearAllData();
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
  }
};

// --- COMPONENTS ---

// 1. Transaction Form
interface TransactionFormProps {
  initialData?: Transaction | null;
  onAdd: (t: Omit<Transaction, 'id' | 'createdAt'>) => void;
  onUpdate: (id: string, t: Omit<Transaction, 'id' | 'createdAt'>) => void;
  onCancelEdit: () => void;
}

const TransactionForm: React.FC<TransactionFormProps> = ({ initialData, onAdd, onUpdate, onCancelEdit }) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('DEBIT');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  const setNow = () => {
    const now = new Date();
    setDate(now.toLocaleDateString('sv')); 
    setTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
  };

  useEffect(() => {
    if (initialData) {
      setDescription(initialData.description);
      setAmount(initialData.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
      setMethod(initialData.method);
      setDate(initialData.date);
      setTime(initialData.time || '12:00');
    } else {
      setDescription('');
      setAmount('');
      setNow(); 
      setMethod('DEBIT');
    }
  }, [initialData]);

  useEffect(() => {
    if (!initialData && !date) setNow();
  }, []);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value === '') {
      setAmount('');
      return;
    }
    const numberValue = parseInt(value, 10) / 100;
    setAmount(numberValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || !date || !time) return;

    const rawValue = amount.replace(/\./g, '').replace(',', '.');
    const val = parseFloat(rawValue);
    
    if (isNaN(val) || val <= 0) return;

    const formData = { description, amount: val, method, date, time };

    if (initialData) {
      onUpdate(initialData.id, formData);
    } else {
      onAdd(formData);
      setDescription('');
      setAmount('');
      setNow();
    }
  };

  return (
    <div className={`p-6 rounded-2xl shadow-sm border mb-6 transition-colors ${initialData ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'}`}>
      <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${initialData ? 'text-amber-800' : 'text-gray-800'}`}>
        {initialData ? <Save className="w-5 h-5" /> : <PlusCircle className="w-5 h-5 text-primary" />}
        {initialData ? 'Editar Gasto' : 'Novo Gasto'}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
          <input
            type="text" required value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Supermercado"
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
            <input
              type="tel" inputMode="numeric" required value={amount}
              onChange={handleAmountChange} placeholder="0,00"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:col-span-1">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
              <input
                type="date" required value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-2 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
              <input
                type="time" required value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-2 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm"
              />
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Método</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button" onClick={() => setMethod('DEBIT')}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                method === 'DEBIT' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Banknote className="w-4 h-4" /> Débito
            </button>
            <button
              type="button" onClick={() => setMethod('CREDIT')}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                method === 'CREDIT' ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <CreditCard className="w-4 h-4" /> Crédito
            </button>
          </div>
        </div>
        <div className="flex gap-3">
          {initialData && (
            <button type="button" onClick={onCancelEdit} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-lg transition-all">
              Cancelar
            </button>
          )}
          <button type="submit" className={`flex-1 font-semibold py-3 rounded-lg shadow-md hover:shadow-lg transition-all active:scale-[0.98] text-white ${initialData ? 'bg-amber-600 hover:bg-amber-700' : 'bg-gray-900 hover:bg-black'}`}>
            {initialData ? 'Salvar Alterações' : 'Adicionar Gasto'}
          </button>
        </div>
      </form>
    </div>
  );
};

// 2. Summary Component
interface SummaryProps {
  totalSpent: number;
  spentDebit: number;
  spentCredit: number;
  limit: number;
  onUpdateLimit: (newLimit: number) => void;
}
const Summary: React.FC<SummaryProps> = ({ totalSpent, spentDebit, spentCredit, limit, onUpdateLimit }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const remaining = limit - totalSpent;
  const percentage = limit > 0 ? Math.min((totalSpent / limit) * 100, 100) : 0;
  
  let progressColor = 'bg-emerald-500';
  let remainingTextColor = 'text-emerald-600';
  if (percentage > 75) { progressColor = 'bg-orange-500'; remainingTextColor = 'text-orange-600'; }
  if (percentage >= 100) { progressColor = 'bg-red-500'; remainingTextColor = 'text-red-600'; }

  const startEditing = () => {
    setEditValue(limit.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    setIsEditing(true);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value === '') { setEditValue(''); return; }
    const numberValue = parseInt(value, 10) / 100;
    setEditValue(numberValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
  };

  const handleSave = () => {
    if (!editValue) return;
    const rawValue = editValue.replace(/\./g, '').replace(',', '.');
    const val = parseFloat(rawValue);
    if (!isNaN(val) && val >= 0) onUpdateLimit(val);
    setIsEditing(false);
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-gray-500 text-sm font-medium uppercase tracking-wide">Saldo Restante</h2>
          <div className={`text-4xl font-bold mt-1 ${remainingTextColor}`}>{formatCurrency(remaining)}</div>
        </div>
        <div className="text-right">
          <div className="text-gray-500 text-xs uppercase tracking-wide mb-1">Limite Mensal</div>
          {isEditing ? (
            <div className="flex items-center justify-end gap-2">
              <input 
                type="tel" inputMode="numeric" value={editValue} onChange={handleEditChange}
                className="w-24 text-right border-b border-gray-300 focus:border-gray-900 outline-none font-semibold text-gray-900"
                autoFocus placeholder="0,00"
              />
              <button onClick={handleSave} className="text-emerald-600 hover:text-emerald-700"><Check className="w-5 h-5" /></button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2 text-gray-900 font-semibold">
              {formatCurrency(limit)}
              <button onClick={startEditing} className="text-gray-400 hover:text-gray-600"><Pencil className="w-3 h-3" /></button>
            </div>
          )}
        </div>
      </div>
      <div className="relative pt-1 mb-6">
        <div className="flex mb-2 items-center justify-between text-xs font-semibold text-gray-500">
          <span>Total Gasto: {formatCurrency(totalSpent)}</span>
          <span>{percentage.toFixed(0)}%</span>
        </div>
        <div className="overflow-hidden h-3 mb-1 text-xs flex rounded bg-gray-100">
          <div style={{ width: `${percentage}%` }} className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-500 ${progressColor}`}></div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100">
        <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 flex flex-col">
          <div className="flex items-center gap-2 mb-1 text-emerald-700 font-medium text-xs uppercase">
            <Banknote className="w-3.5 h-3.5" /> Débito
          </div>
          <span className="text-lg font-bold text-gray-800">{formatCurrency(spentDebit)}</span>
        </div>
        <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex flex-col">
          <div className="flex items-center gap-2 mb-1 text-blue-700 font-medium text-xs uppercase">
            <CreditCard className="w-3.5 h-3.5" /> Crédito
          </div>
          <span className="text-lg font-bold text-gray-800">{formatCurrency(spentCredit)}</span>
        </div>
      </div>
    </div>
  );
};

// 3. Transaction List
interface TransactionListProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onEdit: (t: Transaction) => void;
}
const TransactionList: React.FC<TransactionListProps> = ({ transactions, onDelete, onEdit }) => {
  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatDate = (dateStr: string) => { const [year, month, day] = dateStr.split('-'); return `${day}/${month}`; };

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
        <p className="text-gray-400">Nenhum gasto registrado este mês.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <h3 className="font-semibold text-gray-700">Histórico</h3>
      </div>
      <div className="divide-y divide-gray-100">
        {transactions.map((t) => (
          <div key={t.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors group">
            <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
              <div className={`p-2 rounded-full shrink-0 ${t.method === 'CREDIT' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                {t.method === 'CREDIT' ? <CreditCard className="w-5 h-5" /> : <Banknote className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">{t.description}</p>
                <p className="text-xs text-gray-500">
                  {formatDate(t.date)} às {t.time || '00:00'} • {t.method === 'CREDIT' ? 'Crédito' : 'Débito'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 shrink-0 pl-2">
              <span className="font-semibold text-gray-900 whitespace-nowrap text-sm sm:text-base">- {formatCurrency(t.amount)}</span>
              <div className="flex gap-1">
                <button onClick={() => onEdit(t)} className="text-gray-300 hover:text-blue-500 transition-colors p-1.5"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => onDelete(t.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1.5"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- APP COMPONENT ---
const App: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState<string>(() => {
    const now = new Date();
    const local = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString();
    return local.slice(0, 7);
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budget, setBudget] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [txs, limit] = await Promise.all([
        dbService.getTransactionsByMonth(currentMonth),
        dbService.getMonthlyBudget(currentMonth)
      ]);
      setTransactions(txs);
      setBudget(limit);
    } catch (error) { console.error("Failed to load data", error); } 
    finally { setIsLoading(false); }
  }, [currentMonth]);

  useEffect(() => { loadData(); }, [loadData]);

  const totalSpent = transactions.reduce((acc, t) => acc + t.amount, 0);
  const spentDebit = transactions.filter(t => t.method === 'DEBIT').reduce((acc, t) => acc + t.amount, 0);
  const spentCredit = transactions.filter(t => t.method === 'CREDIT').reduce((acc, t) => acc + t.amount, 0);

  const handleAddTransaction = async (data: Omit<Transaction, 'id' | 'createdAt'>) => {
    await dbService.addTransaction({ ...data, id: crypto.randomUUID(), createdAt: Date.now() });
    loadData(); 
  };
  const handleUpdateTransaction = async (id: string, data: Omit<Transaction, 'id' | 'createdAt'>) => {
    const original = transactions.find(t => t.id === id);
    await dbService.updateTransaction({ id, createdAt: original ? original.createdAt : Date.now(), ...data });
    setEditingTransaction(null);
    loadData();
  };
  const handleDeleteTransaction = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja apagar este gasto?')) return;
    await dbService.deleteTransaction(id);
    if (editingTransaction?.id === id) setEditingTransaction(null);
    loadData();
  };
  const handleUpdateLimit = async (newLimit: number) => {
    await dbService.setMonthlyBudget({ month: currentMonth, limit: newLimit });
    setBudget(newLimit);
  };
  const changeMonth = (offset: number) => {
    const [year, month] = currentMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    setCurrentMonth(date.toISOString().slice(0, 7));
    setEditingTransaction(null);
  };
  const handleClearData = async () => {
    if (window.confirm('Apagar TODOS os dados de TODOS os meses? Isso não pode ser desfeito.')) {
        await dbService.clearAllData();
        loadData();
        alert('Dados apagados.');
    }
  };
  const handleBackup = async () => {
    try {
      const data = await dbService.exportDatabase();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const now = new Date();
      const filename = `GestorGastos_${now.toLocaleDateString('sv')}_${now.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'}).replace(':','-')}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (e) { alert('Erro no backup: ' + e); }
  };
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !window.confirm('Isso irá substituir TODOS os dados atuais. Continuar?')) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        await dbService.importDatabase(JSON.parse(ev.target?.result as string));
        alert('Restaurado com sucesso!');
        loadData();
      } catch (err) { alert('Arquivo inválido.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };
  const formattedMonth = new Date(currentMonth + "-02").toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center pb-20">
      <div className="w-full max-w-md px-4 py-8" ref={topRef}>
        <header className="mb-8 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-white rounded-full shadow-sm mb-4"><span className="text-3xl">💰</span></div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Gestor de Gastos</h1>
          <div className="flex items-center justify-center gap-4 mt-4 bg-white inline-flex rounded-lg p-1 shadow-sm border border-gray-200">
            <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-100 rounded-md transition-colors"><ChevronLeft className="w-5 h-5 text-gray-600" /></button>
            <div className="flex items-center gap-2 px-2"><Calendar className="w-4 h-4 text-gray-400" /><span className="font-semibold text-gray-700 min-w-[140px] text-center">{formattedMonth.charAt(0).toUpperCase() + formattedMonth.slice(1)}</span></div>
            <button onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-100 rounded-md transition-colors"><ChevronRight className="w-5 h-5 text-gray-600" /></button>
          </div>
        </header>

        {isLoading ? <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div> : (
          <main>
            <Summary totalSpent={totalSpent} spentDebit={spentDebit} spentCredit={spentCredit} limit={budget} onUpdateLimit={handleUpdateLimit} />
            <TransactionForm initialData={editingTransaction} onAdd={handleAddTransaction} onUpdate={handleUpdateTransaction} onCancelEdit={() => setEditingTransaction(null)} />
            <TransactionList transactions={transactions} onDelete={handleDeleteTransaction} onEdit={(t) => { setEditingTransaction(t); topRef.current?.scrollIntoView({ behavior: 'smooth' }); }} />
            
            <div className="mt-12 border-t border-gray-200 pt-8">
              <button onClick={() => setShowSettings(!showSettings)} className="flex items-center gap-2 text-gray-500 font-medium text-sm hover:text-gray-800 transition-colors mx-auto mb-4">
                <Settings className="w-4 h-4" /> {showSettings ? 'Ocultar Opções' : 'Gerenciar Dados'}
              </button>
              {showSettings && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 animate-in slide-in-from-top-2 fade-in duration-300 space-y-3">
                  <button onClick={handleBackup} className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-emerald-50 hover:text-emerald-700 transition-all"><span className="flex items-center gap-2 font-medium"><Download className="w-4 h-4" /> Backup</span></button>
                  <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-blue-50 hover:text-blue-700 transition-all"><span className="flex items-center gap-2 font-medium"><Upload className="w-4 h-4" /> Restaurar</span></button>
                  <input type="file" accept=".json" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                  <div className="h-px bg-gray-100 my-2"></div>
                  <button onClick={handleClearData} className="w-full flex items-center justify-between p-3 rounded-lg border border-red-100 bg-red-50 text-red-700 hover:bg-red-100 transition-all"><span className="flex items-center gap-2 font-medium"><Trash className="w-4 h-4" /> Limpar Tudo</span></button>
                </div>
              )}
            </div>
          </main>
        )}
      </div>
    </div>
  );
};

// --- MOUNT ---
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<React.StrictMode><App /></React.StrictMode>);
}
