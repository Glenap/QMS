import React from 'react';
import './Input.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, fullWidth = true, className = '', ...props }, ref) => {
    const wrapperClass = `qms-input-wrapper ${fullWidth ? 'qms-input--full' : ''} ${className}`;
    
    return (
      <div className={wrapperClass}>
        {label && (
          <label className="qms-input-label">
            {label} {props.required && <span className="qms-req">*</span>}
          </label>
        )}
        <input 
          ref={ref}
          className={`qms-input ${error ? 'qms-input--error' : ''}`}
          {...props} 
        />
        {error && <span className="qms-input-error-text">{error}</span>}
      </div>
    );
  }
);
Input.displayName = 'Input';
