import React, { useState, useEffect } from 'react';
import { ProductVariant } from '../types';

interface VariantSelectorProps {
  variants: ProductVariant[];
  onVariantSelect: (variant: ProductVariant | null) => void;
}

const VariantSelector: React.FC<VariantSelectorProps> = ({ variants, onVariantSelect }) => {
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const colors = Array.from(new Set(variants.map(v => v.color)));
  const sizes = Array.from(new Set(variants.map(v => v.size)));

  useEffect(() => {
    const variant = variants.find(v => v.color === selectedColor && v.size === selectedSize);
    onVariantSelect(variant || null);
  }, [selectedColor, selectedSize, variants, onVariantSelect]);

  return (
    <div className="space-y-6">
      {/* Colors */}
      <div>
        <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-3">Color</h3>
        <div className="flex flex-wrap gap-3">
          {colors.map(color => (
            <button
              key={color}
              onClick={() => setSelectedColor(color)}
              className={`w-10 h-10 rounded-full border-2 ${
                selectedColor === color ? 'border-indigo-600' : 'border-transparent'
              }`}
              style={{ backgroundColor: color.toLowerCase() }}
              title={color}
            />
          ))}
        </div>
      </div>

      {/* Sizes */}
      <div>
        <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-3">Size</h3>
        <div className="grid grid-cols-4 gap-3">
          {sizes.map(size => (
            <button
              key={size}
              onClick={() => setSelectedSize(size)}
              className={`py-2 text-sm font-medium rounded-md border ${
                selectedSize === size
                  ? 'border-orange-500 bg-orange-100 text-orange-800'
                  : 'border-slate-300 text-slate-900 hover:border-slate-400'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VariantSelector;
