/**
 * Input Component
 * Shared input component
 */

import React from 'react';
import { InputProps } from './Input.types';

export function Input({
  label,
  error,
  className = '',
  ...props
}: InputProps) {
  const inputClasses = `
    block w-full px-3 py-2 border rounded-md shadow-sm
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
    ${error ? 'border-red-300 text-red-900 placeholder-red-300' : 'border-gray-300'}
    ${className}
  `.trim();
  
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <input
        className={inputClasses}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}


