import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { ProductVariant } from '../types';

interface AdminImageStockManagerProps {
  images: string[];
  /** The product's full variant list - filtered internally to just this product's image-stock
   * rows (imageUrl set); color/size rows are passed straight through untouched on every change,
   * so this and AdminVariantManager can safely share one flat array. */
  variants: ProductVariant[];
  onChange: (variants: ProductVariant[]) => void;
  /** The product's own overall stock count - image stock is a breakdown of it, same rule as
   * color/size variants. */
  productStock: number;
}

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// An alternative to color/size variants for a product that isn't meant to vary by either, but
// still has several photos worth stocking separately (e.g. a few distinct styles shown as plain
// photos). Picking a photo on the product page is the "selection" - there's no separate chip UI.
const AdminImageStockManager: React.FC<AdminImageStockManagerProps> = ({ images, variants, onChange, productStock }) => {
  if (images.length === 0) return null;

  const otherVariants = variants.filter((v) => !v.imageUrl);
  const imageVariants = variants.filter((v) => v.imageUrl);
  const variantForImage = (url: string) => imageVariants.find((v) => v.imageUrl === url);

  const setImageStock = (url: string, stock: number) => {
    const existing = variantForImage(url);
    const updatedImageVariants = existing
      ? imageVariants.map((v) => (v.id === existing.id ? { ...v, stock } : v))
      : [...imageVariants, { id: newId(), sku: '', color: '', size: '', imageUrl: url, price: 0, stock }];
    onChange([...otherVariants, ...updatedImageVariants]);
  };

  // A photo left at price 0 means "no override - use the product's own price", same convention as
  // AdminVariantManager's color/size price - not that the photo is free.
  const setImagePrice = (url: string, price: number) => {
    const existing = variantForImage(url);
    const updatedImageVariants = existing
      ? imageVariants.map((v) => (v.id === existing.id ? { ...v, price } : v))
      : [...imageVariants, { id: newId(), sku: '', color: '', size: '', imageUrl: url, price, stock: 0 }];
    onChange([...otherVariants, ...updatedImageVariants]);
  };

  const totalImageStock = imageVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
  const overAllocated = imageVariants.length > 0 && totalImageStock > productStock;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h4 className="text-sm font-semibold text-slate-700 dark:text-emerald-300">Per-image stock &amp; price (optional)</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Use this instead of colors/sizes above if this product isn't meant to vary by either, but each photo should still have its own stock and, if you want, its own price. Leave stock at 0 to skip a photo; leave price at 0 to use the product's own price for that photo.
          </p>
        </div>
        {imageVariants.length > 0 && (
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0 ${overAllocated ? 'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
            {overAllocated && <AlertTriangle size={12} />}
            {totalImageStock} / {productStock} stock allocated
          </span>
        )}
      </div>
      {overAllocated && (
        <p className="text-xs text-rose-600 dark:text-rose-400 -mt-2">
          Per-image stock adds up to more than the product's total stock ({productStock}). Lower some image stock, or raise the product's total stock above, before saving.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {images.map((url) => {
          const variant = variantForImage(url);
          const stock = variant?.stock ?? 0;
          const price = variant?.price ?? 0;
          return (
            <div key={url} className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex gap-3 items-center">
              <img src={url} alt="" className="w-14 h-14 rounded-lg object-contain bg-white border border-slate-100 dark:border-slate-800 shrink-0" />
              <div className="flex-1 min-w-0 grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block">Stock for this photo</label>
                  <input
                    type="number"
                    min={0}
                    value={isNaN(stock) ? '' : stock}
                    onChange={(e) => setImageStock(url, e.target.value === '' ? 0 : parseInt(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                  {stock > 0 && <span className="text-[10px] font-bold text-emerald-600">{stock} in stock</span>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block">Price for this photo</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="Same as product"
                    value={isNaN(price) ? '' : price}
                    onChange={(e) => setImagePrice(url, e.target.value === '' ? 0 : parseFloat(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                  {price > 0 && <span className="text-[10px] font-bold text-emerald-600">overrides base price</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminImageStockManager;
