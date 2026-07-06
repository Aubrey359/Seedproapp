// Notify registered buyers when a new listing goes live.
// Runs from both the WhatsApp SELL flow and the website's Sell form, so a
// listing "alerts buyers" no matter which channel created it.
import { users } from "@db/schema";
import { sendWhatsApp } from "./send";

export async function alertBuyersOfListing(listing: {
  cropName: string;
  quantity: number;
  quantityUnit: string;
  location: string;
  expectedPrice: number;
}): Promise<void> {
  const buyers: any[] = await users.find({ userType: "buyer", phone: { $ne: null } }).lean();
  if (!buyers.length) return;

  const text =
    `🆕 New listing on Shamba Sokoni!\n\n` +
    `${listing.quantity} ${listing.quantityUnit}${listing.quantity > 1 && listing.quantityUnit !== "kg" ? "s" : ""} of *${listing.cropName}*\n` +
    `📍 ${listing.location}\n` +
    `💰 KES ${listing.expectedPrice.toLocaleString()} per ${listing.quantityUnit}\n\n` +
    `Reply *PRICES ${listing.cropName.toUpperCase()}* to compare, or contact the farmer via the app.`;

  // Send in parallel; a single failed send shouldn't block the others.
  await Promise.allSettled(buyers.map((b) => sendWhatsApp(b.phone, text)));
}
