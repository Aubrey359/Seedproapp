import { getDb } from "../api/queries/connection";
import { crops, marketPrices, users } from "./schema";
import { KENYA_TOWNS, DEFAULT_TOWN } from "@contracts/kenya";

async function seed() {
  const db = getDb();
  console.log("Seeding essential Kenya data...");

  const cropData = [
    { name: "Tomato", category: "vegetables" as const, icon: "\uD83C\uDF45", description: "High-value fruit vegetable, popular in salads and sauces.", growingPeriod: 75, typicalYield: "15-25 tons/acre", image: "/images/crop-tomato.jpg" },
    { name: "Onion", category: "vegetables" as const, icon: "\uD83E\uDDC5", description: "Bulb vegetable with excellent storage life.", growingPeriod: 105, typicalYield: "12-18 tons/acre", image: "/images/crop-onion.jpg" },
    { name: "Maize", category: "grains" as const, icon: "\uD83C\uDF3D", description: "Staple grain crop, versatile for food and feed.", growingPeriod: 110, typicalYield: "2-4 tons/acre", image: "/images/crop-maize.jpg" },
    { name: "Coffee", category: "cash_crops" as const, icon: "\u2615", description: "High-value cash crop, major Kenyan export.", growingPeriod: 365, typicalYield: "800-1500 kg/acre", image: "/images/crop-coffee.jpg" },
    { name: "Potato", category: "vegetables" as const, icon: "\uD83E\uDD54", description: "Root tuber crop, high nutritional value.", growingPeriod: 90, typicalYield: "8-15 tons/acre", image: "/images/crop-potato.jpg" },
    { name: "Cabbage", category: "vegetables" as const, icon: "\uD83E\uDD6C", description: "Leafy vegetable, popular in local markets.", growingPeriod: 75, typicalYield: "20-30 tons/acre", image: "/images/crop-cabbage.jpg" },
    { name: "Beans", category: "legumes" as const, icon: "\uD83E\uDDED", description: "Protein-rich legume, nitrogen-fixing crop.", growingPeriod: 75, typicalYield: "1-2 tons/acre", image: "/images/crop-tomato.jpg" },
    { name: "Rice", category: "grains" as const, icon: "\uD83C\uDF5A", description: "Staple grain for many households.", growingPeriod: 120, typicalYield: "3-5 tons/acre", image: "/images/crop-maize.jpg" },
    { name: "Tea", category: "cash_crops" as const, icon: "\uD83C\uDF75", description: "Major Kenyan export crop from highland regions.", growingPeriod: 365, typicalYield: "1500-2500 kg/acre", image: "/images/crop-tea.jpg" },
    { name: "Avocado", category: "fruits" as const, icon: "\uD83E\uDD51", description: "High-demand export fruit from Murang'a and Kisii.", growingPeriod: 365, typicalYield: "5-10 tons/acre", image: "/images/crop-avocado.jpg" },
  ];

  for (const crop of cropData) {
    await db.insert(crops).values(crop);
  }
  console.log("Crops seeded!");

  const sampleUsers = [
    { unionId: "farmer_001", name: "Wanjiku Kamau", email: "wanjiku@seedpro.ke", userType: "farmer" as const, phone: "+254712345678", location: "Kiambu", bio: "Tomato farmer with 8 years experience", verified: true, rating: "4.5", reviewCount: 23 },
    { unionId: "farmer_002", name: "James Otieno", email: "james@seedpro.ke", userType: "farmer" as const, phone: "+254723456789", location: "Nakuru", bio: "Onion specialist, export farming", verified: true, rating: "4.2", reviewCount: 15 },
    { unionId: "farmer_003", name: "Faith Muthoni", email: "faith@seedpro.ke", userType: "farmer" as const, phone: "+254734567890", location: "Eldoret", bio: "Maize and grains farmer", verified: true, rating: "4.8", reviewCount: 31 },
    { unionId: "farmer_004", name: "Peter Kipchoge", email: "peter@seedpro.ke", userType: "farmer" as const, phone: "+254745678901", location: "Nyeri", bio: "Coffee farmer, cooperative member", verified: true, rating: "4.0", reviewCount: 12 },
    { unionId: "buyer_001", name: "Jane Wanjiru", email: "jane@naivas.co.ke", userType: "buyer" as const, phone: "+254756789012", location: "Nairobi", bio: "Naivas Supermarket procurement", verified: true, rating: "4.6", reviewCount: 18 },
    { unionId: "agg_001", name: "Robert Mwangi", email: "robert@agrihub.ke", userType: "aggregator" as const, phone: "+254767890123", location: "Nairobi", bio: "Aggregating produce from 80+ farmers", verified: true, rating: "4.3", reviewCount: 27 },
  ];

  for (const u of sampleUsers) {
    await db.insert(users).values(u);
  }
  console.log("Users seeded!");

  const today = new Date();
  const priceData = [
    { cropName: "Tomato", wholesale: 95, retail: 140 },
    { cropName: "Onion", wholesale: 75, retail: 110 },
    { cropName: "Maize", wholesale: 55, retail: 75 },
    { cropName: "Coffee", wholesale: 420, retail: 580 },
    { cropName: "Potato", wholesale: 65, retail: 90 },
    { cropName: "Cabbage", wholesale: 40, retail: 60 },
    { cropName: "Beans", wholesale: 150, retail: 200 },
    { cropName: "Rice", wholesale: 120, retail: 160 },
    { cropName: "Tea", wholesale: 280, retail: 380 },
    { cropName: "Avocado", wholesale: 55, retail: 85 },
  ];

  for (const town of KENYA_TOWNS) {
    for (let i = 0; i < priceData.length; i++) {
      const pd = priceData[i];
      const trends = ["up", "down", "stable"];
      await db.insert(marketPrices).values({
        cropId: i + 1,
        cropName: pd.cropName,
        town,
        wholesalePrice: (pd.wholesale * (0.85 + Math.random() * 0.3)).toFixed(0),
        retailPrice: (pd.retail * (0.85 + Math.random() * 0.3)).toFixed(0),
        currency: "KES",
        trend: trends[i % 3] as "up" | "down" | "stable",
        trendPercent: (Math.random() * 8).toFixed(2),
        priceDate: today,
      });
    }
  }
  console.log(`Prices seeded for ${KENYA_TOWNS.length} towns (default: ${DEFAULT_TOWN})!`);
  console.log("Seed complete!");
}

seed().catch(console.error);
