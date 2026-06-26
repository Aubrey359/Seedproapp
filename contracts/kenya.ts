/** SeedPro Kenya — shared marketplace configuration */

export const APP_NAME = "SeedPro";
export const APP_TAGLINE = "Kenya's Farmer Marketplace";
export const COUNTRY = "Kenya";
export const CURRENCY = "KES";
export const CURRENCY_SYMBOL = "KSh";
export const PHONE_PREFIX = "+254";
export const DEFAULT_TOWN = "Nairobi";

/** Major Kenyan towns and counties where farmers sell produce */
export const KENYA_TOWNS = [
  "Nairobi",
  "Nakuru",
  "Eldoret",
  "Kisumu",
  "Mombasa",
  "Thika",
  "Nyeri",
  "Meru",
  "Machakos",
  "Kiambu",
  "Kakamega",
  "Naivasha",
] as const;

export type KenyaTown = (typeof KENYA_TOWNS)[number];

export const CROP_CATEGORIES = [
  { value: "all", label: "All" },
  { value: "vegetables", label: "Vegetables" },
  { value: "grains", label: "Grains" },
  { value: "cash_crops", label: "Cash Crops" },
  { value: "fruits", label: "Fruits" },
  { value: "legumes", label: "Legumes" },
] as const;

/** Crops Kenyan farmers commonly advertise */
export const KENYA_CROPS = [
  "Tomato",
  "Onion",
  "Maize",
  "Potato",
  "Coffee",
  "Tea",
  "Cabbage",
  "Beans",
  "Rice",
  "Eggplant",
  "Avocado",
  "Banana",
  "French Beans",
  "Sukuma Wiki",
] as const;

export const CROP_CATEGORY_MAP: Record<string, string> = {
  Tomato: "vegetables",
  Onion: "vegetables",
  Potato: "vegetables",
  Cabbage: "vegetables",
  Eggplant: "vegetables",
  "Sukuma Wiki": "vegetables",
  "French Beans": "vegetables",
  Maize: "grains",
  Rice: "grains",
  Coffee: "cash_crops",
  Tea: "cash_crops",
  Avocado: "fruits",
  Banana: "fruits",
  Beans: "legumes",
};

export const CROP_EMOJI: Record<string, string> = {
  Tomato: "🍅",
  Onion: "🧅",
  Maize: "🌽",
  Coffee: "☕",
  Tea: "🍵",
  Potato: "🥔",
  Cabbage: "🥬",
  Beans: "🫘",
  Rice: "🍚",
  Eggplant: "🍆",
  Avocado: "🥑",
  Banana: "🍌",
  "French Beans": "🫛",
  "Sukuma Wiki": "🥬",
};

/** Format price in Kenyan Shillings */
export function formatKES(amount: number | string, perUnit?: string): string {
  const value = Number(amount);
  const formatted = `KSh ${value.toLocaleString("en-KE")}`;
  return perUnit ? `${formatted}/${perUnit}` : formatted;
}

/** Compact format for large sales totals */
export function formatKESCompact(amount: number): string {
  if (amount >= 1_000_000) return `KSh ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `KSh ${(amount / 1_000).toFixed(0)}K`;
  return formatKES(amount);
}
