import React from 'react';
import { useTranslation } from 'react-i18next';

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  const currentLang = i18n.language;

  const toggleLanguage = () => {
    const newLang = currentLang === 'ja' ? 'en' : 'ja';
    i18n.changeLanguage(newLang);
  };

  return (
    <button
      onClick={toggleLanguage}
      style={{
        padding: '4px 10px',
        fontSize: '11px',
        fontWeight: '600',
        border: '1px solid #D1D5DB',
        borderRadius: '6px',
        cursor: 'pointer',
        backgroundColor: '#FFFFFF',
        color: '#374151',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#F3F4F6';
        e.currentTarget.style.borderColor = '#9CA3AF';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = '#FFFFFF';
        e.currentTarget.style.borderColor = '#D1D5DB';
      }}
      title={currentLang === 'ja' ? 'Switch to English' : '日本語に切り替え'}
    >
      <span style={{ fontSize: '14px' }}>🌐</span>
      <span>{currentLang === 'ja' ? 'EN' : 'JP'}</span>
    </button>
  );
};
