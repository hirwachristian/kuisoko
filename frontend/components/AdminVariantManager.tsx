import React, { useState } from 'react';
import { ProductVariant } from '../types';
import { Plus, Trash2, Wand2, Check, PackageX, AlertTriangle } from 'lucide-react';
import { AVAILABLE_COLORS } from '../constants';

interface AdminVariantManagerProps {
  variants: ProductVariant[];
  onChange: (variants: ProductVariant[]) => void;
  /** Already-uploaded product image URLs, offered as the pool to assign a photo from. */
  images: string[];
  /** Maps a variant color to one of `images` - see Product.colorImages. */
  colorImages: Record<string, string>;
  onColorImagesChange: (colorImages: Record<string, string>) => void;
  /** The product's own overall stock count - variant stock is a breakdown of it, so it can never
   * add up to more than this. */
  productStock: number;
}

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const AdminVariantManager: React.FC<AdminVariantManagerProps> = ({ variants, onChange, images, colorImages, onColorImagesChange, productStock }) => {
  const [selectedBulkColors, setSelectedBulkColors] = useState<string[]>([]);
  const [bulkSizes, setBulkSizes] = useState('');
  const [newColorName, setNewColorName] = useState('');

  const generateVariants = () => {
    const sizes = bulkSizes.split(',').map(s => s.trim()).filter(s => s !== '');
    const newVariants: ProductVariant[] = [];

    selectedBulkColors.forEach(color => {
      sizes.forEach(size => {
        newVariants.push({ id: newId(), sku: `${color}-${size}-${Date.now()}`, color, size, price: 0, stock: 0 });
      });
    });

    onChange([...variants, ...newVariants]);
    setSelectedBulkColors([]);
    setBulkSizes('');
  };

  // Keyed by variant id (not array index) so removing one row elsewhere, or a grouped-by-color
  // re-render, can never shift which row an edit lands on.
  const updateVariant = (id: string, field: keyof ProductVariant, value: string | number) => {
    onChange(variants.map(v => (v.id === id ? { ...v, [field]: value } : v)));
  };

  const removeVariant = (id: string) => {
    onChange(variants.filter(v => v.id !== id));
  };

  const addSizeToColor = (color: string) => {
    onChange([...variants, { id: newId(), sku: '', color, size: '', price: 0, stock: 0 }]);
  };

  // A size-only variant (no color at all) - the counterpart to "Add color" below, for a product
  // that varies by size but not color. Lands in the "Sizes without a color" list underneath.
  const addSizeOnlyVariant = () => {
    onChange([...variants, { id: newId(), sku: '', color: '', size: '', price: 0, stock: 0 }]);
  };

  const addNewColor = () => {
    const color = newColorName.trim();
    if (!color) return;
    onChange([...variants, { id: newId(), sku: '', color, size: '', price: 0, stock: 0 }]);
    setNewColorName('');
  };

  const removeColor = (color: string) => {
    onChange(variants.filter(v => v.color !== color));
    if (colorImages[color]) {
      const rest = { ...colorImages };
      delete rest[color];
      onColorImagesChange(rest);
    }
  };

  const setColorImage = (color: string, url: string) => {
    onColorImagesChange({ ...colorImages, [color]: url });
  };

  // Grouped by color, in first-appearance order, so bulk-generated colors don't reshuffle as
  // their rows are edited. Variants with no color (a plain size-only product, or one mid-edit)
  // fall into their own bucket below rather than being lost.
  const colorOrder: string[] = [];
  const grouped = new Map<string, ProductVariant[]>();
  const uncategorized: ProductVariant[] = [];
  variants.forEach((v) => {
    const color = v.color?.trim();
    if (!color) {
      uncategorized.push(v);
      return;
    }
    if (!grouped.has(color)) {
      grouped.set(color, []);
      colorOrder.push(color);
    }
    grouped.get(color)!.push(v);
  });

  const totalVariantStock = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
  const overAllocated = totalVariantStock > productStock;

  const rowInputClass = 'px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white';

  return (
    <div className="space-y-6">
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

      {/* Grouped by color - each card owns its sizes, stock, and representative photo together */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-emerald-300">Product Variants</h4>
          {variants.length > 0 && (
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${overAllocated ? 'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
              {overAllocated && <AlertTriangle size={12} />}
              {totalVariantStock} / {productStock} stock allocated
            </span>
          )}
        </div>
        {overAllocated && (
          <p className="text-xs text-rose-600 dark:text-rose-400 -mt-2">
            Variant stock adds up to more than the product's total stock ({productStock}). Lower some variant stock, or raise the product's total stock above, before saving.
          </p>
        )}

        {colorOrder.length === 0 && uncategorized.length === 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400">No variants yet - use Bulk Generate above, or add a color below.</p>
        )}

        {colorOrder.map((color) => {
          const colorVariants = grouped.get(color)!;
          const totalStock = colorVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
          return (
            <div key={color} className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-700 shrink-0" style={{ backgroundColor: color.toLowerCase() }} />
                  <span className="font-bold text-sm text-slate-900 dark:text-white truncate">{color}</span>
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${totalStock > 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400'}`}>
                    {totalStock <= 0 && <PackageX size={11} />}
                    {totalStock > 0 ? `${totalStock} in stock` : 'Out of stock'}
                  </span>
                </div>
                <button type="button" onClick={() => removeColor(color)} className="shrink-0 text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1">
                  <Trash2 size={14} /> Remove color
                </button>
              </div>

              {images.length > 0 ? (
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 block">Photo shown when a customer picks {color}</label>
                  <div className="flex flex-wrap gap-2">
                    {images.map((url) => {
                      const isSelected = colorImages[color] === url;
                      return (
                        <button
                          key={url}
                          type="button"
                          onClick={() => setColorImage(color, url)}
                          title={`Use this photo for ${color}`}
                          className={`relative w-12 h-12 rounded-lg overflow-hidden border-2 shrink-0 ${isSelected ? 'border-emerald-600' : 'border-slate-200 dark:border-slate-800 hover:border-emerald-300'}`}
                        >
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          {isSelected && (
                            <span className="absolute inset-0 bg-emerald-600/30 flex items-center justify-center">
                              <Check size={16} className="text-white" strokeWidth={3} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-amber-600 dark:text-amber-400">Upload product images above to assign one to this color.</p>
              )}

              <div className="space-y-2">
                <label className="text-xs text-slate-500 dark:text-slate-400 block">Sizes, price &amp; stock</label>
                {colorVariants.map((variant) => (
                  <div key={variant.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                    <input type="text" placeholder="Size" value={variant.size} onChange={(e) => updateVariant(variant.id, 'size', e.target.value)} className={rowInputClass} />
                    <input type="number" placeholder="Price" value={isNaN(variant.price) ? '' : variant.price} onChange={(e) => updateVariant(variant.id, 'price', e.target.value === '' ? 0 : parseFloat(e.target.value))} className={rowInputClass} />
                    <input type="number" placeholder="Stock" value={isNaN(variant.stock) ? '' : variant.stock} onChange={(e) => updateVariant(variant.id, 'stock', e.target.value === '' ? 0 : parseInt(e.target.value))} className={rowInputClass} />
                    <button type="button" onClick={() => removeVariant(variant.id)} className="text-rose-500 hover:text-rose-700 p-2" aria-label={`Remove ${color} ${variant.size || 'size'}`}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => addSizeToColor(color)} className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                  <Plus size={14} /> Add size
                </button>
              </div>
            </div>
          );
        })}

        {/* Variants with no color set - a plain size-only product, or a row still being filled in.
            "Add size" is the counterpart to "Add color" below, for a product that varies by size
            but not color - each row's own Color field stays blank on purpose. */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400">Sizes without a color</h5>
            <button type="button" onClick={addSizeOnlyVariant} className="text-xs text-emerald-600 font-bold flex items-center gap-1 shrink-0">
              <Plus size={14} /> Add size
            </button>
          </div>
          {uncategorized.map((variant) => (
            <div key={variant.id} className="grid grid-cols-5 gap-2">
              <input type="text" placeholder="Color" value={variant.color} onChange={(e) => updateVariant(variant.id, 'color', e.target.value)} className={rowInputClass} />
              <input type="text" placeholder="Size" value={variant.size} onChange={(e) => updateVariant(variant.id, 'size', e.target.value)} className={rowInputClass} />
              <input type="number" placeholder="Price" value={isNaN(variant.price) ? '' : variant.price} onChange={(e) => updateVariant(variant.id, 'price', e.target.value === '' ? 0 : parseFloat(e.target.value))} className={rowInputClass} />
              <input type="number" placeholder="Stock" value={isNaN(variant.stock) ? '' : variant.stock} onChange={(e) => updateVariant(variant.id, 'stock', e.target.value === '' ? 0 : parseInt(e.target.value))} className={rowInputClass} />
              <button type="button" onClick={() => removeVariant(variant.id)} className="text-rose-500 hover:text-rose-700 p-2 justify-self-start"><Trash2 size={18} /></button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newColorName}
            onChange={(e) => setNewColorName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNewColor(); } }}
            placeholder="New color name (e.g. Maroon)"
            className={`flex-1 ${rowInputClass}`}
          />
          <button type="button" onClick={addNewColor} className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-bold flex items-center gap-1 shrink-0">
            <Plus size={16} /> Add color
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminVariantManager;
