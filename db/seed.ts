import { getDb } from "../api/queries/connection";
import {
  crops,
  marketPrices,
  cropGuides,
  spraySchedules,
  listings,
  ratings,
  users,
} from "./schema";
import { sql } from "drizzle-orm";

async function seed() {
  const db = getDb();
  console.log("Seeding SeedPro database...");

  // ─── Seed Crops ───
  console.log("Seeding crops...");
  const cropData = [
    { name: "Tomato", category: "vegetables" as const, icon: "\uD83C\uDF45", description: "High-value fruit vegetable, popular in salads and sauces. Growing period: 60-80 days.", growingPeriod: 75, typicalYield: "15-25 tons/acre", image: "/images/crop-tomato.jpg" },
    { name: "Onion", category: "vegetables" as const, icon: "\uD83E\uDDC5", description: "Bulb vegetable with excellent storage life. Growing period: 90-120 days.", growingPeriod: 105, typicalYield: "12-18 tons/acre", image: "/images/crop-onion.jpg" },
    { name: "Maize", category: "grains" as const, icon: "\uD83C\uDF3D", description: "Staple grain crop, versatile for food and feed. Growing period: 90-120 days.", growingPeriod: 110, typicalYield: "2-4 tons/acre", image: "/images/crop-maize.jpg" },
    { name: "Coffee", category: "cash_crops" as const, icon: "\u2615", description: "High-value cash crop, major export commodity. Perennial tree crop.", growingPeriod: 365, typicalYield: "800-1500 kg/acre", image: "/images/crop-coffee.jpg" },
    { name: "Potato", category: "vegetables" as const, icon: "\uD83E\uDD54", description: "Root tuber crop, high nutritional value. Growing period: 70-120 days.", growingPeriod: 90, typicalYield: "8-15 tons/acre", image: "/images/crop-potato.jpg" },
    { name: "Cabbage", category: "vegetables" as const, icon: "\uD83E\uDD6C", description: "Leafy vegetable, popular in local markets. Growing period: 60-90 days.", growingPeriod: 75, typicalYield: "20-30 tons/acre", image: "/images/crop-cabbage.jpg" },
    { name: "Beans", category: "legumes" as const, icon: "\uD83E\uDDED", description: "Protein-rich legume, nitrogen-fixing crop. Growing period: 60-90 days.", growingPeriod: 75, typicalYield: "1-2 tons/acre", image: "/images/crop-tomato.jpg" },
    { name: "Rice", category: "grains" as const, icon: "\uD83C\uDF5A", description: "Staple grain for many households. Growing period: 90-150 days.", growingPeriod: 120, typicalYield: "3-5 tons/acre", image: "/images/crop-maize.jpg" },
    { name: "Eggplant", category: "vegetables" as const, icon: "\uD83C\uDF46", description: "Purple fruit vegetable, popular in local cuisine. Growing period: 70-90 days.", growingPeriod: 80, typicalYield: "10-15 tons/acre", image: "/images/crop-tomato.jpg" },
    { name: "Tea", category: "cash_crops" as const, icon: "\uD83C\uDF75", description: "Major Kenyan export crop grown in highland regions. Perennial shrub.", growingPeriod: 365, typicalYield: "1500-2500 kg/acre", image: "/images/crop-tea.jpg" },
    { name: "Avocado", category: "fruits" as const, icon: "\uD83E\uDD51", description: "High-demand export fruit, popular in Murang'a and Kisii.", growingPeriod: 365, typicalYield: "5-10 tons/acre", image: "/images/crop-avocado.jpg" },
    { name: "Banana", category: "fruits" as const, icon: "\uD83C\uDF4C", description: "Staple fruit crop, widely grown in western Kenya.", growingPeriod: 270, typicalYield: "15-25 tons/acre", image: "/images/crop-banana.jpg" },
    { name: "French Beans", category: "vegetables" as const, icon: "\uD83E\uDEBB", description: "Export vegetable, high-value when grown for EU markets.", growingPeriod: 60, typicalYield: "4-8 tons/acre", image: "/images/crop-tomato.jpg" },
    { name: "Sukuma Wiki", category: "vegetables" as const, icon: "\uD83E\uDD6C", description: "Kenyan kale, staple vegetable sold daily in local markets.", growingPeriod: 45, typicalYield: "8-12 tons/acre", image: "/images/crop-cabbage.jpg" },
  ];

  for (const crop of cropData) {
    await db.insert(crops).values(crop);
  }

  // ─── Seed Market Prices ───
  console.log("Seeding market prices...");
  const towns = ["Nairobi", "Nakuru", "Eldoret", "Kisumu", "Mombasa", "Thika", "Nyeri", "Meru", "Machakos", "Kiambu", "Kakamega", "Naivasha"];
  const today = new Date();

  const priceData = [
    { cropName: "Tomato", wholesale: 95, retail: 140, category: "vegetables" },
    { cropName: "Onion", wholesale: 75, retail: 110, category: "vegetables" },
    { cropName: "Maize", wholesale: 55, retail: 75, category: "grains" },
    { cropName: "Coffee", wholesale: 420, retail: 580, category: "cash_crops" },
    { cropName: "Potato", wholesale: 65, retail: 90, category: "vegetables" },
    { cropName: "Cabbage", wholesale: 40, retail: 60, category: "vegetables" },
    { cropName: "Beans", wholesale: 150, retail: 200, category: "legumes" },
    { cropName: "Rice", wholesale: 120, retail: 160, category: "grains" },
    { cropName: "Eggplant", wholesale: 80, retail: 120, category: "vegetables" },
    { cropName: "Tea", wholesale: 280, retail: 380, category: "cash_crops" },
    { cropName: "Avocado", wholesale: 55, retail: 85, category: "fruits" },
    { cropName: "Banana", wholesale: 35, retail: 55, category: "fruits" },
    { cropName: "French Beans", wholesale: 90, retail: 130, category: "vegetables" },
    { cropName: "Sukuma Wiki", wholesale: 30, retail: 50, category: "vegetables" },
  ];

  for (const town of towns) {
    for (const pd of priceData) {
      const trendVar = Math.random() > 0.5 ? "up" : Math.random() > 0.5 ? "down" : "stable";
      const trendPercent = (Math.random() * 10 - 3).toFixed(2);

      await db.insert(marketPrices).values({
        cropId: cropData.findIndex((c) => c.name === pd.cropName) + 1,
        cropName: pd.cropName,
        town,
        wholesalePrice: (pd.wholesale * (0.8 + Math.random() * 0.4)).toFixed(0),
        retailPrice: (pd.retail * (0.8 + Math.random() * 0.4)).toFixed(0),
        currency: "KES",
        trend: trendVar as any,
        trendPercent: trendPercent,
        priceDate: today,
      });
    }
  }

  // ─── Seed Crop Guides ───
  console.log("Seeding crop guides...");
  const guideData = [
    // Tomato guides
    { cropName: "Tomato", stage: "nursery" as const, stageOrder: 1, title: "Nursery Setup & Seedling Care", description: "Prepare seedbeds and sow tomato seeds. Maintain moisture and temperature for optimal germination.", tasks: ["Prepare seedbed with compost mix", "Sow seeds 1cm deep, 2cm apart", "Water lightly twice daily", "Provide shade for first 2 weeks"], tips: ["Use certified seeds for best results", "Keep soil temperature around 25-30\u00B0C"], warnings: ["Avoid overwatering to prevent damping off"] },
    { cropName: "Tomato", stage: "vegetative" as const, stageOrder: 2, title: "Vegetative Growth Management", description: "Transplant seedlings and manage growth. Focus on root establishment and leaf development.", tasks: ["Transplant at 4-6 weeks", "Space plants 60cm apart", "Apply basal fertilizer", "Stake plants early"], tips: ["Water deeply but less frequently", "Mulch to retain soil moisture"], warnings: ["Watch for early pest infestations"] },
    { cropName: "Tomato", stage: "flowering" as const, stageOrder: 3, title: "Flowering Stage Care", description: "Critical stage for fruit set. Ensure proper nutrition and pest management.", tasks: ["Apply NPK 17:17:17 at 50g/plant", "Water consistently 2-3x/week", "Monitor for whiteflies and aphids", "Stake and prune suckers"], tips: ["Calcium application prevents blossom end rot", "Avoid water stress during flowering"], warnings: ["Blossom drop occurs with extreme temperatures"] },
    { cropName: "Tomato", stage: "fruiting" as const, stageOrder: 4, title: "Fruit Development", description: "Manage fruit load and ensure quality development. Protect from pests and diseases.", tasks: ["Continue regular watering", "Apply potassium-rich fertilizer", "Monitor for late blight", "Remove damaged fruits"], tips: ["Consistent watering improves fruit quality", "Support heavy branches"], warnings: ["Irregular watering causes fruit cracking"] },
    { cropName: "Tomato", stage: "harvest" as const, stageOrder: 5, title: "Harvesting & Post-Harvest", description: "Harvest at optimal ripeness. Handle carefully to maintain quality.", tasks: ["Harvest early morning", "Pick when fully colored", "Use clean sharp tools", "Grade by size and quality"], tips: ["Harvest every 2-3 days during peak", "Store in cool shaded area"], warnings: ["Avoid bruising during handling"] },
    // Onion guides
    { cropName: "Onion", stage: "nursery" as const, stageOrder: 1, title: "Onion Nursery Preparation", description: "Start onion seeds in a well-prepared nursery bed.", tasks: ["Prepare fine seedbed", "Sow seeds in rows 15cm apart", "Cover lightly with soil", "Water gently"], tips: ["Use fresh seeds for best germination", "Thin overcrowded seedlings"], warnings: ["Protect from heavy rain"] },
    { cropName: "Onion", stage: "vegetative" as const, stageOrder: 2, title: "Transplanting & Growth", description: "Transplant seedlings to the field and establish plants.", tasks: ["Transplant at pencil thickness", "Space 10cm between plants", "Apply phosphorus fertilizer", "Weed regularly"], tips: ["Water immediately after transplanting", "Hoe carefully to avoid root damage"], warnings: ["Do not bury the bulb too deep"] },
    { cropName: "Onion", stage: "bulbing" as const, stageOrder: 3, title: "Bulb Formation Stage", description: "Critical stage for bulb development. Reduce watering as bulbs mature.", tasks: ["Reduce watering frequency", "Stop nitrogen application", "Ensure good drainage", "Monitor for thrips"], tips: ["Longer daylight promotes bulbing", "Maintain weed-free field"], warnings: ["Excess water causes rotting"] },
    // Maize guides
    { cropName: "Maize", stage: "nursery" as const, stageOrder: 1, title: "Planting & Germination", description: "Direct planting of maize seeds in prepared field.", tasks: ["Prepare planting holes 25cm deep", "Plant 2-3 seeds per hole", "Cover and firm soil", "Apply basal DAP fertilizer"], tips: ["Plant at onset of rains", "Space 75cm between rows, 30cm within"], warnings: ["Avoid planting in waterlogged soil"] },
    { cropName: "Maize", stage: "vegetative" as const, stageOrder: 2, title: "Vegetative Growth", description: "Manage weed control and side-dress with fertilizer.", tasks: ["Thin to 1 plant per hole", "Side-dress with CAN fertilizer", "Weed at 3 and 6 weeks", "Earth up at knee height"], tips: ["Top-dress when plants are 30cm tall", "Maintain weed-free first 8 weeks"], warnings: ["Striga weed is a serious threat"] },
    { cropName: "Maize", stage: "flowering" as const, stageOrder: 3, title: "Tasseling & Silking", description: "Ensure adequate moisture during pollination.", tasks: ["Maintain soil moisture", "Watch for stalk borers", "Support lodged plants", "Monitor grain filling"], tips: ["Water stress at silking reduces yield significantly"], warnings: ["Bird damage can be severe at this stage"] },
    // Coffee guides
    { cropName: "Coffee", stage: "vegetative" as const, stageOrder: 2, title: "Tree Maintenance", description: "Prune and maintain coffee trees for optimal production.", tasks: ["Prune old and diseased branches", "Mulch around base", "Apply organic manure", "Control weeds"], tips: ["Shape trees for sunlight penetration", "Maintain 2-3 main stems"], warnings: ["Over-pruning reduces yield"] },
    { cropName: "Coffee", stage: "flowering" as const, stageOrder: 3, title: "Flowering Management", description: "Coffee trees flower after rains. Ensure nutrition for good fruit set.", tasks: ["Apply NPK fertilizer before rains", "Monitor for CBD disease", "Maintain shade levels", "Irrigate if rains delay"], tips: ["Flowering occurs 2-3 weeks after heavy rain"], warnings: ["Frost and hail can destroy flowers"] },
    { cropName: "Coffee", stage: "harvest" as const, stageOrder: 5, title: "Cherry Harvesting", description: "Pick only ripe red cherries for best quality.", tasks: ["Pick only ripe red cherries", "Harvest every 2 weeks", "Sort by ripeness", "Process same day"], tips: ["Wet processing gives better quality", "Dry cherries on raised beds"], warnings: ["Over-ripe cherries ferment quickly"] },
  ];

  for (const guide of guideData) {
    const crop = cropData.find((c) => c.name === guide.cropName);
    if (crop) {
      await db.insert(cropGuides).values({
        cropId: cropData.indexOf(crop) + 1,
        stage: guide.stage,
        stageOrder: guide.stageOrder,
        title: guide.title,
        description: guide.description,
        tasks: guide.tasks,
        tips: guide.tips,
        warnings: guide.warnings,
      });
    }
  }

  // ─── Seed Spray Schedules ───
  console.log("Seeding spray schedules...");
  const scheduleData = [
    { cropName: "Tomato", stage: "nursery", dayFrom: 1, dayTo: 14, activityType: "fertilizer" as const, productName: "Compost Tea", dosage: "Dilute 1:10, apply weekly", instructions: "Apply light compost tea to seedlings" },
    { cropName: "Tomato", stage: "vegetative", dayFrom: 15, dayTo: 30, activityType: "fertilizer" as const, productName: "NPK 17:17:17", dosage: "50g per plant", instructions: "Apply in ring around plant base" },
    { cropName: "Tomato", stage: "vegetative", dayFrom: 20, dayTo: 40, activityType: "pesticide" as const, productName: "Neem Extract", dosage: "5ml per liter water", instructions: "Spray every 10 days for aphid control" },
    { cropName: "Tomato", stage: "flowering", dayFrom: 40, dayTo: 60, activityType: "fertilizer" as const, productName: "Calcium Nitrate", dosage: "30g per plant", instructions: "Apply to prevent blossom end rot" },
    { cropName: "Tomato", stage: "flowering", dayFrom: 45, dayTo: 70, activityType: "fungicide" as const, productName: "Mancozeb", dosage: "2g per liter", instructions: "Spray every 14 days for blight prevention" },
    { cropName: "Tomato", stage: "fruiting", dayFrom: 60, dayTo: 80, activityType: "fertilizer" as const, productName: "NPK 10:26:26", dosage: "40g per plant", instructions: "Boost potassium for fruit quality" },
    { cropName: "Tomato", stage: "harvest", dayFrom: 75, dayTo: 90, activityType: "harvest" as const, productName: null, dosage: null, instructions: "Harvest every 2-3 days when fruits are firm red" },
    { cropName: "Onion", stage: "nursery", dayFrom: 1, dayTo: 21, activityType: "irrigation" as const, productName: null, dosage: null, instructions: "Water lightly daily, keep soil moist" },
    { cropName: "Onion", stage: "vegetative", dayFrom: 30, dayTo: 60, activityType: "fertilizer" as const, productName: "Urea", dosage: "20g per meter", instructions: "Side-dress at 4 and 8 weeks" },
    { cropName: "Onion", stage: "bulbing", dayFrom: 60, dayTo: 90, activityType: "pesticide" as const, productName: "Spinosad", dosage: "1ml per liter", instructions: "Control thrips - major onion pest" },
    { cropName: "Maize", stage: "nursery", dayFrom: 1, dayTo: 7, activityType: "fertilizer" as const, productName: "DAP", dosage: "1 teaspoon per hole", instructions: "Apply at planting" },
    { cropName: "Maize", stage: "vegetative", dayFrom: 21, dayTo: 35, activityType: "fertilizer" as const, productName: "CAN", dosage: "1 handful per plant", instructions: "Side-dress when knee-high" },
    { cropName: "Maize", stage: "flowering", dayFrom: 50, dayTo: 70, activityType: "pesticide" as const, productName: "Lambda-cyhalothrin", dosage: "1.5ml per liter", instructions: "Control stalk borers and armyworm" },
    { cropName: "Coffee", stage: "vegetative", dayFrom: 1, dayTo: 90, activityType: "fertilizer" as const, productName: "Organic Compost", dosage: "2kg per tree", instructions: "Apply in March and September" },
    { cropName: "Coffee", stage: "flowering", dayFrom: 120, dayTo: 150, activityType: "fungicide" as const, productName: "Copper-based fungicide", dosage: "3g per liter", instructions: "Spray for Coffee Berry Disease prevention" },
    { cropName: "Coffee", stage: "harvest", dayFrom: 270, dayTo: 300, activityType: "harvest" as const, productName: null, dosage: null, instructions: "Pick only ripe red cherries" },
  ];

  for (const sched of scheduleData) {
    const crop = cropData.find((c) => c.name === sched.cropName);
    if (crop) {
      await db.insert(spraySchedules).values({
        cropId: cropData.indexOf(crop) + 1,
        stage: sched.stage,
        dayFrom: sched.dayFrom,
        dayTo: sched.dayTo,
        activityType: sched.activityType,
        productName: sched.productName,
        dosage: sched.dosage,
        instructions: sched.instructions,
      });
    }
  }

  // ─── Seed Sample Listings ───
  console.log("Seeding sample listings...");
  const listingData = [
    { farmerName: "Wanjiku Kamau", cropName: "Tomato", quantity: 500, location: "Kiambu", expectedPrice: 100, description: "Fresh Anna F1 tomatoes, organically grown in Limuru. Harvested yesterday. Perfect for markets and restaurants.", images: ["/images/crop-tomato.jpg"] },
    { farmerName: "James Otieno", cropName: "Onion", quantity: 200, location: "Nakuru", expectedPrice: 80, description: "Red creole onions, 3 months old. Firm bulbs, excellent storage. Ready for immediate collection.", images: ["/images/crop-onion.jpg"] },
    { farmerName: "Faith Muthoni", cropName: "Maize", quantity: 1000, location: "Eldoret", expectedPrice: 58, description: "Dried white maize, well sorted and graded. Suitable for ugali flour and animal feed.", images: ["/images/crop-maize.jpg"] },
    { farmerName: "Peter Kipchoge", cropName: "Coffee", quantity: 150, location: "Nyeri", expectedPrice: 450, description: "SL28 Arabica parchment coffee, sun-dried. AA grade for export and specialty roasters.", images: ["/images/crop-coffee.jpg"] },
    { farmerName: "Mary Wafula", cropName: "Potato", quantity: 300, location: "Nakuru", expectedPrice: 70, description: "Shangi potatoes, clean and well-graded. Ideal for chips, crisps, and household cooking.", images: ["/images/crop-potato.jpg"] },
    { farmerName: "David Ochieng", cropName: "Sukuma Wiki", quantity: 400, location: "Kisumu", expectedPrice: 35, description: "Fresh sukuma wiki (kale), pesticide-free. Harvested this morning from Ahero irrigation scheme.", images: ["/images/crop-cabbage.jpg"] },
    { farmerName: "Wanjiku Kamau", cropName: "Avocado", quantity: 250, location: "Murang'a", expectedPrice: 60, description: "Hass avocados, export quality. Picked at optimal ripeness for long shelf life.", images: ["/images/crop-avocado.jpg"] },
    { farmerName: "James Otieno", cropName: "French Beans", quantity: 180, location: "Naivasha", expectedPrice: 95, description: "Export-grade fine beans, sorted and packed. Ideal for EU market buyers.", images: ["/images/crop-tomato.jpg"] },
  ];

  // Create sample users first
  const sampleUsers = [
    { unionId: "farmer_001", name: "Wanjiku Kamau", email: "wanjiku@seedpro.ke", userType: "farmer" as const, phone: "+254712345678", location: "Kiambu", bio: "Tomato and avocado farmer with 8 years experience in Limuru", verified: true, rating: "4.5", reviewCount: 23 },
    { unionId: "farmer_002", name: "James Otieno", email: "james@seedpro.ke", userType: "farmer" as const, phone: "+254723456789", location: "Nakuru", bio: "Onion and French beans specialist, export-focused farming", verified: true, rating: "4.2", reviewCount: 15 },
    { unionId: "farmer_003", name: "Faith Muthoni", email: "faith@seedpro.ke", userType: "farmer" as const, phone: "+254734567890", location: "Eldoret", bio: "Maize and grains farmer in Uasin Gishu county", verified: true, rating: "4.8", reviewCount: 31 },
    { unionId: "farmer_004", name: "Peter Kipchoge", email: "peter@seedpro.ke", userType: "farmer" as const, phone: "+254745678901", location: "Nyeri", bio: "Coffee farmer, member of Nyeri Farmers Cooperative", verified: true, rating: "4.0", reviewCount: 12 },
    { unionId: "buyer_001", name: "Jane Wanjiru", email: "jane@naivas.co.ke", userType: "buyer" as const, phone: "+254756789012", location: "Nairobi", bio: "Naivas Supermarket fresh produce procurement", verified: true, rating: "4.6", reviewCount: 18 },
    { unionId: "agg_001", name: "Robert Mwangi", email: "robert@agrihub.ke", userType: "aggregator" as const, phone: "+254767890123", location: "Nairobi", bio: "Aggregating produce from 80+ farmers across central Kenya", verified: true, rating: "4.3", reviewCount: 27 },
  ];

  const userIds: number[] = [];
  for (const u of sampleUsers) {
    const result = await db.insert(users).values(u);
    userIds.push(Number(result[0].insertId));
  }

  // Create listings with farmer IDs
  for (let i = 0; i < listingData.length; i++) {
    const listing = listingData[i];
    const crop = cropData.find((c) => c.name === listing.cropName);
    await db.insert(listings).values({
      farmerId: userIds[i % 4],
      cropId: crop ? cropData.indexOf(crop) + 1 : 1,
      cropName: listing.cropName,
      quantity: listing.quantity,
      location: listing.location,
      harvestDate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      expectedPrice: listing.expectedPrice.toString(),
      description: listing.description,
      images: listing.images,
      status: "active",
    });
  }

  // ─── Seed Sample Ratings ───
  console.log("Seeding sample ratings...");
  const ratingData = [
    { revieweeIndex: 0, rating: 5, review: "Excellent quality tomatoes! Very fresh and well-packed. Sarah is reliable and delivers on time.", tags: ["Quality produce", "Reliable", "On time"] },
    { revieweeIndex: 0, rating: 4, review: "Good tomatoes, consistent quality. Will order again.", tags: ["Quality produce"] },
    { revieweeIndex: 1, rating: 5, review: "Best onions in Nakuru region. Firm bulbs, no rot. Highly recommended!", tags: ["Quality produce", "Reliable"] },
    { revieweeIndex: 2, rating: 4, review: "Clean maize, well dried. Good communication throughout.", tags: ["Good Communication", "Quality produce"] },
    { revieweeIndex: 4, rating: 5, review: "Jane pays promptly and is professional to work with. Fair prices.", tags: ["Fast Payment", "Professional"] },
  ];

  for (const r of ratingData) {
    await db.insert(ratings).values({
      reviewerId: userIds[4],
      revieweeId: userIds[r.revieweeIndex],
      rating: r.rating,
      review: r.review,
      tags: r.tags,
    });
  }

  console.log("Seeding complete!");
}

seed().catch(console.error);
