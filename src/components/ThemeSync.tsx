import { useEffect } from 'react';
import { useSettings } from '../store/settings';

/** Mirrors settings onto <html> data attributes so CSS tokens react to them. */
export function ThemeSync() {
  const { theme, textSize, reduceMotion } = useSettings();
  useEffect(() => {
    const el = document.documentElement;
    if (theme === 'system') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', theme);
    if (textSize === 'normal') el.removeAttribute('data-text-size');
    else el.setAttribute('data-text-size', textSize);
    if (reduceMotion) el.setAttribute('data-reduce-motion', 'on');
    else el.removeAttribute('data-reduce-motion');
  }, [theme, textSize, reduceMotion]);
  return null;
}
