import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Transaction } from './types';
import * as db from './services/db';
import Summary from './components/Summary';
import TransactionForm from './components/TransactionForm';
import TransactionList from './components/TransactionList';
import { ChevronLeft, ChevronRight, Calendar, Settings, Download, Upload, Trash, Database } from 'lucide-react';

const App: React.FC = () => {
  // State
  const [currentMonth, setCurrentMonth] = useState<string>(() => {
    const now = new Date();
    // Ajuste para garantir timezone local ao inicializar o mês
    const local = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString();
    return local.slice(0, 7); // YYYY-MM
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budget, setBudget] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // Edit State
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Settings UI State
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived state
  const totalSpent = transactions.reduce((acc, t) => acc + t.amount, 0);
  
  const spentDebit = transactions
    .filter(t => t.method === 'DEBIT')
    .reduce((acc, t) => acc + t.amount, 0);

  const spentCredit = transactions
    .filter(t => t.method === 'CREDIT')
    .reduce((acc, t) => acc + t.amount, 0);

  // Load data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [txs, limit] = await Promise.all([
        db.getTransactionsByMonth(currentMonth),
        db.getMonthlyBudget(currentMonth)
      ]);
      setTransactions(txs);
      setBudget(limit);
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handlers CRUD
  const handleAddTransaction = async (data: Omit<Transaction, 'id' | 'createdAt'>) => {
    const newTransaction: Transaction = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    await db.addTransaction(newTransaction);
    loadData(); 
  };

  const handleUpdateTransaction = async (id: string, data: Omit<Transaction, 'id' | 'createdAt'>) => {
    // Preserve createdAt from original if possible, otherwise use now.
    // Since we pass data without id/created at from form, we need to reconstruct.
    const original = transactions.find(t => t.id === id);
    const updatedTransaction: Transaction = {
      id,
      createdAt: original ? original.createdAt : Date.now(),
      ...data
    };
    
    await db.updateTransaction(updatedTransaction);
    setEditingTransaction(null);
    loadData();
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja apagar este gasto?')) return;
    await db.deleteTransaction(id);
    if (editingTransaction?.id === id) setEditingTransaction(null);
    loadData();
  };

  const handleEditClick = (t: Transaction) => {
    setEditingTransaction(t);
    // Scroll to top smoothly
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleUpdateLimit = async (newLimit: number) => {
    await db.setMonthlyBudget({ month: currentMonth, limit: newLimit });
    setBudget(newLimit);
  };

  // Month Navigation
  const changeMonth = (offset: number) => {
    const [year, month] = currentMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    const newMonthStr = date.toISOString().slice(0, 7);
    setCurrentMonth(newMonthStr);
    setEditingTransaction(null); // Cancel edit on month change
  };

  // Data Management Handlers
  const handleClearData = async () => {
    if (window.confirm('PERIGO: Isso apagará TODOS os seus dados e registros de todos os meses. Tem certeza absoluta?')) {
      if (window.confirm('Última chance: Todos os dados serão perdidos. Confirmar limpeza?')) {
        await db.clearAllData();
        loadData();
        alert('Todos os dados foram apagados.');
      }
    }
  };

  const handleBackup = async () => {
    try {
      const data = await db.exportDatabase();
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      const now = new Date();
      // Format: GestorGastos_YYYY-MM-DD_HH-mm.json
      const dateStr = now.toLocaleDateString('sv'); // YYYY-MM-DD
      const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).replace(':', '-');
      
      const filename = `GestorGastos_${dateStr}_${timeStr}.json`;
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Erro ao criar backup: ' + e);
    }
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm(`Isso irá SOBRESCREVER todos os dados atuais com os dados do arquivo "${file.name}". Deseja continuar?`)) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = event.target?.result as string;
        const data = JSON.parse(json);
        
        // Basic validation
        if (!data.transactions || !data.budgets) {
          throw new Error("Arquivo de backup inválido.");
        }

        await db.importDatabase(data);
        alert('Backup restaurado com sucesso!');
        loadData();
      } catch (err) {
        alert('Erro ao restaurar backup: Arquivo inválido ou corrompido.');
        console.error(err);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  // Formatting Month Header
  const formattedMonth = new Date(currentMonth + "-02")
    .toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center pb-20">
      <div className="w-full max-w-md px-4 py-8" ref={topRef}>
        {/* Header */}
        <header className="mb-8 text-center relative">
          <div className="inline-flex items-center justify-center p-3 bg-white rounded-full shadow-sm mb-4">
            <span className="text-3xl">💰</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Gestor de Gastos</h1>
          
          {/* Month Selector */}
          <div className="flex items-center justify-center gap-4 mt-4 bg-white inline-flex rounded-lg p-1 shadow-sm border border-gray-200">
            <button 
              onClick={() => changeMonth(-1)}
              className="p-1 hover:bg-gray-100 rounded-md transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex items-center gap-2 px-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="font-semibold text-gray-700 min-w-[140px] text-center">
                {capitalize(formattedMonth)}
              </span>
            </div>
            <button 
              onClick={() => changeMonth(1)}
              className="p-1 hover:bg-gray-100 rounded-md transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </header>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <main>
            <Summary 
              totalSpent={totalSpent} 
              spentDebit={spentDebit}
              spentCredit={spentCredit}
              limit={budget} 
              onUpdateLimit={handleUpdateLimit}
            />

            <TransactionForm 
              initialData={editingTransaction}
              onAdd={handleAddTransaction}
              onUpdate={handleUpdateTransaction}
              onCancelEdit={() => setEditingTransaction(null)}
            />

            <TransactionList 
              transactions={transactions} 
              onDelete={handleDeleteTransaction}
              onEdit={handleEditClick}
            />

            {/* Data Management Section */}
            <div className="mt-12 border-t border-gray-200 pt-8">
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center gap-2 text-gray-500 font-medium text-sm hover:text-gray-800 transition-colors mx-auto mb-4"
              >
                <Settings className="w-4 h-4" />
                {showSettings ? 'Ocultar Opções de Dados' : 'Gerenciar Dados / Backup'}
              </button>

              {showSettings && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 animate-in slide-in-from-top-2 fade-in duration-300">
                  <div className="space-y-3">
                    <button 
                      onClick={handleBackup}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-all group"
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <Download className="w-4 h-4" /> Backup (Salvar)
                      </span>
                      <span className="text-xs text-gray-400 group-hover:text-emerald-500">Baixar JSON</span>
                    </button>

                    <button 
                      onClick={handleRestoreClick}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-all group"
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <Upload className="w-4 h-4" /> Restaurar Backup
                      </span>
                      <span className="text-xs text-gray-400 group-hover:text-blue-500">Enviar JSON</span>
                    </button>
                    {/* Hidden input for file upload */}
                    <input 
                      type="file" 
                      accept=".json" 
                      ref={fileInputRef} 
                      className="hidden" 
                      onChange={handleFileChange}
                    />

                    <div className="h-px bg-gray-100 my-2"></div>

                    <button 
                      onClick={handleClearData}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-red-100 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-200 transition-all"
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <Trash className="w-4 h-4" /> Limpar Tudo
                      </span>
                      <span className="text-xs text-red-500">Apaga todos os dados</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </main>
        )}
        
        <footer className="mt-8 text-center text-xs text-gray-400">
          <p className="flex items-center justify-center gap-1">
            <Database className="w-3 h-3" />
            Dados armazenados localmente (IndexedDB)
          </p>
        </footer>
      </div>
    </div>
  );
};

export default App;