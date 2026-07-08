import * as React from "react";
import type { SupportedLocale } from "@ai-radar/shared";
import { cn } from "@/lib/utils";

const likelyLanguageOptions = [
  { value: "sl", sl: "Slovenščina", en: "Slovenian" },
  { value: "en", sl: "Angleščina", en: "English" },
  { value: "de", sl: "Nemščina", en: "German" },
  { value: "hr", sl: "Hrvaščina", en: "Croatian" },
  { value: "sr", sl: "Srbščina", en: "Serbian" },
  { value: "bs", sl: "Bosanščina", en: "Bosnian" },
  { value: "it", sl: "Italijanščina", en: "Italian" },
  { value: "hu", sl: "Madžarščina", en: "Hungarian" },
  { value: "fr", sl: "Francoščina", en: "French" },
  { value: "es", sl: "Španščina", en: "Spanish" },
];

const otherLanguageOptions = [
  { value: "nl", sl: "Nizozemščina", en: "Dutch" },
  { value: "cs", sl: "Češčina", en: "Czech" },
  { value: "sk", sl: "Slovaščina", en: "Slovak" },
  { value: "pl", sl: "Poljščina", en: "Polish" },
  { value: "ro", sl: "Romunščina", en: "Romanian" },
  { value: "bg", sl: "Bolgarščina", en: "Bulgarian" },
  { value: "mk", sl: "Makedonščina", en: "Macedonian" },
  { value: "sq", sl: "Albanščina", en: "Albanian" },
  { value: "uk", sl: "Ukrajinščina", en: "Ukrainian" },
  { value: "ru", sl: "Ruščina", en: "Russian" },
  { value: "pt", sl: "Portugalščina", en: "Portuguese" },
  { value: "da", sl: "Danščina", en: "Danish" },
  { value: "sv", sl: "Švedščina", en: "Swedish" },
  { value: "no", sl: "Norveščina", en: "Norwegian" },
  { value: "fi", sl: "Finščina", en: "Finnish" },
  { value: "el", sl: "Grščina", en: "Greek" },
  { value: "tr", sl: "Turščina", en: "Turkish" },
];

export function LanguageSelect({
  className,
  defaultValue = "sl",
  uiLocale = "sl",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  uiLocale?: SupportedLocale;
}) {
  const likelyLabel =
    uiLocale === "en" ? "Common languages" : "Najpogostejši jeziki";
  const otherLabel = uiLocale === "en" ? "Other languages" : "Ostali jeziki";

  return (
    <select
      defaultValue={defaultValue}
      className={cn(
        "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <optgroup label={likelyLabel}>
        {likelyLanguageOptions.map((language) => (
          <option key={language.value} value={language.value}>
            {language[uiLocale]}
          </option>
        ))}
      </optgroup>
      <optgroup label={otherLabel}>
        {otherLanguageOptions.map((language) => (
          <option key={language.value} value={language.value}>
            {language[uiLocale]}
          </option>
        ))}
      </optgroup>
    </select>
  );
}
