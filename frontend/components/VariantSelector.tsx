import React, { useEffect, useState } from 'react';
import { ProductVariant } from '../types';
import { compareSizes } from '../utils';

interface VariantSelectorProps {
  variants: ProductVariant[];
  onVariantSelect: (variant: ProductVariant | null) => void;
  /** Fires the moment a color is picked, before a size is - lets the product page jump its
   * gallery to that color's photo right away rather than waiting on a full variant match. */
  onColorChange?: (color: string | null) => void;
}

const VariantSelector: React.FC<VariantSelectorProps> = ({ variants, onVariantSelect, onColorChange }) => {
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const colors = Array.from(new Set(variants.map(v => v.color)));
  const sizes = Array.from(new Set(variants.map(v => v.size))).sort(compareSizes);

  // A color is only pickable if it has any stock left in *some* size - still shown (with its
  // swatch/photo) so the option stays visible, just disabled, rather than quietly disappearing.
  const colorStock = (color: string) => variants.filter(v => v.color === color).reduce((sum, v) => sum + v.stock, 0);

  // Once a color is chosen, a size is only pickable if that specific color+size combination
  // exists and actually has stock - a size with no stock in this color (even if it exists for a
  // *different* color) is shown but disabled, not hidden, so the size grid doesn't reshuffle
  // every time the color changes.
  const sizeVariant = (size: string) => (selectedColor ? variants.find(v => v.color === selectedColor && v.size === size) : undefined);
  const isSizeDisabled = (size: string) => {
    if (!selectedColor) return false;
    const variant = sizeVariant(size);
    return !variant || variant.stock <= 0;
  };

  // If the color changes out from under an already-picked size that's no longer valid for it
  // (different color, no stock, or doesn't come in that size), drop the now-invalid size instead
  // of silently leaving an impossible color+size pair selected.
  useEffect(() => {
    if (selectedSize && isSizeDisabled(selectedSize)) {
      setSelectedSize(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedColor]);

  useEffect(() => {
    const variant = variants.find(v => v.color === selectedColor && v.size === selectedSize);
    onVariantSelect(variant || null);
  }, [selectedColor, selectedSize, variants, onVariantSelect]);

  useEffect(() => {
    onColorChange?.(selectedColor);
  }, [selectedColor, onColorChange]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Colors */}
      <div>
        <h3 className="text-xs sm:text-sm font-medium text-slate-900 dark:text-white mb-2 sm:mb-3">Color</h3>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {colors.map(color => {
            const outOfStock = colorStock(color) <= 0;
            return (
              <button
                key={color}
                type="button"
                disabled={outOfStock}
                onClick={() => setSelectedColor(prev => (prev === color ? null : color))}
                title={outOfStock ? `${color} - out of stock` : color}
                className={`relative w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 overflow-hidden ${
                  selectedColor === color ? 'border-indigo-600' : 'border-transparent'
                } ${outOfStock ? 'opacity-40 grayscale cursor-not-allowed' : ''}`}
                style={{ backgroundColor: color.toLowerCase() }}
              >
                {outOfStock && (
                  <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                    <span className="w-full h-[2px] bg-slate-900/70 dark:bg-white/70 rotate-45" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sizes */}
      <div>
        <h3 className="text-xs sm:text-sm font-medium text-slate-900 dark:text-white mb-2 sm:mb-3">Size</h3>
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {sizes.map(size => {
            const disabled = isSizeDisabled(size);
            return (
              <button
                key={size}
                type="button"
                disabled={disabled}
                onClick={() => setSelectedSize(prev => (prev === size ? null : size))}
                title={disabled ? `${size} - out of stock in ${selectedColor}` : size}
                className={`relative py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md border ${
                  selectedSize === size
                    ? 'border-orange-500 bg-orange-100 text-orange-800'
                    : disabled
                    ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                    : 'border-slate-300 text-slate-900 hover:border-slate-400'
                }`}
              >
                {size}
                {disabled && (
                  <span className="absolute inset-0 flex items-center" aria-hidden="true">
                    <span className="w-full h-[1.5px] bg-slate-300" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default VariantSelector;
