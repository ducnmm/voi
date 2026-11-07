"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { setRuntimeLanguage } from "./locale-state";
import english from "@/locales/en.json";
export type Language = "vi" | "en";
type Translate = (
  text: string | null | undefined,
  values?: unknown[],
) => string;
const LocaleContext = createContext<{
  language: Language;
  setLanguage: (value: Language) => void;
  t: Translate;
  locale: string;
} | null>(null);
export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setValue] = useState<Language>("vi");
  useEffect(() => {
    const saved = localStorage.getItem("voi.language");
    if (saved === "en" || saved === "vi") {
      setRuntimeLanguage(saved);
      setValue(saved);
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  const setLanguage = useCallback((value: Language) => {
    localStorage.setItem("voi.language", value);
    setRuntimeLanguage(value);
    setValue(value);
  }, []);
  const t = useCallback<Translate>(
    (input, values) => {
      const text = input ?? "";
      const leading = text.match(/^\s*/)?.[0] ?? "",
        trailing = text.match(/\s*$/)?.[0] ?? "";
      const key = text.trim();
      const translated =
        language === "en"
          ? ((english as Record<string, string>)[key] ?? key)
          : key;
      const formatted = translated.replace(/\{(\d+)\}/g, (_, index: string) =>
        String(values?.[Number(index)] ?? ""),
      );
      return key ? leading + formatted + trailing : text;
    },
    [language],
  );
  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      locale: language === "en" ? "en-GB" : "vi-VN",
    }),
    [language, setLanguage, t],
  );
  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}
export function useI18n() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("I18nProvider missing");
  return value;
}
