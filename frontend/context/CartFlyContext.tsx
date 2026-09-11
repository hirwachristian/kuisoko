import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';

interface FlyingItem {
  id: number;
  imageUrl: string;
  startRect: DOMRect;
}

interface CartFlyContextValue {
  /** Attach to the cart icon (Navbar) - the animation's landing spot. */
  cartIconRef: React.RefObject<HTMLElement | null>;
  /** Call from an "Add to Cart" click handler: the product image flies from `sourceElement`
   * (typically the button itself) to the cart icon, then the cart badge bumps. */
  flyToCart: (imageUrl: string, sourceElement: HTMLElement) => void;
  /** Increments every time a fly animation lands - the cart badge watches this to replay its
   * bump animation on each add, not just the first one. */
  cartBumpKey: number;
}

const CartFlyContext = createContext<CartFlyContextValue | undefined>(undefined);

const ITEM_SIZE = 56;

const FlyingImage: React.FC<{
  item: FlyingItem;
  cartIconRef: React.RefObject<HTMLElement | null>;
  onComplete: () => void;
}> = ({ item, cartIconRef, onComplete }) => {
  const targetRect = cartIconRef.current?.getBoundingClientRect();
  if (!targetRect) {
    onComplete();
    return null;
  }

  const startX = item.startRect.left + item.startRect.width / 2 - ITEM_SIZE / 2;
  const startY = item.startRect.top + item.startRect.height / 2 - ITEM_SIZE / 2;
  const endX = targetRect.left + targetRect.width / 2 - ITEM_SIZE / 2;
  const endY = targetRect.top + targetRect.height / 2 - ITEM_SIZE / 2;

  return (
    <motion.img
      src={item.imageUrl}
      initial={{ x: startX, y: startY, scale: 1, opacity: 1 }}
      animate={{ x: endX, y: endY, scale: 0.25, opacity: 0.5 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.65, ease: [0.3, 0.7, 0.4, 1] }}
      onAnimationComplete={onComplete}
      className="fixed top-0 left-0 rounded-xl object-cover shadow-2xl pointer-events-none z-[200] border-2 border-white dark:border-slate-900"
      style={{ width: ITEM_SIZE, height: ITEM_SIZE }}
    />
  );
};

export const CartFlyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const cartIconRef = useRef<HTMLElement | null>(null);
  const [flyingItems, setFlyingItems] = useState<FlyingItem[]>([]);
  const [cartBumpKey, setCartBumpKey] = useState(0);

  const flyToCart = useCallback((imageUrl: string, sourceElement: HTMLElement) => {
    // No cart icon on screen right now (e.g. hidden on an admin/dashboard route) - nothing
    // sensible to animate toward, so skip it entirely rather than flying to nowhere.
    if (!cartIconRef.current) return;
    const startRect = sourceElement.getBoundingClientRect();
    setFlyingItems((prev) => [...prev, { id: Date.now() + Math.random(), imageUrl, startRect }]);
  }, []);

  const removeFlyingItem = useCallback((id: number) => {
    setFlyingItems((prev) => prev.filter((item) => item.id !== id));
    setCartBumpKey((k) => k + 1);
  }, []);

  return (
    <CartFlyContext.Provider value={{ cartIconRef, flyToCart, cartBumpKey }}>
      {children}
      {createPortal(
        <AnimatePresence>
          {flyingItems.map((item) => (
            <FlyingImage key={item.id} item={item} cartIconRef={cartIconRef} onComplete={() => removeFlyingItem(item.id)} />
          ))}
        </AnimatePresence>,
        document.body
      )}
    </CartFlyContext.Provider>
  );
};

export function useCartFly(): CartFlyContextValue {
  const ctx = useContext(CartFlyContext);
  if (!ctx) throw new Error('useCartFly must be used within a CartFlyProvider');
  return ctx;
}
