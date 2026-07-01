import { useSyncExternalStore } from "react";
import {
  getDateLocale,
  setDateLocale,
  subscribeLocale,
  type DateLocale,
} from "./locale";

export interface LocaleControls {
  locale: DateLocale;
  setLocale: (value: DateLocale) => void;
  toggleLocale: () => void;
}

/** Reactive access to the shared date-locale store — all consumers update
 *  together when it changes (via useSyncExternalStore). */
export function useLocale(): LocaleControls {
  const locale = useSyncExternalStore(
    subscribeLocale,
    getDateLocale,
    getDateLocale,
  );
  return {
    locale,
    setLocale: setDateLocale,
    toggleLocale: () => setDateLocale(locale === "dmy" ? "mdy" : "dmy"),
  };
}
