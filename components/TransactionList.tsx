import React from 'react';
import { Transaction } from '../types';
import { Trash2, CreditCard, Banknote, Pencil } from 'lucide-react';

interface TransactionListProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onEdit: (t: Transaction) => void;
}

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const formatDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}`;
};

const TransactionList: React.FC<TransactionListProps> = ({ transactions, onDelete, onEdit }) => {
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
              <span className="font-semibold text-gray-900 whitespace-nowrap text-sm sm:text-base">
                - {formatCurrency(t.amount)}
              </span>
              <div className="flex gap-1">
                <button 
                  onClick={() => onEdit(t)}
                  className="text-gray-300 hover:text-blue-500 transition-colors p-1.5"
                  title="Editar"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => onDelete(t.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors p-1.5"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TransactionList;