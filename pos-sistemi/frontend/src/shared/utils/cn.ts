/**
 * ClassName utility function
 * Tailwind CSS class'larını birleştirmek için
 */

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}


