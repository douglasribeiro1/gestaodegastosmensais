import React, { useState } from 'react';
import { Pencil, Check, CreditCard, Banknote } from 'lucide-react';

interface SummaryProps {
  totalSpent: number;
  spentDebit: number;
  spentCredit: number;
  limit: number;
  onUpdateLimit: (newLimit: number) => void;
}

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const Summary: React.FC<SummaryProps> = ({ totalSpent, spentDebit, spentCredit, limit, onUpdateLimit }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const remaining = limit - totalSpent;
  const percentage = limit > 0 ? Math.min((totalSpent / limit) * 100, 100) : 0;
  
  // Color logic
  let progressColor = 'bg-emerald-500';
  let remainingTextColor = 'text-emerald-600';
  
  if (percentage > 75) {
    progressColor = 'bg-orange-500';
    remainingTextColor = 'text-orange-600';
  }
  if (percentage >= 100) {
    progressColor = 'bg-red-500';
    remainingTextColor = 'text-red-600';
  }

  const startEditing = () => {
    // Ao iniciar edição, formata o valor atual
    setEditValue(limit.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    setIsEditing(true);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value === '') {
      setEditValue('');
      return;
    }
    const numberValue = parseInt(value, 10) / 100;
    setEditValue(numberValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
  };

  const handleSave = () => {
    if (!editValue) return;
    
    // Converte a string formatada "1.250,50" -> 1250.50
    const rawValue = editValue.replace(/\./g, '').replace(',', '.');
    const val = parseFloat(rawValue);

    if (!isNaN(val) && val >= 0) {
      onUpdateLimit(val);
    }
    setIsEditing(false);
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
      {/* Top Section: Remaining & Limit */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-gray-500 text-sm font-medium uppercase tracking-wide">Saldo Restante</h2>
          <div className={`text-4xl font-bold mt-1 ${remainingTextColor}`}>
            {formatCurrency(remaining)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-gray-500 text-xs uppercase tracking-wide mb-1">Limite Mensal</div>
          {isEditing ? (
            <div className="flex items-center justify-end gap-2">
              <input 
                type="tel"
                inputMode="numeric"
                value={editValue} 
                onChange={handleEditChange}
                className="w-24 text-right border-b border-gray-300 focus:border-gray-900 outline-none font-semibold text-gray-900"
                autoFocus
                placeholder="0,00"
              />
              <button onClick={handleSave} className="text-emerald-600 hover:text-emerald-700">
                <Check className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2 text-gray-900 font-semibold">
              {formatCurrency(limit)}
              <button onClick={startEditing} className="text-gray-400 hover:text-gray-600">
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative pt-1 mb-6">
        <div className="flex mb-2 items-center justify-between text-xs font-semibold text-gray-500">
          <span>Total Gasto: {formatCurrency(totalSpent)}</span>
          <span>{percentage.toFixed(0)}%</span>
        </div>
        <div className="overflow-hidden h-3 mb-1 text-xs flex rounded bg-gray-100">
          <div
            style={{ width: `${percentage}%` }}
            className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-500 ${progressColor}`}
          ></div>
        </div>
      </div>

      {/* Breakdown Section */}
      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100">
        <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 flex flex-col">
          <div className="flex items-center gap-2 mb-1 text-emerald-700 font-medium text-xs uppercase">
            <Banknote className="w-3.5 h-3.5" />
            Débito
          </div>
          <span className="text-lg font-bold text-gray-800">
            {formatCurrency(spentDebit)}
          </span>
        </div>

        <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex flex-col">
          <div className="flex items-center gap-2 mb-1 text-blue-700 font-medium text-xs uppercase">
            <CreditCard className="w-3.5 h-3.5" />
            Crédito
          </div>
          <span className="text-lg font-bold text-gray-800">
            {formatCurrency(spentCredit)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Summary;