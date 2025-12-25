import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check } from 'lucide-react';
import { LANGUAGE_CONFIGS, normalizeLanguage, type SupportedLanguage } from '../i18n/constants';

interface LanguageSwitcherProps {
  className?: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ className = '' }) => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const currentLanguage = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);

  const handleLanguageChange = (langCode: SupportedLanguage) => {
    i18n.changeLanguage(langCode);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="
          relative group w-full py-3.5 px-6 rounded-2xl
          bg-white/60 backdrop-blur-sm
          border border-white/50
          shadow-lg
          hover:shadow-xl hover:-translate-y-0.5
          active:translate-y-0 active:shadow-md
          transition-all duration-200 ease-out
          text-gray-800 font-semibold text-base
          flex items-center justify-between
        "
      >
        <span className="flex items-center gap-2">
          <Globe size={16} />
          {LANGUAGE_CONFIGS[currentLanguage]?.displayName || 'Language'}
        </span>
        <span className="text-gray-400 font-normal text-sm">
          {LANGUAGE_CONFIGS[currentLanguage]?.flag || '🌐'}
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
            {(Object.keys(LANGUAGE_CONFIGS) as SupportedLanguage[]).map((langCode) => {
              const config = LANGUAGE_CONFIGS[langCode];
              const isActive = currentLanguage === langCode;

              return (
                <button
                  key={langCode}
                  onClick={() => handleLanguageChange(langCode)}
                  className={`
                    w-full px-6 py-3 flex items-center justify-between
                    transition-colors duration-150
                    ${isActive
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-700 hover:bg-gray-50'
                    }
                    ${langCode !== 'zh' ? 'border-b border-gray-100' : ''}
                  `}
                >
                  <span className="flex items-center gap-3">
                    <span className="text-xl">{config.flag}</span>
                    <span className="font-medium">{config.displayName}</span>
                  </span>
                  {isActive && (
                    <Check size={18} className="text-emerald-600" />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
