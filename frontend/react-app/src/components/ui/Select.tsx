import React from 'react';
import './Select.css';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
  options: { label: string; value: string | number }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, fullWidth = true, options, className = '', ...props }, ref) => {
    const wrapperClass = `qms-select-wrapper ${fullWidth ? 'qms-select--full' : ''} ${className}`;
    
    return (
      <div className={wrapperClass}>
        {label && (
          <label className="qms-select-label">
            {label} {props.required && <span className="qms-req">*</span>}
          </label>
        )}
        <select 
          ref={ref}
          className={`qms-select ${error ? 'qms-select--error' : ''}`}
          {...props} 
        >
          {/* Add empty option if not provided? Usually better to explicitly provide it in options if needed */}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <span className="qms-select-error-text">{error}</span>}
      </div>
    );
  }
);
Select.displayName = 'Select';
