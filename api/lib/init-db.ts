import { createRequire } from "module";
import path from "path";

const require = createRequire(process.cwd() + "/package.json");
const Database = require("better-sqlite3");
const dbPath = path.resolve(process.cwd(), "seedpro.db");

export function initDb() {
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  // Create all tables if they don't exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      unionId      TEXT    NOT NULL UNIQUE,
      name         TEXT,
      email        TEXT,
      avatar       TEXT,
      role         TEXT    NOT NULL DEFAULT 'user',
      userType     TEXT    NOT NULL DEFAULT 'farmer',
      phone        TEXT,
      location     TEXT,
      bio          TEXT,
      verified     INTEGER DEFAULT 0,
      rating       REAL    DEFAULT 0.0,
      reviewCount  INTEGER DEFAULT 0,
      createdAt    TEXT    NOT NULL DEFAULT (datetime('now')),
      updatedAt    TEXT    NOT NULL DEFAULT (datetime('now')),
      lastSignInAt TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS crops (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      category      TEXT NOT NULL,
      icon          TEXT,
      image         TEXT,
      description   TEXT,
      growingPeriod INTEGER,
      typicalYield  TEXT,
      createdAt     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS listings (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      farmerId      INTEGER NOT NULL,
      cropId        INTEGER NOT NULL,
      cropName      TEXT    NOT NULL,
      quantity      INTEGER NOT NULL,
      quantityUnit  TEXT    DEFAULT 'kg',
      location      TEXT    NOT NULL,
      harvestDate   TEXT,
      expectedPrice REAL    NOT NULL,
      currency      TEXT    DEFAULT 'KES',
      description   TEXT,
      images        TEXT,
      status        TEXT    NOT NULL DEFAULT 'active',
      createdAt     TEXT    NOT NULL DEFAULT (datetime('now')),
      updatedAt     TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      listingId      INTEGER NOT NULL,
      buyerId        INTEGER NOT NULL,
      farmerId       INTEGER NOT NULL,
      quantity       INTEGER NOT NULL,
      price          REAL    NOT NULL,
      totalAmount    REAL    NOT NULL,
      deliveryMethod TEXT    DEFAULT 'pickup',
      notes          TEXT,
      status         TEXT    NOT NULL DEFAULT 'pending',
      createdAt      TEXT    NOT NULL DEFAULT (datetime('now')),
      updatedAt      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS market_prices (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      cropId         INTEGER NOT NULL,
      cropName       TEXT    NOT NULL,
      town           TEXT    NOT NULL,
      wholesalePrice REAL    NOT NULL,
      retailPrice    REAL    NOT NULL,
      currency       TEXT    DEFAULT 'KES',
      trend          TEXT    DEFAULT 'stable',
      trendPercent   REAL    DEFAULT 0,
      priceDate      TEXT    NOT NULL,
      createdAt      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ratings (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      reviewerId INTEGER NOT NULL,
      revieweeId INTEGER NOT NULL,
      orderId    INTEGER,
      rating     INTEGER NOT NULL,
      review     TEXT,
      tags       TEXT,
      createdAt  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cropGuides (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      cropId      INTEGER NOT NULL,
      stage       TEXT    NOT NULL,
      stageOrder  INTEGER NOT NULL,
      title       TEXT    NOT NULL,
      description TEXT    NOT NULL,
      tasks       TEXT,
      tips        TEXT,
      warnings    TEXT,
      createdAt   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS spraySchedules (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      cropId       INTEGER NOT NULL,
      stage        TEXT    NOT NULL,
      dayFrom      INTEGER NOT NULL,
      dayTo        INTEGER,
      activityType TEXT    NOT NULL,
      productName  TEXT,
      dosage       TEXT,
      instructions TEXT,
      reminderSent INTEGER DEFAULT 0,
      createdAt    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS diagnoses (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      farmerId    INTEGER NOT NULL,
      cropId      INTEGER,
      cropName    TEXT,
      photoUrl    TEXT    NOT NULL,
      description TEXT,
      diagnosis   TEXT,
      treatment   TEXT,
      status      TEXT    DEFAULT 'pending',
      createdAt   TEXT    NOT NULL DEFAULT (datetime('now')),
      updatedAt   TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS advisoryMessages (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      userId      INTEGER NOT NULL,
      cropId      INTEGER,
      direction   TEXT    NOT NULL,
      content     TEXT    NOT NULL,
      messageType TEXT    DEFAULT 'text',
      metadata    TEXT,
      createdAt   TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS zones (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL,
      aggregatorId INTEGER NOT NULL,
      towns        TEXT,
      description  TEXT,
      active       INTEGER DEFAULT 1,
      createdAt    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS priceAlerts (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      userId             INTEGER NOT NULL,
      cropName           TEXT    NOT NULL,
      town               TEXT,
      condition          TEXT    NOT NULL,
      targetPrice        REAL    NOT NULL,
      notificationMethod TEXT    DEFAULT 'in_app',
      active             INTEGER DEFAULT 1,
      triggered          INTEGER DEFAULT 0,
      createdAt          TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mpesa_payments (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      orderId            INTEGER,
      checkoutRequestId  TEXT UNIQUE,
      merchantRequestId  TEXT,
      phone              TEXT    NOT NULL,
      amount             REAL    NOT NULL,
      accountRef         TEXT,
      status             TEXT    NOT NULL DEFAULT 'pending',
      mpesaReceiptNumber TEXT,
      transactionDate    TEXT,
      resultCode         INTEGER,
      resultDesc         TEXT,
      rawCallback        TEXT,
      createdAt          TEXT    NOT NULL DEFAULT (datetime('now')),
      updatedAt          TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Seed only on first run (when crops table is empty)
  const cropCount = (sqlite.prepare("SELECT COUNT(*) as n FROM crops").get() as any).n;
  if (cropCount === 0) {
    seedData(sqlite);
  }

  sqlite.close();
  console.log("✅ SeedPro database ready at seedpro.db");
}

function seedData(sqlite: any) {
  const today = new Date().toISOString().split("T")[0];

  const crops = [
    { name: "Tomato",      category: "vegetables",  icon: "🍅", description: "High-value fruit vegetable.",      growingPeriod: 75,  typicalYield: "15-25 tons/acre" },
    { name: "Onion",       category: "vegetables",  icon: "🧅", description: "Bulb vegetable, excellent shelf life.", growingPeriod: 105, typicalYield: "12-18 tons/acre" },
    { name: "Maize",       category: "grains",      icon: "🌽", description: "Staple grain crop.",               growingPeriod: 110, typicalYield: "2-4 tons/acre"  },
    { name: "Coffee",      category: "cash_crops",  icon: "☕", description: "High-value cash crop.",            growingPeriod: 365, typicalYield: "800-1500 kg/acre"},
    { name: "Potato",      category: "vegetables",  icon: "🥔", description: "Root tuber, high nutrition.",      growingPeriod: 90,  typicalYield: "8-15 tons/acre" },
    { name: "Cabbage",     category: "vegetables",  icon: "🥬", description: "Leafy vegetable.",                growingPeriod: 75,  typicalYield: "20-30 tons/acre"},
    { name: "Beans",       category: "legumes",     icon: "🫘", description: "Protein-rich legume.",            growingPeriod: 75,  typicalYield: "1-2 tons/acre"  },
    { name: "Pishori Rice",category: "grains",      icon: "🍚", description: "Premium Kenya rice.",             growingPeriod: 120, typicalYield: "3-5 tons/acre"  },
    { name: "Tea",         category: "cash_crops",  icon: "🍵", description: "Major Kenyan export crop.",       growingPeriod: 365, typicalYield: "1500-2500 kg/acre"},
    { name: "Avocado",     category: "fruits",      icon: "🥑", description: "High-demand export fruit.",      growingPeriod: 365, typicalYield: "5-10 tons/acre" },
    { name: "Banana",      category: "fruits",      icon: "🍌", description: "Fast-growing tropical fruit.",   growingPeriod: 270, typicalYield: "10-30 tons/acre"},
    { name: "French Beans",category: "vegetables",  icon: "🫛", description: "High-value export vegetable.",   growingPeriod: 65,  typicalYield: "4-6 tons/acre"  },
  ];

  const insertCrop = sqlite.prepare(
    "INSERT INTO crops (name, category, icon, description, growingPeriod, typicalYield) VALUES (@name, @category, @icon, @description, @growingPeriod, @typicalYield)"
  );
  for (const c of crops) insertCrop.run(c);

  const farmers = [
    { unionId: "farmer_001", name: "Grace Achieng",  phone: "+254712345678", location: "Kisumu",   verified: 1, rating: 4.9, reviewCount: 28, userType: "farmer" },
    { unionId: "farmer_002", name: "James Mwangi",   phone: "+254723456789", location: "Nakuru",   verified: 1, rating: 4.8, reviewCount: 45, userType: "farmer" },
    { unionId: "farmer_003", name: "Mary Wanjiku",   phone: "+254734567890", location: "Thika",    verified: 1, rating: 5.0, reviewCount: 19, userType: "farmer" },
    { unionId: "farmer_004", name: "Peter Njoroge",  phone: "+254745678901", location: "Muranga",  verified: 1, rating: 4.6, reviewCount: 33, userType: "farmer" },
    { unionId: "farmer_005", name: "Aisha Omar",     phone: "+254756789012", location: "Naivasha", verified: 1, rating: 4.7, reviewCount: 22, userType: "farmer" },
    { unionId: "buyer_001",  name: "Jane Wanjiru",   phone: "+254767890123", location: "Nairobi",  verified: 1, rating: 4.6, reviewCount: 18, userType: "buyer"  },
  ];

  const insertUser = sqlite.prepare(
    "INSERT INTO users (unionId, name, phone, location, verified, rating, reviewCount, userType) VALUES (@unionId, @name, @phone, @location, @verified, @rating, @reviewCount, @userType)"
  );
  for (const u of farmers) insertUser.run(u);

  // Seed listings
  const listingData = [
    { farmerId: 1, cropId: 1,  cropName: "Tomato",       quantity: 500,  location: "Kisumu",   expectedPrice: 95,  description: "Fresh cherry tomatoes, Grade A" },
    { farmerId: 2, cropId: 3,  cropName: "Maize",        quantity: 2000, location: "Nakuru",   expectedPrice: 42,  description: "Dry maize, moisture below 14%" },
    { farmerId: 3, cropId: 4,  cropName: "Coffee",       quantity: 300,  location: "Thika",    expectedPrice: 320, description: "Arabica AA grade, wet-processed" },
    { farmerId: 4, cropId: 10, cropName: "Avocado",      quantity: 800,  location: "Muranga",  expectedPrice: 85,  description: "Hass avocado, export quality" },
    { farmerId: 5, cropId: 2,  cropName: "Onion",        quantity: 1000, location: "Naivasha", expectedPrice: 110, description: "Red onion, well-cured, large bulbs" },
    { farmerId: 1, cropId: 7,  cropName: "Beans",        quantity: 400,  location: "Kisumu",   expectedPrice: 135, description: "Rose coco beans, machine-cleaned" },
    { farmerId: 2, cropId: 8,  cropName: "Pishori Rice", quantity: 600,  location: "Mwea",     expectedPrice: 185, description: "Premium Pishori, 2026 harvest" },
    { farmerId: 3, cropId: 9,  cropName: "Tea",          quantity: 200,  location: "Kericho",  expectedPrice: 280, description: "BOP grade, KTDA certified" },
    { farmerId: 4, cropId: 11, cropName: "Banana",       quantity: 700,  location: "Kisii",    expectedPrice: 48,  description: "Uganda Giant, ready bunches" },
    { farmerId: 5, cropId: 6,  cropName: "Cabbage",      quantity: 1500, location: "Nakuru",   expectedPrice: 35,  description: "Round-head cabbage, 1-2kg each" },
    { farmerId: 1, cropId: 12, cropName: "French Beans", quantity: 250,  location: "Meru",     expectedPrice: 145, description: "Export-grade, bobby variety" },
    { farmerId: 2, cropId: 5,  cropName: "Potato",       quantity: 3000, location: "Nyandarua",expectedPrice: 58,  description: "Shangi potato, freshly harvested" },
  ];

  const insertListing = sqlite.prepare(
    "INSERT INTO listings (farmerId, cropId, cropName, quantity, location, expectedPrice, description, status) VALUES (@farmerId, @cropId, @cropName, @quantity, @location, @expectedPrice, @description, 'active')"
  );
  for (const l of listingData) insertListing.run(l);

  // Seed market prices for key towns
  const towns = ["Nairobi", "Nakuru", "Kisumu", "Mombasa", "Eldoret"];
  const prices = [
    { cropId: 1,  cropName: "Tomato",       wholesale: 95,  retail: 140, trend: "up",   trendPercent: 12 },
    { cropId: 2,  cropName: "Onion",        wholesale: 110, retail: 150, trend: "up",   trendPercent: 15 },
    { cropId: 3,  cropName: "Maize",        wholesale: 42,  retail: 62,  trend: "down", trendPercent: 3  },
    { cropId: 4,  cropName: "Coffee",       wholesale: 320, retail: 420, trend: "up",   trendPercent: 8  },
    { cropId: 5,  cropName: "Potato",       wholesale: 58,  retail: 82,  trend: "up",   trendPercent: 5  },
    { cropId: 6,  cropName: "Cabbage",      wholesale: 35,  retail: 52,  trend: "down", trendPercent: 2  },
    { cropId: 7,  cropName: "Beans",        wholesale: 135, retail: 175, trend: "down", trendPercent: 4  },
    { cropId: 8,  cropName: "Pishori Rice", wholesale: 185, retail: 240, trend: "stable",trendPercent:0  },
    { cropId: 9,  cropName: "Tea",          wholesale: 280, retail: 360, trend: "up",   trendPercent: 4  },
    { cropId: 10, cropName: "Avocado",      wholesale: 85,  retail: 115, trend: "up",   trendPercent: 9  },
    { cropId: 11, cropName: "Banana",       wholesale: 48,  retail: 68,  trend: "up",   trendPercent: 7  },
    { cropId: 12, cropName: "French Beans", wholesale: 145, retail: 195, trend: "up",   trendPercent: 8  },
  ];

  const insertPrice = sqlite.prepare(
    "INSERT INTO market_prices (cropId, cropName, town, wholesalePrice, retailPrice, trend, trendPercent, priceDate) VALUES (@cropId, @cropName, @town, @wholesale, @retail, @trend, @trendPercent, @today)"
  );
  for (const town of towns) {
    for (const p of prices) {
      const variance = (Math.random() * 0.1 - 0.05); // ±5% per town
      insertPrice.run({
        ...p,
        wholesale: Math.round(p.wholesale * (1 + variance)),
        retail:    Math.round(p.retail    * (1 + variance)),
        town,
        today,
      });
    }
  }

  console.log("✅ Database seeded with Kenya farm data");
}
