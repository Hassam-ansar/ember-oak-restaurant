import React, { useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';

interface SafeFoodImageProps {
  src: string;
  alt: string;
  className?: string;
}

export const SafeFoodImage: React.FC<SafeFoodImageProps> = ({ src, alt, className = '' }) => {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-stone-800 via-stone-900 to-amber-950 text-amber-200/80 p-4 text-center ${className}`}
      >
        <UtensilsCrossed className="w-8 h-8 mb-2 opacity-75" />
        <span className="text-xs font-medium line-clamp-2 max-w-[18ch]">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
