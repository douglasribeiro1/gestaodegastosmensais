import React, { useState, useEffect } from 'react';
import { PaymentMethod, Transaction } from '../types';
import { PlusCircle, CreditCard, Banknote, Save, X } from 'lucide-react';

interface TransactionFormProps {
  initialData?: Transaction | null;
  onAdd: (t: Omit<Transaction, 'id' | 'createdAt'>) => void;
  onUpdate: (id: string, t: Omit<Transaction, 'id' | 'createdAt'>) => void;
  onCancelEdit: () => void;
}

const TransactionForm: React.FC<TransactionFormProps> = ({ 
  initialData, 
  onAdd, 
  onUpdate, 
  onCancelEdit 
}) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('DEBIT');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  // Define data/hora atuais ao montar ou resetar
  const setNow = () => {
    const now = new Date();
    const localDate = now.toLocaleDateString('sv'); 
    const localTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    setDate(localDate);
    setTime(localTime);
  };

  useEffect(() => {
    if (initialData) {
      setDescription(initialData.description);
      // Formata o valor existente para o padrão brasileiro (Ex: 1250.50 vira 1.250,50)
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
    // Remove tudo que não é dígito
    const value = e.target.value.replace(/\D/g, '');
    
    if (value === '') {
      setAmount('');
      return;
    }

    // Converte para número (centavos) e formata
    const numberValue = parseInt(value, 10) / 100;
    setAmount(numberValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || !date || !time) return;

    // Converte a string formatada "1.250,50" de volta para float 1250.50
    // 1. Remove pontos de milhar
    // 2. Troca vírgula decimal por ponto
    const rawValue = amount.replace(/\./g, '').replace(',', '.');
    const val = parseFloat(rawValue);
    
    if (isNaN(val) || val <= 0) return;

    const formData = {
      description,
      amount: val,
      method,
      date,
      time
    };

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
            type="text"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Supermercado"
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
            <input
              type="tel"
              inputMode="numeric"
              required
              value={amount}
              onChange={handleAmountChange}
              placeholder="0,00"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:col-span-1">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-2 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
              <input
                type="time"
                required
                value={time}
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
              type="button"
              onClick={() => setMethod('DEBIT')}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                method === 'DEBIT'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-medium'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Banknote className="w-4 h-4" />
              Débito
            </button>
            <button
              type="button"
              onClick={() => setMethod('CREDIT')}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                method === 'CREDIT'
                  ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Crédito
            </button>
          </div>
        </div>

        <div className="flex gap-3">
          {initialData && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-lg transition-all"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            className={`flex-1 font-semibold py-3 rounded-lg shadow-md hover:shadow-lg transition-all active:scale-[0.98] text-white ${initialData ? 'bg-amber-600 hover:bg-amber-700' : 'bg-gray-900 hover:bg-black'}`}
          >
            {initialData ? 'Salvar Alterações' : 'Adicionar Gasto'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TransactionForm;