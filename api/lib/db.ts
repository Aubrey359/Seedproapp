// MongoDB connection + first-run seed.
import { env } from "./env";
import {
  mongoose,
  crops,
  users,
  listings,
  marketPrices,
  cropGuides,
  spraySchedules,
  announcements,
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
      await seedCropGuides();
      await seedAnnouncements();
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

// Day-by-day crop guides + task/spray schedules for "My Farm" — real,
// researched agronomic content (KALRO/extension-service-consistent, see
// commit message for sources), not filler text. Seeded for the 4 most
// common smallholder crops (Maize, Tomato, Potato, Beans) to start; any
// other crop gracefully shows "guidance coming soon" in the UI rather
// than breaking — the admin panel can add more over time.
//
// Gated independently from seedDb() (on cropGuides being empty, not on
// crops being empty) so this backfills into databases that were already
// seeded before this feature existed — which is the case both locally
// and in production.
// cropId reference: 1=Tomato, 3=Maize, 5=Potato, 7=Beans (see cropData above).
export async function seedCropGuides(): Promise<void> {
  const existing = await cropGuides.estimatedDocumentCount();
  if (existing > 0) return;

  const guideData = [
    // ── Maize (cropId 3) — day 0 = planting ──
    { cropId: 3, stage: "Germination & Emergence", stageOrder: 1, dayFrom: 0, dayTo: 10, title: "Germination & Emergence (Day 0-10)",
      description: "Your maize seed sprouts and pushes through the soil. This is when the crop is most vulnerable to pests hiding in the soil.",
      tasks: ["Apply basal fertilizer (DAP) in the planting furrow", "Gap-fill any holes that didn't germinate by day 10-14", "Thin to 1-2 healthy plants per hole"],
      tips: ["Plant right at the onset of reliable rains for the best start"],
      warnings: ["Watch for cutworms and termites cutting seedlings at the base", "Maize streak virus, spread by leafhoppers, is most damaging at this early stage"] },
    { cropId: 3, stage: "Vegetative Growth", stageOrder: 2, dayFrom: 10, dayTo: 60, title: "Vegetative Growth (Day 10-60)",
      description: "Rapid leaf and stem growth as the plant builds the framework for a good harvest.",
      tasks: ["First weeding around day 21", "Top-dress with CAN or urea once the crop is knee-high (around day 30-42)", "Second weeding around day 56", "Start scouting for fall armyworm from emergence, especially in the whorl"],
      tips: ["The knee-high stage is the classic local marker for when to top-dress — don't wait for a specific date if your crop is ahead or behind"],
      warnings: ["Fall armyworm causes the most damage at whorl stage — check the tightly rolled young leaves regularly", "Watch for maize stalk borers and streak virus symptoms on leaves"] },
    { cropId: 3, stage: "Flowering", stageOrder: 3, dayFrom: 60, dayTo: 75, title: "Tasseling & Silking (Day 60-75)",
      description: "The tassel and silk emerge — this is the most drought-sensitive stage of the whole crop.",
      tasks: ["Apply a second split top-dress 10-15 days after the first if you're in a high-rainfall area, just before tasseling", "Make sure the crop has enough moisture — this is the worst possible time for it to run dry"],
      tips: [],
      warnings: ["Stalk borers boring into the stem can cause lodging", "Gray leaf spot, turcicum leaf blight and common rust often show up on the leaves around now"] },
    { cropId: 3, stage: "Grain Filling", stageOrder: 4, dayFrom: 75, dayTo: 115, title: "Grain Filling (Day 75-115)",
      description: "Kernels fill with starch through the milk, dough and dent stages.",
      tasks: ["Keep scouting for foliar disease", "Control any late-season stalk borers", "Scare off birds as kernels reach the dent stage"],
      tips: [],
      warnings: ["Ear rots (which can produce aflatoxin) can develop now, especially in wet conditions", "Stalk borer damage at this stage often causes lodging right before harvest"] },
    { cropId: 3, stage: "Maturity & Harvest", stageOrder: 5, dayFrom: 115, dayTo: undefined, title: "Maturity & Harvest (Day 115-140)",
      description: "The crop is ready when you see a black layer at the base of the kernel.",
      tasks: ["Harvest at physiological maturity — black layer at the kernel base, around 30-35% grain moisture", "Field-dry or artificially dry to 13% moisture or below before storage", "Store in hermetic (e.g. PICS) bags to cut storage losses"],
      tips: ["Every day you delay harvest and drying in wet weather raises aflatoxin risk"],
      warnings: ["Maize weevil and larger grain borer attack grain in storage", "Poor drying or a delayed harvest sharply raises aflatoxin risk"] },

    // ── Tomato (cropId 1) — day 0 = transplanting ──
    { cropId: 1, stage: "Establishment", stageOrder: 1, dayFrom: 0, dayTo: 14, title: "Establishment (Day 0-14)",
      description: "The transplanted seedling settles in and begins putting down new roots.",
      tasks: ["Water immediately after transplanting", "Apply basal fertilizer (DAP) once roots have started developing, around day 14", "Gap-fill any seedlings that died"],
      tips: ["Transplant in the late afternoon or on a cloudy day to reduce shock"],
      warnings: ["Protect stems from cutworms right after transplanting", "Watch for damping-off carried over from the nursery"] },
    { cropId: 1, stage: "Vegetative Growth", stageOrder: 2, dayFrom: 14, dayTo: 35, title: "Vegetative Growth (Day 14-35)",
      description: "The plant builds leaves and branches before it starts flowering.",
      tasks: ["Stake the plants by around week 2-3", "First top-dress with CAN around week 4", "First weeding", "Start monitoring for Tuta absoluta (tomato leafminer) with pheromone traps"],
      tips: [],
      warnings: ["Bacterial wilt can kill plants suddenly at this stage — remove and destroy any wilting plant immediately", "Early blight shows up on the lower, older leaves first", "Watch for aphids and whiteflies"] },
    { cropId: 1, stage: "Flowering", stageOrder: 3, dayFrom: 35, dayTo: 50, title: "Flowering (Day 35-50)",
      description: "Flowers form and need to set fruit successfully.",
      tasks: ["Switch to a potassium-rich feed (e.g. NPK 17:17:17) to support fruit set", "Second CAN top-dress around week 8", "Remove suckers and keep tying plants to stakes", "Keep soil moisture even — stress now causes flowers to drop"],
      tips: [],
      warnings: ["Whitefly spreads Tomato Yellow Leaf Curl Virus — control it before flowering peaks", "Tuta absoluta pressure usually increases through this stage"] },
    { cropId: 1, stage: "Fruit Development", stageOrder: 4, dayFrom: 50, dayTo: 75, title: "Fruit Development (Day 50-75)",
      description: "Fruits form and swell — this is when most of the serious diseases show up.",
      tasks: ["Keep irrigation consistent — irregular watering causes blossom end rot and fruit cracking", "Keep staking and tying as the plant gets heavier", "Start a protectant fungicide program if the weather is wet or humid"],
      tips: [],
      warnings: ["Late blight is the most destructive tomato disease in cool, wet highland conditions — it can wipe out a crop fast", "Tuta absoluta larvae bore directly into fruit", "Watch for red spider mites and African bollworm"] },
    { cropId: 1, stage: "Maturity & Harvest", stageOrder: 5, dayFrom: 75, dayTo: undefined, title: "Maturity & Harvest (Day 75-120)",
      description: "Fruits ripen and are picked in rounds as they turn.",
      tasks: ["Harvest every 2-3 days at breaker to ripe stage", "Respect the pre-harvest interval on your last pesticide spray before picking", "Sort and grade fruit for market"],
      tips: ["Indeterminate varieties keep bearing well past day 120 — keep the harvest rounds going"],
      warnings: ["Late blight can still damage the crop right up to harvest", "Watch for fruit rots (Fusarium, anthracnose) on ripening fruit"] },

    // ── Potato (cropId 5) — day 0 = planting seed tuber ──
    { cropId: 5, stage: "Planting & Emergence", stageOrder: 1, dayFrom: 0, dayTo: 21, title: "Planting & Emergence (Day 0-21)",
      description: "The seed tuber sprouts and pushes shoots above ground.",
      tasks: ["Plant certified, disease-free, well-sprouted seed tubers — 30cm within rows, 75cm between rows, 10-15cm deep", "Apply a basal potato compound fertilizer at planting"],
      tips: ["Always start with certified seed — bacterial wilt is seed-borne and hard to get rid of once it's in your soil"],
      warnings: ["Watch for cutworms", "Black scurf (Rhizoctonia) can affect emergence"] },
    { cropId: 5, stage: "Vegetative Growth", stageOrder: 2, dayFrom: 21, dayTo: 40, title: "Vegetative Growth (Day 21-40)",
      description: "Leafy growth builds up and the canopy starts to close.",
      tasks: ["First weeding and first earthing-up (hilling) around 2 weeks after full emergence, or once plants are about 20cm tall", "Top-dress with CAN or a potato fertilizer 3-4 weeks after emergence", "Start weekly pest and disease scouting"],
      tips: [],
      warnings: ["Aphids at this stage can spread viruses even before symptoms show", "Late blight risk rises fast as the canopy closes"] },
    { cropId: 5, stage: "Tuber Initiation & Flowering", stageOrder: 3, dayFrom: 40, dayTo: 60, title: "Tuber Initiation & Flowering (Day 40-60)",
      description: "Tubers begin forming underground while the plant flowers above.",
      tasks: ["Second earthing-up about 2 weeks after the first", "Finish all fertilizer applications by around 5 weeks after emergence — this is peak nutrient uptake", "Move to a weekly fungicide spray rotation if the weather is wet or humid"],
      tips: [],
      warnings: ["This is the peak risk period for late blight on the foliage", "Rogue out (remove) any plant showing bacterial wilt symptoms immediately", "Aphids can still be spreading virus"] },
    { cropId: 5, stage: "Tuber Bulking", stageOrder: 4, dayFrom: 60, dayTo: 90, title: "Tuber Bulking (Day 60-90)",
      description: "Tubers swell and put on most of their bulk.",
      tasks: ["Keep soil moisture even — stress now causes cracking and secondary growth", "Make sure hills stay well-covered so light and pests can't reach the tubers", "Continue your blight spray rotation"],
      tips: [],
      warnings: ["Late blight spores can wash down into the soil and infect tubers directly — good hilling is your main defense", "Potato tuber moth larvae can enter tubers exposed near the surface"] },
    { cropId: 5, stage: "Maturity & Harvest", stageOrder: 5, dayFrom: 90, dayTo: undefined, title: "Maturity & Harvest (Day 90-120)",
      description: "The vines die back naturally and tubers are ready to lift.",
      tasks: ["Reduce and then stop irrigation as the vines yellow", "Let the haulm die back naturally (or cut it about 2 weeks before harvest for seed crops) to firm up the skins", "Harvest, cure in shade and keep tubers out of direct sunlight so they don't green"],
      tips: [],
      warnings: ["Potato tuber moth is a major storage pest that starts its damage in the field", "Harvesting into wet conditions raises the risk of soft rot and blackleg"] },

    // ── Beans (cropId 7) — day 0 = sowing, bush type ──
    { cropId: 7, stage: "Germination & Emergence", stageOrder: 1, dayFrom: 0, dayTo: 8, title: "Germination & Emergence (Day 0-8)",
      description: "Seeds sprout and push through the soil.",
      tasks: ["Plant certified, disease-free seed — anthracnose and bacterial blight are both seed-borne", "Apply basal DAP in the furrow, not touching the seed directly", "Space rows about 40-50cm apart with 10-15cm between plants"],
      tips: [],
      warnings: ["Bean fly (bean stem maggot) does its worst damage right at seedling stage", "Watch for seed rot and cutworms"] },
    { cropId: 7, stage: "Vegetative Growth", stageOrder: 2, dayFrom: 8, dayTo: 28, title: "Vegetative Growth (Day 8-28)",
      description: "The plant builds leaves and stems.",
      tasks: ["First weeding around 2 weeks", "Earth up soil around the stems at 2-3 weeks — this reduces bean fly damage and supports the stems", "Keep scouting regularly"],
      tips: [],
      warnings: ["Bean fly damage continues through this stage", "Watch for angular leaf spot and common bacterial blight starting on leaves", "Aphids"] },
    { cropId: 7, stage: "Flowering", stageOrder: 3, dayFrom: 28, dayTo: 40, title: "Flowering (Day 28-40)",
      description: "The crop flowers and starts setting pods.",
      tasks: ["Only top-dress with CAN or urea if you see clear deficiency symptoms", "Avoid waterlogging — it causes flowers to abort", "Minimize spraying during flowering to protect pollinators"],
      tips: [],
      warnings: ["Bean rust, angular leaf spot, aphids and thrips are all common now", "Bean common mosaic virus can show up on new growth"] },
    { cropId: 7, stage: "Pod Formation & Filling", stageOrder: 4, dayFrom: 40, dayTo: 65, title: "Pod Formation & Filling (Day 40-65)",
      description: "Pods form and fill with seed — the second most water-sensitive stage after flowering.",
      tasks: ["Make sure the crop has consistent soil moisture", "Scout for and control pod borers and pod-sucking bugs"],
      tips: [],
      warnings: ["Anthracnose causes sunken lesions on pods and spreads fast in wet weather", "Watch for pod borers and continuing rust or angular leaf spot"] },
    { cropId: 7, stage: "Maturity & Harvest", stageOrder: 5, dayFrom: 65, dayTo: undefined, title: "Maturity & Harvest (Day 65-90)",
      description: "Pods dry down and are ready to pick before they shatter.",
      tasks: ["Withhold irrigation as pods yellow and dry", "Harvest when pods are dry and rattle — don't wait too long or they'll shatter and drop seed", "Sun-dry, thresh, and dry grain to 13-14% moisture before storing"],
      tips: [],
      warnings: ["Anthracnose can still cause pod lesions right up to harvest", "Bruchids/bean weevils move from the field into stored grain — clean storage matters", "Rain on drying pods risks mold"] },
  ];
  await cropGuides.insertMany(guideData.map((g, i) => ({ ...g, id: i + 1 })));

  // ratePerAcreKg (KALRO/NPCK-sourced where noted — see commit message)
  // powers the fertilizer-quantity calculator: rate × a farmer's own plot
  // size = how much to actually buy. Left unset wherever the honest
  // agronomic answer is "depends on soil test / deficiency symptoms" —
  // e.g. beans top-dress has no fixed rate and never will here.
  const scheduleData = [
    // Maize
    { cropId: 3, stage: "Germination & Emergence", dayFrom: 0,   dayTo: 0,   activityType: "fertilizer", productName: "DAP (basal)",             dosage: "50 kg/acre (1 bag) — or 100 kg/acre NPK 23:23:0 if soil is acidic", ratePerAcreKg: 50, instructions: "Apply in the planting furrow at planting, not touching the seed directly." },
    { cropId: 3, stage: "Vegetative Growth",        dayFrom: 30,  dayTo: 42,  activityType: "fertilizer", productName: "CAN or Urea (top-dress)", dosage: "50 kg/acre (1 bag)",       ratePerAcreKg: 50, instructions: "Apply once the crop is knee-high. Split into two applications in high-rainfall areas." },
    { cropId: 3, stage: "Flowering",                dayFrom: 70,  dayTo: 85,  activityType: "fertilizer", productName: "CAN or Urea (2nd split)", dosage: "~40 kg/acre",              ratePerAcreKg: 40, instructions: "Only needed in high-rainfall areas — apply just before tasseling, 10-15 days after the first split." },
    { cropId: 3, stage: "Maturity & Harvest",        dayFrom: 115, dayTo: 140, activityType: "harvest",    productName: undefined,               dosage: undefined,                         instructions: "Harvest at physiological maturity (black layer at kernel base, ~30-35% grain moisture). Dry to 13% moisture or below before storage." },
    // Tomato
    { cropId: 1, stage: "Establishment",       dayFrom: 10, dayTo: 14,  activityType: "fertilizer", productName: "DAP (basal)",                     dosage: "~80 kg/acre typical",   ratePerAcreKg: 80, instructions: "Apply once roots have established after transplanting." },
    { cropId: 1, stage: "Vegetative Growth",   dayFrom: 25, dayTo: 30,  activityType: "fertilizer", productName: "CAN (top-dress)",                 dosage: "40 kg/acre",             ratePerAcreKg: 40, instructions: "Apply around 4 weeks after transplanting." },
    { cropId: 1, stage: "Flowering",           dayFrom: 50, dayTo: 56,  activityType: "fertilizer", productName: "CAN (2nd split) or NPK 17:17:17", dosage: "~80 kg/acre if using CAN", ratePerAcreKg: 80, instructions: "KALRO's own guidance is a second CAN split around week 8; a potassium-rich feed like NPK 17:17:17 to support fruit set is also common practice." },
    { cropId: 1, stage: "Fruit Development",   dayFrom: 50, dayTo: 100, activityType: "fungicide",  productName: undefined,             dosage: "Weekly in wet weather", instructions: "Protectant fungicide program against late blight — increase frequency in cool, wet conditions." },
    { cropId: 1, stage: "Maturity & Harvest",  dayFrom: 75, dayTo: 120, activityType: "harvest",    productName: undefined,             dosage: undefined,               instructions: "Harvest every 2-3 days at breaker to ripe stage. Respect the pre-harvest interval on your last spray." },
    // Potato
    { cropId: 5, stage: "Planting & Emergence",           dayFrom: 0,  dayTo: 0,  activityType: "fertilizer", productName: "Potato compound fertilizer (basal)", dosage: "~200 kg/acre typical (4 bags)", ratePerAcreKg: 200, instructions: "Apply at planting. DAP alone supplies no potassium, which potato needs a lot of — a blended NPK based on a soil test is agronomically better where available." },
    { cropId: 5, stage: "Vegetative Growth",              dayFrom: 21, dayTo: 28, activityType: "fertilizer", productName: "CAN or potato top-dress",            dosage: "~100 kg/acre typical (2 bags)", ratePerAcreKg: 100, instructions: "Apply 3-4 weeks after emergence." },
    { cropId: 5, stage: "Tuber Initiation & Flowering",   dayFrom: 40, dayTo: 60, activityType: "fungicide",  productName: undefined,                            dosage: "Weekly in wet weather", instructions: "Blight protection spray rotation through the peak foliar risk period." },
    { cropId: 5, stage: "Maturity & Harvest",             dayFrom: 90, dayTo: 120, activityType: "harvest",   productName: undefined,                            dosage: undefined,               instructions: "Stop irrigation as vines yellow, allow natural die-back, then harvest and cure in shade." },
    // Beans
    { cropId: 7, stage: "Germination & Emergence",  dayFrom: 0,  dayTo: 0,  activityType: "fertilizer", productName: "DAP or NPK (basal)", dosage: "50-75 kg/acre (1-1½ bags)",        ratePerAcreKg: 50, instructions: "Apply in-furrow at planting, not touching the seed. Use 50 kg/acre as a conservative default; go higher on poorer soils." },
    { cropId: 7, stage: "Flowering",                dayFrom: 28, dayTo: 40, activityType: "fertilizer", productName: "CAN or Urea",        dosage: "Only if deficiency symptoms show — no standard rate", instructions: "Beans fix their own nitrogen — light top-dress only if you see yellowing, avoid over-fertilizing at flowering." },
    { cropId: 7, stage: "Pod Formation & Filling",  dayFrom: 40, dayTo: 65, activityType: "irrigation", productName: undefined,      dosage: undefined,                          instructions: "Keep soil moisture consistent through pod filling — the second most drought-sensitive stage after flowering." },
    { cropId: 7, stage: "Maturity & Harvest",       dayFrom: 65, dayTo: 90, activityType: "harvest",    productName: undefined,      dosage: undefined,                          instructions: "Harvest when pods are dry and rattle, before they shatter. Sun-dry and thresh to 13-14% moisture." },
  ];
  await spraySchedules.insertMany(scheduleData.map((s, i) => ({ ...s, id: i + 1 })));

  await counters.bulkWrite([
    { updateOne: { filter: { _id: "crop_guides" },     update: { $set: { seq: guideData.length } },     upsert: true } },
    { updateOne: { filter: { _id: "spray_schedules" }, update: { $set: { seq: scheduleData.length } }, upsert: true } },
  ]);

  console.log(
    `✅ Seeded crop guidance: ${guideData.length} stage guides, ${scheduleData.length} task schedules`,
  );
}

// Gated independently, same reasoning as seedCropGuides() — backfills into
// a database that predates this feature. Only ads are seeded: real SeedPro
// Africa fertilizer products, reusing the same URLs/images the old
// hardcoded blog cards linked to. No events are seeded — unlike a product
// catalog, a fake "upcoming event" with an invented date would be
// presenting made-up information as fact, so that list starts empty for
// an admin to fill in with real ones via the admin panel.
export async function seedAnnouncements(): Promise<void> {
  const existing = await announcements.estimatedDocumentCount();
  if (existing > 0) return;

  const adData = [
    {
      type: "ad", title: "Sure N Vegetative Plus+",
      description: "High-nitrogen fertilizer for maize, potatoes, bananas and vegetables — builds strong vegetative growth before flowering.",
      imageUrl: "/images/blog-fertilizer.jpg", sponsorName: "SeedPro Africa", ctaLabel: "Shop Now",
      ctaUrl: "https://seedpro.co.ke/sure-n-vegetative-plus-the-best-high-nitrogen-fertilizer-for-maize-potatoes-bananas-and-vegetables-in-kenya/",
      active: true,
    },
    {
      type: "ad", title: "CalciTopper for Potatoes",
      description: "The top-dressing fertilizer more Kenyan potato farmers are switching to for bigger tubers and higher yields.",
      imageUrl: "/images/crop-potato.jpg", sponsorName: "SeedPro Africa", ctaLabel: "Learn More",
      ctaUrl: "https://seedpro.co.ke/calcitopper-for-potatoes-the-best-top-dressing-fertilizer-for-higher-yields-and-bigger-tubers/",
      active: true,
    },
    {
      type: "ad", title: "SeedPro Organo-Mineral Fertilizers",
      description: "Why more Kenyan farmers are switching for maximum crop yields — organo-mineral fertilizer built for local soils.",
      imageUrl: "/images/blog-fertilizer.jpg", sponsorName: "SeedPro Africa", ctaLabel: "Shop Now",
      ctaUrl: "https://seedpro.co.ke/best-fertilizers-in-kenya-for-maximum-crop-yields-why-seedpro-organo-mineral-fertilizers-are-transforming-modern-farming/",
      active: true,
    },
  ];
  await announcements.insertMany(adData.map((a, i) => ({ ...a, id: i + 1 })));
  await counters.updateOne({ _id: "announcements" }, { $set: { seq: adData.length } }, { upsert: true });

  console.log(`✅ Seeded announcements: ${adData.length} fertilizer ads, 0 events (add real ones via the admin panel)`);
}
