// MongoDB connection + first-run seed.
import { env } from "./env";
import {
  mongoose,
  crops,
  users,
  listings,
  marketPrices,
  counters,
} from "@db/schema";

let connPromise: Promise<unknown> | null = null;

// Connect once, cache the promise. Never throws — if Mongo is unreachable the
// app still boots and serves the frontend; DB-backed endpoints fail fast.
export function connectDb(): Promise<unknown> {
  if (connPromise) return connPromise;

  const uri = env.mongoUri;
  if (!uri) {
    console.warn(
      "⚠️  MONGODB_URI is not set — MongoDB features are disabled. " +
        "Add your Atlas connection string to .env as MONGODB_URI to enable them.",
    );
    connPromise = Promise.resolve(null);
    return connPromise;
  }

  mongoose.set("strictQuery", true);
  mongoose.set("bufferCommands", false); // fail fast instead of hanging when disconnected

  connPromise = mongoose
    .connect(uri, { serverSelectionTimeoutMS: 8000 })
    .then(async () => {
      console.log("✅ Connected to MongoDB");
      await seedDb();
      return mongoose.connection;
    })
    .catch((err: Error) => {
      console.error("❌ MongoDB connection failed:", err.message);
      connPromise = null; // allow a later request to retry
      return null;
    });

  return connPromise;
}

