import { z } from "zod";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { crops, cropGuides, spraySchedules, diagnoses, advisoryMessages, nextSeq, omitMongo } from "@db/schema";

export const advisoryRouter = createRouter({
  // ─── Crops ───
  listCrops: publicQuery.query(async () => {
    return omitMongo(await crops.find().sort({ name: 1 }).lean());
  }),

  getCrop: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const crop = await crops.findOne({ id: input.id }).lean();
      return crop ? omitMongo(crop) : null;
    }),

  // ─── Crop Guides ───
  getGuides: publicQuery
    .input(z.object({ cropId: z.number(), stage: z.string().optional() }))
    .query(async ({ input }) => {
      const filter: any = { cropId: input.cropId };
      if (input.stage) filter.stage = input.stage;
      return omitMongo(await cropGuides.find(filter).sort({ stageOrder: 1 }).lean());
    }),

  // ─── Spray Schedules ───
  getSchedule: publicQuery
    .input(z.object({ cropId: z.number() }))
    .query(async ({ input }) => {
      return omitMongo(await spraySchedules.find({ cropId: input.cropId }).sort({ dayFrom: 1 }).lean());
    }),

  // ─── Diagnoses ───
  createDiagnosis: authedQuery
    .input(
      z.object({
        cropName: z.string(),
        photoUrl: z.string(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = await nextSeq("diagnoses");
      await diagnoses.create({
        id,
        farmerId: ctx.user.id,
        cropName: input.cropName,
        photoUrl: input.photoUrl,
        description: input.description ?? null,
        status: "pending",
      });
      return { id };
    }),

  getMyDiagnoses: authedQuery.query(async ({ ctx }) => {
    return omitMongo(await diagnoses.find({ farmerId: ctx.user.id }).sort({ createdAt: -1 }).lean());
  }),

  // ─── Advisory Messages (WhatsApp-style chat) ───
  getMessages: authedQuery.query(async ({ ctx }) => {
    return omitMongo(
      await advisoryMessages
        .find({ userId: ctx.user.id })
        .sort({ createdAt: 1 })
        .limit(100)
        .lean(),
    );
  }),

  sendMessage: authedQuery
    .input(
      z.object({
        content: z.string().min(1),
        cropId: z.number().optional(),
        messageType: z.enum(["text", "image", "quick_reply", "product_card", "guide"]).default("text"),
        metadata: z.record(z.string(), z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Store outgoing message
      await advisoryMessages.create({
        id: await nextSeq("advisory_messages"),
        userId: ctx.user.id,
        cropId: input.cropId ?? null,
        direction: "outgoing",
        content: input.content,
        messageType: input.messageType,
        metadata: input.metadata ?? null,
      });

      // Generate advisory response based on content
      const response = generateAdvisoryResponse(input.content, input.cropId);

      // Store incoming (bot) response
      await advisoryMessages.create({
        id: await nextSeq("advisory_messages"),
        userId: ctx.user.id,
        cropId: input.cropId ?? null,
        direction: "incoming",
        content: response.content,
        messageType: response.messageType as any,
        metadata: response.metadata ?? null,
      });

      return { success: true };
    }),
});

// Advisory response generator
function generateAdvisoryResponse(content: string, _cropId?: number): {
  content: string;
  messageType: string;
  metadata?: Record<string, any>;
} {
  const lower = content.toLowerCase();

  // Crop selection responses
  if (lower.includes("tomato")) {
    return {
      content: `Great choice! Tomatoes are high-value crops. What stage are your tomatoes at?`,
      messageType: "quick_reply",
      metadata: {
        quickReplies: ["Nursery/Seedling", "Vegetative", "Flowering", "Fruiting", "Harvest"],
      },
    };
  }

  if (lower.includes("onion")) {
    return {
      content: `Excellent! Onions store well and have steady demand. What stage are your onions at?`,
      messageType: "quick_reply",
      metadata: {
        quickReplies: ["Nursery/Seedling", "Vegetative", "Bulbing", "Maturing", "Harvest"],
      },
    };
  }

  if (lower.includes("maize") || lower.includes("corn")) {
    return {
      content: `Maize is a staple crop with great market potential! What stage are your maize plants at?`,
      messageType: "quick_reply",
      metadata: {
        quickReplies: ["Germination", "Vegetative", "Tasseling", "Grain Filling", "Harvest"],
      },
    };
  }

  if (lower.includes("coffee")) {
    return {
      content: `Coffee farming is rewarding! What stage are your coffee trees at?`,
      messageType: "quick_reply",
      metadata: {
        quickReplies: ["Pruning", "Flowering", "Berry Development", "Harvest", "Processing"],
      },
    };
  }

  if (lower.includes("potato")) {
    return {
      content: `Potatoes are profitable root crops! What stage are your potatoes at?`,
      messageType: "quick_reply",
      metadata: {
        quickReplies: ["Planting", "Sprouting", "Tuber Initiation", "Tuber Bulking", "Harvest"],
      },
    };
  }

  // Stage-specific responses
  if (lower.includes("flowering")) {
    return {
      content: `**Flowering Stage Guide** 🍅\n\n1. **Watering**: Keep soil moist, not waterlogged. 2-3 times/week.\n2. **Fertilizer**: Apply NPK 17:17:17 at 50g per plant\n3. **Pest Watch**: Check for whiteflies and aphids daily\n4. **Support**: Stake plants to prevent lodging\n\nWould you like product recommendations for this stage?`,
      messageType: "text",
      metadata: {
        actions: ["View Full Calendar", "Set Reminder", "Ask About Pests"],
      },
    };
  }

  if (lower.includes("nursery") || lower.includes("seedling")) {
    return {
      content: `**Nursery/Seedling Stage Guide** 🌱\n\n1. **Seed Selection**: Use certified seeds for best germination\n2. **Seedbed Prep**: Mix soil with compost (3:1 ratio)\n3. **Sowing**: Plant seeds 1cm deep, 2cm apart\n4. **Watering**: Light misting twice daily\n5. **Protection**: Use shade net (50%) for first 2 weeks\n\nGermination typically takes 5-10 days. Ready for transplant at 4-6 weeks!`,
      messageType: "text",
      metadata: {
        actions: ["View Full Calendar", "Buy Shamba Sokoni Seeds"],
      },
    };
  }

  if (lower.includes("harvest")) {
    return {
      content: `**Harvest Stage Guide** 🌾\n\n1. **Timing**: Harvest early morning for best shelf life\n2. **Tools**: Use clean sharp knives/cutters\n3. **Handling**: Avoid bruising - handle with care\n4. **Sorting**: Grade by size and quality\n5. **Storage**: Keep in shaded, ventilated area\n\nPost your harvest on the marketplace to connect with buyers!`,
      messageType: "text",
      metadata: {
        actions: ["Post to Marketplace", "View Buyer Prices"],
      },
    };
  }

  // Pest/disease responses
  if (lower.includes("pest") || lower.includes("disease") || lower.includes("problem")) {
    return {
      content: `I'm here to help with crop problems! 🔍\n\nPlease **upload a photo** of the affected plant, and I'll help diagnose the issue. You can also describe the symptoms:\n- Yellowing leaves?\n- Brown spots?\n- Wilting?\n- Holes in leaves?\n- White powdery coating?`,
      messageType: "text",
      metadata: {
        actions: ["Upload Photo", "Describe Symptoms"],
      },
    };
  }

  // Product recommendations
  if (lower.includes("product") || lower.includes("recommend") || lower.includes("fertilizer")) {
    return {
      content: `Based on your crop stage, here are Shamba Sokoni recommendations:\n\n**Shamba Sokoni Tomato Fertilizer**\nNPK 17:17:17 balanced formula\nPrice: KSh 1,500 per kg\n\n**Shamba Sokoni Pest Control**\nOrganic neem-based spray\nPrice: KSh 850 per liter\n\nWould you like to order any of these products?`,
      messageType: "product_card",
      metadata: {
        products: [
          { name: "Shamba Sokoni NPK Fertilizer", price: 1500, unit: "kg" },
          { name: "Shamba Sokoni Organic Pest Spray", price: 850, unit: "liter" },
        ],
      },
    };
  }

  // Photo/diagnosis upload
  if (lower.includes("photo") || lower.includes("picture") || lower.includes("image")) {
    return {
      content: `Please upload a clear photo of the affected crop. For best results:\n\n1. Take photo in good daylight\n2. Include both healthy and affected areas\n3. Focus on the specific problem area\n4. Include a leaf/stem close-up\n\nI'll analyze it and provide diagnosis and treatment recommendations!`,
      messageType: "text",
      metadata: {
        actions: ["Take Photo", "Choose from Gallery"],
      },
    };
  }

  // Default greeting/help response
  return {
    content: `Welcome to Shamba Sokoni Advisory! 🌱 I'm your farming assistant.\n\nHow can I help you today?\n\n**Quick Options:**\n• Select a crop for stage-by-stage guidance\n• Diagnose crop problems (upload a photo)\n• Get spray & fertilizer schedules\n• View market prices\n• Connect with buyers\n\nWhat crop are you growing?`,
    messageType: "quick_reply",
    metadata: {
      quickReplies: ["Tomato", "Onion", "Maize", "Potato", "Coffee", "Other"],
    },
  };
}
