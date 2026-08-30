import React, { useState } from 'react';
import { ProductVariant } from '../types';
import { Plus, Trash2, Wand2 } from 'lucide-react';
import { AVAILABLE_COLORS } from '../constants';

interface AdminVariantManagerProps {
  variants: ProductVariant[];
  onChange: (variants: ProductVariant[]) => void;
}

const AdminVariantManager: React.FC<AdminVariantManagerProps> = ({ variants, onChange }) => {
  const [selectedBulkColors, setSelectedBulkColors] = useState<string[]>([]);
  const [bulkSizes, setBulkSizes] = useState('');

  const generateVariants = () => {
    const sizes = bulkSizes.split(',').map(s => s.trim()).filter(s => s !== '');
    const newVariants: ProductVariant[] = [];
    
    selectedBulkColors.forEach(color => {
      sizes.forEach(size => {
        newVariants.push({
          id: Date.now().toString() + Math.random(),
          sku: `${color}-${size}-${Date.now()}`,
          color,
          size,
          price: 0,
          stock: 0
        });
      });
    });

    onChange([...variants, ...newVariants]);
    setSelectedBulkColors([]);
    setBulkSizes('');
  };

  const addVariant = () => {
    onChange([...variants, { id: Date.now().toString(), sku: '', color: '', size: '', price: 0, stock: 0 }]);
  };

  const updateVariant = (index: number, field: keyof ProductVariant, value: string | number) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeVariant = (index: number) => {
    onChange(variants.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {/* Bulk Generator */}
      <div className="p-4 border border-indigo-100 dark:border-indigo-900 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 space-y-4">
        <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-300 flex items-center gap-2"><Wand2 size={16} /> Bulk Generate Variants</h4>
        <div>
          <label className="text-xs text-indigo-700 dark:text-indigo-400 mb-1 block">Select Colors</label>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_COLORS.map(color => (
              <button
                key={color}
                type="button"
                onClick={() => setSelectedBulkColors(prev => prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color])}
                className={`px-3 py-1 rounded-full text-xs font-medium border ${selectedBulkColors.includes(color) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-slate-900 text-indigo-900 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800'}`}
              >
                {color}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-indigo-700 dark:text-indigo-400 mb-1 block">Sizes (comma separated: S, M, L or 40, 41)</label>
          <input type="text" value={bulkSizes} onChange={(e) => setBulkSizes(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white" placeholder="e.g., S, M, L" />
        </div>
        <button type="button" onClick={generateVariants} className="w-full bg-emerald-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-emerald-700">Generate Variants</button>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-emerald-300">Product Variants</h4>
          <button type="button" onClick={addVariant} className="text-sm text-emerald-600 font-bold flex items-center gap-1">
            <Plus size={16} /> Add Individual
          </button>
        </div>
        {variants.map((variant, index) => (
          <div key={index} className="grid grid-cols-4 gap-2">
            <input type="text" placeholder="Color" value={variant.color} onChange={(e) => updateVariant(index, 'color', e.target.value)} className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white" />
            <input type="text" placeholder="Size" value={variant.size} onChange={(e) => updateVariant(index, 'size', e.target.value)} className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white" />
            <input type="number" placeholder="Price" value={isNaN(variant.price) ? '' : variant.price} onChange={(e) => updateVariant(index, 'price', e.target.value === '' ? 0 : parseFloat(e.target.value))} className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white" />
            <div className="flex gap-2">
              <input type="number" placeholder="Stock" value={isNaN(variant.stock) ? '' : variant.stock} onChange={(e) => updateVariant(index, 'stock', e.target.value === '' ? 0 : parseInt(e.target.value))} className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white w-full" />
              <button type="button" onClick={() => removeVariant(index)} className="text-rose-500 hover:text-rose-700 p-2"><Trash2 size={18} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminVariantManager;
