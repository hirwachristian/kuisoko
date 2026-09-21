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

  // A product's variants can vary by color only, size only, or both - only the dimensions that
  // actually appear among this product's variants are shown/required below. Matches the mobile
  // app's ProductDetailScreen, which already handled this correctly.
  const hasColors = variants.some(v => v.color);
  const hasSizes = variants.some(v => v.size);

  const colors = Array.from(new Set(variants.map(v => v.color).filter((c): c is string => !!c)));
  const sizes = Array.from(new Set(variants.map(v => v.size).filter((s): s is string => !!s))).sort(compareSizes);

  // A color is only pickable if it has any stock left in *some* size - still shown (with its
  // swatch/photo) so the option stays visible, just disabled, rather than quietly disappearing.
  const colorStock = (color: string) => variants.filter(v => v.color === color).reduce((sum, v) => sum + v.stock, 0);

  // Once a color is chosen, a size is only pickable if that specific color+size combination
  // exists and actually has stock - a size with no stock in this color (even if it exists for a
  // *different* color) is shown but disabled, not hidden, so the size grid doesn't reshuffle
  // every time the color changes. For a size-only product (no color dimension at all), a size is
  // matched against its own stock directly instead of waiting on a color that will never come.
  const sizeVariant = (size: string) => {
    if (hasColors && !selectedColor) return undefined;
    return variants.find(v => (hasColors ? v.color === selectedColor : true) && v.size === size);
  };
  const isSizeDisabled = (size: string) => {
    if (hasColors && !selectedColor) return false;
    const variant = sizeVariant(size);
    return !variant || variant.stock <= 0;
  };

  // If the color changes out from under an already-picked size that's no longer valid for it
  // (different color, no stock, or doesn't come in that size), drop the now-invalid size instead
  // of silently leaving an impossible color+size pair selected.
  useEffect(() => {
    if (hasSizes && selectedSize && isSizeDisabled(selectedSize)) {
      setSelectedSize(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedColor]);

  useEffect(() => {
    const variant = variants.find(v =>
      (hasColors ? v.color === selectedColor : true) && (hasSizes ? v.size === selectedSize : true)
    );
    onVariantSelect(variant || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedColor, selectedSize, variants, onVariantSelect]);

  useEffect(() => {
    onColorChange?.(selectedColor);
  }, [selectedColor, onColorChange]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Colors - shown as named text chips (matching the Size chips below, and the mobile app's
          own variant chips) rather than color swatches, since a swatch can't represent a color
          name accurately (e.g. "Navy" vs "Midnight Blue" render identically) and doesn't work at
          all for multi-word/non-CSS color names from admin-entered variant data. Only rendered
          when this product actually has a color dimension - a size-only product has no use for it. */}
      {hasColors && (
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
                  className={`relative px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md border ${
                    selectedColor === color
                      ? 'border-orange-500 bg-orange-100 text-orange-800'
                      : outOfStock
                      ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                      : 'border-slate-300 text-slate-900 hover:border-slate-400'
                  }`}
                >
                  {color}
                  {outOfStock && (
                    <span className="absolute inset-0 flex items-center" aria-hidden="true">
                      <span className="w-full h-[1.5px] bg-slate-300" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Sizes - only rendered when this product actually has a size dimension. */}
      {hasSizes && (
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
                  title={disabled ? (hasColors ? `${size} - out of stock in ${selectedColor}` : `${size} - out of stock`) : size}
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
      )}
    </div>
  );
};

export default VariantSelector;
