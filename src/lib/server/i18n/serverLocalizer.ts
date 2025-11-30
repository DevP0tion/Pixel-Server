import ko from './command/ko.json';
import en from './command/en.json';

type Locale = 'en' | 'ko';

export function translate(key: string, defaultValue: string, locale: Locale = 'ko'){
  const target: { [key: string]: string } = locale === 'ko' ? ko : en;
  return target[key] || defaultValue;
}