import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const DEFAULT_LANGUAGE = 'ru';
const SUPPORTED_LANGUAGES = ['en', 'ru'] as const;

const resources = {
  en: {
    translation: {
      app: { title: 'TJournal' },
      error: {
        unexpected: 'Something went wrong.',
        'vault-already-initialized': 'Choose an empty folder.',
        'vault-invalid': 'This folder is not a valid vault.',
        'vault-not-accessible': 'The vault is unavailable.',
        'storage-integrity-failed': 'The vault data check failed.',
      },
      journal: { empty: 'No trades recorded yet.', title: 'Closed trades' },
      onboarding: {
        create: 'Create vault',
        description: 'Choose an empty folder for the database, attachments and backups.',
        open: 'Open vault',
        title: 'Your offline trading journal',
      },
      trade: {
        add: 'Add closed trade',
        cash: 'USD',
        instrument: 'Instrument',
        percent: 'Percent',
        result: 'Result',
        save: 'Save trade',
      },
      theme: { auto: 'Auto', dark: 'Dark', label: 'Theme', light: 'Light' },
    },
  },
  ru: {
    translation: {
      app: { title: 'TJournal' },
      error: {
        unexpected: 'Что-то пошло не так.',
        'vault-already-initialized': 'Для нового vault выберите пустую папку.',
        'vault-invalid': 'Выбранная папка не является vault TJournal.',
        'vault-not-accessible': 'Vault недоступен.',
        'storage-integrity-failed': 'Проверка данных vault завершилась ошибкой.',
      },
      journal: { empty: 'Пока нет записанных сделок.', title: 'Закрытые сделки' },
      onboarding: {
        create: 'Создать vault',
        description: 'Выберите пустую папку для базы данных, изображений и резервных копий.',
        open: 'Открыть vault',
        title: 'Ваш офлайн-журнал сделок',
      },
      trade: {
        add: 'Добавить закрытую сделку',
        cash: 'USD',
        instrument: 'Инструмент',
        percent: 'Процент',
        result: 'Результат',
        save: 'Сохранить сделку',
      },
      theme: { auto: 'Авто', dark: 'Тёмная', label: 'Тема', light: 'Светлая' },
    },
  },
};

const detectedLanguage = navigator.language.slice(0, 2);
const initialLanguage = SUPPORTED_LANGUAGES.includes(
  detectedLanguage as (typeof SUPPORTED_LANGUAGES)[number],
)
  ? detectedLanguage
  : DEFAULT_LANGUAGE;

void i18n.use(initReactI18next).init({
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
  lng: initialLanguage,
  resources,
});

export { i18n };
