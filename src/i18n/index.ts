import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 导入所有语言文件
import zhCN from './locales/zh-CN.json';
import zhTW from './locales/zh-TW.json';
import en from './locales/en.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import es from './locales/es.json';
import it from './locales/it.json';
import ru from './locales/ru.json';
import ar from './locales/ar.json';
import pt from './locales/pt.json';
import nl from './locales/nl.json';
import tr from './locales/tr.json';
import hi from './locales/hi.json';
import sv from './locales/sv.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'zh-CN': { translation: zhCN },
      'zh-TW': { translation: zhTW },
      'en': { translation: en },
      'ja': { translation: ja },
      'ko': { translation: ko },
      'fr': { translation: fr },
      'de': { translation: de },
      'es': { translation: es },
      'it': { translation: it },
      'ru': { translation: ru },
      'ar': { translation: ar },
      'pt': { translation: pt },
      'nl': { translation: nl },
      'tr': { translation: tr },
      'hi': { translation: hi },
      'sv': { translation: sv },
    },
    fallbackLng: 'zh-CN',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;

