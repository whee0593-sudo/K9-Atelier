const STORAGE_KEY = "k9-customer-preview";

export function setCustomerLoggedIn() {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, "1");
  }
}

export function isCustomerLoggedIn() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "1";
}

export function clearCustomerLoggedIn() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
}
