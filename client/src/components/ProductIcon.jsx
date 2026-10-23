import React, { useState, useEffect } from 'react';

export default function ProductIcon({ icon, className = 'w-8 h-8', textClassName = 'text-2xl', alt = 'Product Icon' }) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [icon]);

  if (!icon) {
    return <span className={textClassName}>📦</span>;
  }

  const isImg =
    !imgError &&
    (icon.startsWith('data:image') ||
      icon.startsWith('http://') ||
      icon.startsWith('https://') ||
      icon.startsWith('blob:') ||
      icon.startsWith('/'));

  if (isImg) {
    return (
      <img
        src={icon}
        alt={alt}
        className={`${className} object-cover rounded-lg shadow-sm flex-shrink-0`}
        loading="lazy"
        onError={() => setImgError(true)}
      />
    );
  }

  return <span className={textClassName}>{icon}</span>;
}
