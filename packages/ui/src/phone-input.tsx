"use client";

import { useState } from "react";

export const COUNTRY_CODES = [
  { code: "91", flag: "🇮🇳", label: "India", maxLength: 10 },
  { code: "1", flag: "🇺🇸", label: "USA / Canada", maxLength: 10 },
  { code: "44", flag: "🇬🇧", label: "UK", maxLength: 10 },
  { code: "61", flag: "🇦🇺", label: "Australia", maxLength: 9 },
  { code: "64", flag: "🇳🇿", label: "New Zealand", maxLength: 9 },
  { code: "971", flag: "🇦🇪", label: "UAE", maxLength: 9 },
  { code: "966", flag: "🇸🇦", label: "Saudi Arabia", maxLength: 9 },
  { code: "974", flag: "🇶🇦", label: "Qatar", maxLength: 8 },
  { code: "965", flag: "🇰🇼", label: "Kuwait", maxLength: 8 },
  { code: "973", flag: "🇧🇭", label: "Bahrain", maxLength: 8 },
  { code: "968", flag: "🇴🇲", label: "Oman", maxLength: 8 },
  { code: "92", flag: "🇵🇰", label: "Pakistan", maxLength: 10 },
  { code: "880", flag: "🇧🇩", label: "Bangladesh", maxLength: 10 },
  { code: "94", flag: "🇱🇰", label: "Sri Lanka", maxLength: 9 },
  { code: "977", flag: "🇳🇵", label: "Nepal", maxLength: 10 },
  { code: "65", flag: "🇸🇬", label: "Singapore", maxLength: 8 },
  { code: "60", flag: "🇲🇾", label: "Malaysia", maxLength: 10 },
  { code: "62", flag: "🇮🇩", label: "Indonesia", maxLength: 12 },
  { code: "63", flag: "🇵🇭", label: "Philippines", maxLength: 10 },
  { code: "66", flag: "🇹🇭", label: "Thailand", maxLength: 9 },
  { code: "84", flag: "🇻🇳", label: "Vietnam", maxLength: 10 },
  { code: "86", flag: "🇨🇳", label: "China", maxLength: 11 },
  { code: "81", flag: "🇯🇵", label: "Japan", maxLength: 10 },
  { code: "82", flag: "🇰🇷", label: "South Korea", maxLength: 10 },
  { code: "49", flag: "🇩🇪", label: "Germany", maxLength: 11 },
  { code: "33", flag: "🇫🇷", label: "France", maxLength: 9 },
  { code: "39", flag: "🇮🇹", label: "Italy", maxLength: 10 },
  { code: "34", flag: "🇪🇸", label: "Spain", maxLength: 9 },
  { code: "7", flag: "🇷🇺", label: "Russia", maxLength: 10 },
  { code: "55", flag: "🇧🇷", label: "Brazil", maxLength: 11 },
  { code: "27", flag: "🇿🇦", label: "South Africa", maxLength: 9 },
  { code: "20", flag: "🇪🇬", label: "Egypt", maxLength: 10 },
  { code: "234", flag: "🇳🇬", label: "Nigeria", maxLength: 10 },
  { code: "254", flag: "🇰🇪", label: "Kenya", maxLength: 9 },
];

export type PhoneInputValue = {
  countryCode: string; // digits only, no +
  phone: string;       // local number digits only
};

export type PhoneInputProps = {
  /** Called whenever countryCode or phone changes */
  onChange: (value: PhoneInputValue) => void;
  /** Current value */
  value: PhoneInputValue;
  /** Disable the whole input (e.g. after verification) */
  disabled?: boolean;
  /** Additional className for the outer wrapper */
  className?: string;
  /** Placeholder for the number field */
  placeholder?: string;
};


export function PhoneInput({
  onChange,
  value,
  disabled = false,
  className = "",
  placeholder = "Enter phone number",
}: PhoneInputProps) {
  const selected = COUNTRY_CODES.find((c) => c.code === value.countryCode) ?? COUNTRY_CODES[0];

  const handleCodeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ countryCode: e.target.value, phone: value.phone });
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, selected.maxLength);
    onChange({ countryCode: value.countryCode, phone: digits });
  };

  return (
    <div className={`flex items-stretch rounded-xl border border-gray-200 bg-gray-50 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all ${className}`}>
      {/* Country selector */}
      <select
        value={value.countryCode}
        onChange={handleCodeChange}
        disabled={disabled}
        className="bg-transparent border-r border-gray-200 px-2 py-0 text-sm font-semibold text-gray-700 cursor-pointer focus:outline-none shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
        style={{ minWidth: '3.5rem', maxWidth: '5rem' }}
        aria-label="Country code"
      >
        {COUNTRY_CODES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag} +{c.code}
          </option>
        ))}
      </select>

      {/* Phone number input */}
      <input
        type="tel"
        inputMode="numeric"
        placeholder={placeholder}
        value={value.phone}
        onChange={handlePhoneChange}
        disabled={disabled}
        maxLength={selected.maxLength}
        className="flex-1 h-12 px-2 text-sm sm:text-base font-semibold bg-transparent focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 min-w-0 w-0"
        aria-label="Phone number"
      />
    </div>
  );
}