// Seed Kenya farm data on first run (when the crops collection is empty).
export async function seedDb(): Promise<void> {
  const existing = await crops.estimatedDocumentCount();
  if (existing > 0) return;

  const cropData = [
    { name: "Tomato",       category: "vegetables", icon: "🍅", description: "High-value fruit vegetable.",       growingPeriod: 75,  typicalYield: "15-25 tons/acre" },
    { name: "Onion",        category: "vegetables", icon: "🧅", description: "Bulb vegetable, excellent shelf life.", growingPeriod: 105, typicalYield: "12-18 tons/acre" },
    { name: "Maize",        category: "grains",     icon: "🌽", description: "Staple grain crop.",                growingPeriod: 110, typicalYield: "2-4 tons/acre"   },
    { name: "Coffee",       category: "cash_crops", icon: "☕", description: "High-value cash crop.",             growingPeriod: 365, typicalYield: "800-1500 kg/acre"},
    { name: "Potato",       category: "vegetables", icon: "🥔", description: "Root tuber, high nutrition.",       growingPeriod: 90,  typicalYield: "8-15 tons/acre"  },
    { name: "Cabbage",      category: "vegetables", icon: "🥬", description: "Leafy vegetable.",                 growingPeriod: 75,  typicalYield: "20-30 tons/acre" },
    { name: "Beans",        category: "legumes",    icon: "🫘", description: "Protein-rich legume.",             growingPeriod: 75,  typicalYield: "1-2 tons/acre"   },
    { name: "Pishori Rice", category: "grains",     icon: "🍚", description: "Premium Kenya rice.",              growingPeriod: 120, typicalYield: "3-5 tons/acre"   },
    { name: "Tea",          category: "cash_crops", icon: "🍵", description: "Major Kenyan export crop.",        growingPeriod: 365, typicalYield: "1500-2500 kg/acre"},
    { name: "Avocado",      category: "fruits",     icon: "🥑", description: "High-demand export fruit.",        growingPeriod: 365, typicalYield: "5-10 tons/acre"  },
    { name: "Banana",       category: "fruits",     icon: "🍌", description: "Fast-growing tropical fruit.",     growingPeriod: 270, typicalYield: "10-30 tons/acre" },
    { name: "French Beans", category: "vegetables", icon: "🫛", description: "High-value export vegetable.",     growingPeriod: 65,  typicalYield: "4-6 tons/acre"   },
  ];
  await crops.insertMany(cropData.map((c, i) => ({ ...c, id: i + 1 })));

  const farmerData = [
    { unionId: "farmer_001", name: "Grace Achieng", phone: "+254712345678", location: "Kisumu",   verified: true, rating: 4.9, reviewCount: 28, userType: "farmer" },
    { unionId: "farmer_002", name: "James Mwangi",  phone: "+254723456789", location: "Nakuru",   verified: true, rating: 4.8, reviewCount: 45, userType: "farmer" },
    { unionId: "farmer_003", name: "Mary Wanjiku",  phone: "+254734567890", location: "Thika",    verified: true, rating: 5.0, reviewCount: 19, userType: "farmer" },
    { unionId: "farmer_004", name: "Peter Njoroge", phone: "+254745678901", location: "Muranga",  verified: true, rating: 4.6, reviewCount: 33, userType: "farmer" },
    { unionId: "farmer_005", name: "Aisha Omar",    phone: "+254756789012", location: "Naivasha", verified: true, rating: 4.7, reviewCount: 22, userType: "farmer" },
    { unionId: "buyer_001",  name: "Jane Wanjiru",  phone: "+254767890123", location: "Nairobi",  verified: true, rating: 4.6, reviewCount: 18, userType: "buyer"  },
  ];
  await users.insertMany(farmerData.map((u, i) => ({ ...u, id: i + 1 })));

  const listingData = [
    { farmerId: 1, cropId: 1,  cropName: "Tomato",       quantity: 500,  location: "Kisumu",    expectedPrice: 95,  description: "Fresh cherry tomatoes, Grade A" },
    { farmerId: 2, cropId: 3,  cropName: "Maize",        quantity: 2000, location: "Nakuru",    expectedPrice: 42,  description: "Dry maize, moisture below 14%" },
    { farmerId: 3, cropId: 4,  cropName: "Coffee",       quantity: 300,  location: "Thika",     expectedPrice: 320, description: "Arabica AA grade, wet-processed" },
    { farmerId: 4, cropId: 10, cropName: "Avocado",      quantity: 800,  location: "Muranga",   expectedPrice: 85,  description: "Hass avocado, export quality" },
    { farmerId: 5, cropId: 2,  cropName: "Onion",        quantity: 1000, location: "Naivasha",  expectedPrice: 110, description: "Red onion, well-cured, large bulbs" },
    { farmerId: 1, cropId: 7,  cropName: "Beans",        quantity: 400,  location: "Kisumu",    expectedPrice: 135, description: "Rose coco beans, machine-cleaned" },
    { farmerId: 2, cropId: 8,  cropName: "Pishori Rice", quantity: 600,  location: "Mwea",      expectedPrice: 185, description: "Premium Pishori, 2026 harvest" },
    { farmerId: 3, cropId: 9,  cropName: "Tea",          quantity: 200,  location: "Kericho",   expectedPrice: 280, description: "BOP grade, KTDA certified" },
    { farmerId: 4, cropId: 11, cropName: "Banana",       quantity: 700,  location: "Kisii",     expectedPrice: 48,  description: "Uganda Giant, ready bunches" },
    { farmerId: 5, cropId: 6,  cropName: "Cabbage",      quantity: 1500, location: "Nakuru",    expectedPrice: 35,  description: "Round-head cabbage, 1-2kg each" },
    { farmerId: 1, cropId: 12, cropName: "French Beans", quantity: 250,  location: "Meru",      expectedPrice: 145, description: "Export-grade, bobby variety" },
    { farmerId: 2, cropId: 5,  cropName: "Potato",       quantity: 3000, location: "Nyandarua", expectedPrice: 58,  description: "Shangi potato, freshly harvested" },
  ];
  await listings.insertMany(listingData.map((l, i) => ({ ...l, id: i + 1, status: "active" })));

  const today = new Date().toISOString().split("T")[0];
  const towns = ["Nairobi", "Nakuru", "Kisumu", "Mombasa", "Eldoret"];
  const basePrices = [
    { cropId: 1,  cropName: "Tomato",       wholesale: 95,  retail: 140, trend: "up",     trendPercent: 12 },
    { cropId: 2,  cropName: "Onion",        wholesale: 110, retail: 150, trend: "up",     trendPercent: 15 },
    { cropId: 3,  cropName: "Maize",        wholesale: 42,  retail: 62,  trend: "down",   trendPercent: 3  },
    { cropId: 4,  cropName: "Coffee",       wholesale: 320, retail: 420, trend: "up",     trendPercent: 8  },
    { cropId: 5,  cropName: "Potato",       wholesale: 58,  retail: 82,  trend: "up",     trendPercent: 5  },
    { cropId: 6,  cropName: "Cabbage",      wholesale: 35,  retail: 52,  trend: "down",   trendPercent: 2  },
    { cropId: 7,  cropName: "Beans",        wholesale: 135, retail: 175, trend: "down",   trendPercent: 4  },
    { cropId: 8,  cropName: "Pishori Rice", wholesale: 185, retail: 240, trend: "stable", trendPercent: 0  },
    { cropId: 9,  cropName: "Tea",          wholesale: 280, retail: 360, trend: "up",     trendPercent: 4  },
    { cropId: 10, cropName: "Avocado",      wholesale: 85,  retail: 115, trend: "up",     trendPercent: 9  },
    { cropId: 11, cropName: "Banana",       wholesale: 48,  retail: 68,  trend: "up",     trendPercent: 7  },
    { cropId: 12, cropName: "French Beans", wholesale: 145, retail: 195, trend: "up",     trendPercent: 8  },
  ];
  const priceDocs: any[] = [];
  let pid = 1;
  for (const town of towns) {
    for (const p of basePrices) {
      const variance = Math.random() * 0.1 - 0.05; // ±5% per town
      priceDocs.push({
        id: pid++,
        cropId: p.cropId,
        cropName: p.cropName,
        town,
        wholesalePrice: Math.round(p.wholesale * (1 + variance)),
        retailPrice: Math.round(p.retail * (1 + variance)),
        trend: p.trend,
        trendPercent: p.trendPercent,
        priceDate: today,
      });
    }
  }
  await marketPrices.insertMany(priceDocs);

  // Initialise auto-increment counters so future inserts continue past the seed.
  await counters.bulkWrite([
    { updateOne: { filter: { _id: "crops" },         update: { $set: { seq: cropData.length } },    upsert: true } },
    { updateOne: { filter: { _id: "users" },         update: { $set: { seq: farmerData.length } },  upsert: true } },
    { updateOne: { filter: { _id: "listings" },      update: { $set: { seq: listingData.length } }, upsert: true } },
    { updateOne: { filter: { _id: "market_prices" }, update: { $set: { seq: priceDocs.length } },   upsert: true } },
  ]);

  console.log(
    `✅ Seeded MongoDB: ${cropData.length} crops, ${farmerData.length} users, ${listingData.length} listings, ${priceDocs.length} market prices`,
  );
}
