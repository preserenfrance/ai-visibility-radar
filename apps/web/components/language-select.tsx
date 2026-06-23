import * as React from "react";
import { cn } from "@/lib/utils";

const likelyLanguageOptions = [
  { value: "sl", label: "Slovenščina" },
  { value: "en", label: "Angleščina" },
  { value: "de", label: "Nemščina" },
  { value: "hr", label: "Hrvaščina" },
  { value: "sr", label: "Srbščina" },
  { value: "bs", label: "Bosanščina" },
  { value: "it", label: "Italijanščina" },
  { value: "hu", label: "Madžarščina" },
  { value: "fr", label: "Francoščina" },
  { value: "es", label: "Španščina" },
];

const otherLanguageOptions = [
  { value: "nl", label: "Nizozemščina" },
  { value: "cs", label: "Češčina" },
  { value: "sk", label: "Slovaščina" },
  { value: "pl", label: "Poljščina" },
  { value: "ro", label: "Romunščina" },
  { value: "bg", label: "Bolgarščina" },
  { value: "mk", label: "Makedonščina" },
  { value: "sq", label: "Albanščina" },
  { value: "uk", label: "Ukrajinščina" },
  { value: "ru", label: "Ruščina" },
  { value: "pt", label: "Portugalščina" },
  { value: "da", label: "Danščina" },
  { value: "sv", label: "Švedščina" },
  { value: "no", label: "Norveščina" },
  { value: "fi", label: "Finščina" },
  { value: "el", label: "Grščina" },
  { value: "tr", label: "Turščina" },
];

export function LanguageSelect({
  className,
  defaultValue = "sl",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      defaultValue={defaultValue}
      className={cn(
        "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <optgroup label="Najpogostejši jeziki">
        {likelyLanguageOptions.map((language) => (
          <option key={language.value} value={language.value}>
            {language.label}
          </option>
        ))}
      </optgroup>
      <optgroup label="Ostali jeziki">
        {otherLanguageOptions.map((language) => (
          <option key={language.value} value={language.value}>
            {language.label}
          </option>
        ))}
      </optgroup>
    </select>
  );
}
