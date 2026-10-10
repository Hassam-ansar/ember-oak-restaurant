import React, { useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';

import heroImg from '../assets/images/hero_artisan_pizza_feast_1791612739930.jpg';
import pizzaImg from '../assets/images/food_pizza_crown_crust_1791612750318.jpg';
import burgerImg from '../assets/images/food_burger_double_smash_1791612760067.jpg';
import wrapsImg from '../assets/images/food_shawarma_wraps_1791612772317.jpg';
import chickenImg from '../assets/images/food_fried_chicken_wings_1791612782948.jpg';
import pastaImg from '../assets/images/food_pasta_dessert_drinks_1791612793526.jpg';

const BUNDLED_IMAGE_MAP: Record<string, string> = {
  '/src/assets/images/hero_artisan_pizza_feast_1791612739930.jpg': heroImg,
  '/src/assets/images/food_pizza_crown_crust_1791612750318.jpg': pizzaImg,
  '/src/assets/images/food_burger_double_smash_1791612760067.jpg': burgerImg,
  '/src/assets/images/food_shawarma_wraps_1791612772317.jpg': wrapsImg,
  '/src/assets/images/food_fried_chicken_wings_1791612782948.jpg': chickenImg,
  '/src/assets/images/food_pasta_dessert_drinks_1791612793526.jpg': pastaImg,
};

function resolveImageSrc(src: string): string {
  if (!src) return pizzaImg;
  if (BUNDLED_IMAGE_MAP[src]) return BUNDLED_IMAGE_MAP[src];
  if (src.includes('hero_artisan_pizza_feast')) return heroImg;
  if (src.includes('food_pizza_crown_crust')) return pizzaImg;
  if (src.includes('food_burger_double_smash')) return burgerImg;
  if (src.includes('food_shawarma_wraps')) return wrapsImg;
  if (src.includes('food_fried_chicken_wings')) return chickenImg;
  if (src.includes('food_pasta_dessert_drinks')) return pastaImg;
  return src;
}

interface SafeFoodImageProps {
  src: string;
  alt: string;
  className?: string;
}

export const SafeFoodImage: React.FC<SafeFoodImageProps> = ({ src, alt, className = '' }) => {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = resolveImageSrc(src);

  if (failed || !resolvedSrc) {
    return (
      <div
        className={`bg-stone-900 text-stone-400 flex flex-col items-center justify-center p-6 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <UtensilsCrossed className="w-7 h-7 text-amber-500/80 mb-2" />
        <span className="text-xs font-medium text-stone-300 line-clamp-2">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
      loading="lazy"
    />
  );
};