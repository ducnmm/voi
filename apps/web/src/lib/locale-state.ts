let activeLanguage: "vi" | "en" = "vi";
export function setRuntimeLanguage(value: "vi" | "en") {
  activeLanguage = value;
}
export function runtimeLocale() {
  return activeLanguage === "en" ? "en-GB" : "vi-VN";
}
