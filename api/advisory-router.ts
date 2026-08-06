import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { crops, cropGuides, spraySchedules, diagnoses, advisoryMessages, nextSeq, omitMongo } from "@db/schema";
import { generateAiResponse, type ChatTurn } from "./lib/claude";
import { checkRateLimit } from "./lib/rate-limit";

// Public guest chat has no sign-in to deter abuse, and every message here can
// now trigger a real, billed Claude API call — cap it so a script can't quietly
// run up the bill. Signed-in farmers (sendMessage) are already gated by phone
// verification, so they aren't rate-limited here.
const GUEST_MAX_MESSAGES_PER_HOUR = 20;
const GUEST_RATE_WINDOW_MS = 60 * 60 * 1000;

// Same reasoning as the guest chat limit above, but tracked separately since
// it's a different action — a photo+vision call, on the Scan Plant page.
const SCAN_MAX_PER_HOUR = 15;
const SCAN_RATE_WINDOW_MS = 60 * 60 * 1000;

// How many prior turns to give Claude as context — enough for a coherent
// conversation without letting cost/latency grow unbounded on a long history.
const AI_HISTORY_TURNS = 12;

function toTurn(m: { direction: string; content: string; messageType: string }): ChatTurn {
  return {
    role: m.direction === "outgoing" ? "user" : "assistant",
    content: m.messageType === "image" ? { photoDataUrl: m.content } : m.content,
  };
}

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

  // Powers the "Check Your Plant's Health" (Scan Plant) camera flow — a real
  // Claude vision call on the captured photo, instead of the fake progress
  // bar it used to show before just filing the photo away for a listing.
  // Public (no sign-in needed to scan, matching how that page always
  // worked), so it's rate-limited by IP the same way guest chat is.
  // Signed-in farmers additionally get the result saved to their diagnosis
  // history via the existing `diagnoses` collection above.
  //
  // cropName is optional — a farmer who already knows what they're growing
  // gets a targeted health check; one who doesn't gets Claude to identify
  // the plant first (like a plant-ID app), then check its health too.
  scanPlant: publicQuery
    .input(z.object({
      cropName: z.string().optional(),
      photoDataUrl: z.string().min(1).max(500_000),
      lang: z.enum(["en", "sw"]).default("en"),
    }))
    .mutation(async ({ ctx, input }) => {
      const ip = ctx.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      if (!checkRateLimit(`scan-plant:${ip}`, SCAN_MAX_PER_HOUR, SCAN_RATE_WINDOW_MS)) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many scans — please try again in a bit." });
      }

      // This is a one-shot result screen, not the chat — there's no reply
      // box, so a response that ends in a question to the farmer is a dead
      // end. Told explicitly, since the model doesn't otherwise know that.
      const noReplyNote = t(
        input.lang,
        ` This is a one-time photo check, not a chat — I won't be able to reply to any follow-up questions you ask, so please give your complete best assessment now rather than asking me anything. If it'd genuinely help to discuss further, say so and suggest I use the separate "Uliza Zao" chat for that — but don't end with an open question expecting an answer.`,
        ` Huu ni ukaguzi wa picha wa mara moja, si mazungumzo — sitaweza kujibu maswali yoyote ya ufuatiliaji, hivyo tafadhali toa tathmini yako kamili zaidi sasa badala ya kuniuliza chochote. Ikiwa itasaidia kweli kuzungumza zaidi, sema hivyo na pendekeza nitumie mazungumzo tofauti ya "Uliza Zao" kwa hilo — lakini usimalize kwa swali wazi linalotarajia jibu.`,
      );
      const caption = (input.cropName
        ? t(
            input.lang,
            `This is a photo of my ${input.cropName} plant. Please check it closely for any visible pest damage, disease symptoms, nutrient deficiency signs, or other health issues, and tell me what you see and what I should do about it.`,
            `Hii ni picha ya mmea wangu wa ${input.cropName}. Tafadhali angalia kwa makini kama kuna dalili za wadudu, ugonjwa, upungufu wa virutubisho, au tatizo lingine la afya, kisha niambie unachokiona na nifanye nini.`,
          )
        : t(
            input.lang,
            `I don't know what this plant is — please identify it first (the crop/species, and the variety too if you can tell), then check it closely for any visible pest damage, disease symptoms, nutrient deficiency signs, or other health issues, and tell me what you see and what I should do about it.`,
            `Sijui mmea huu ni upi — tafadhali kwanza unitambulishe (zao/aina, na aina mahususi kama unaweza kujua), kisha uangalie kwa makini kama kuna dalili za wadudu, ugonjwa, upungufu wa virutubisho, au tatizo lingine la afya, kisha niambie unachokiona na nifanye nini.`,
          )) + noReplyNote;
      const turn: ChatTurn = { role: "user", content: { photoDataUrl: input.photoDataUrl, caption } };
      const aiText = await generateAiResponse([turn], input.lang);

      const result = aiText ?? t(
        input.lang,
        "I couldn't complete an automatic check just now, but your photo has been saved — feel free to ask me about any specific symptoms you're seeing in the chat.",
        "Sikuweza kukamilisha ukaguzi wa kiotomatiki kwa sasa, lakini picha yako imehifadhiwa — jisikie huru kuniuliza kuhusu dalili zozote unazoona kwenye mazungumzo.",
      );

      if (ctx.user) {
        await diagnoses.create({
          id: await nextSeq("diagnoses"),
          farmerId: ctx.user.id,
          cropName: input.cropName || undefined,
          photoUrl: input.photoDataUrl,
          diagnosis: result,
          status: aiText ? "diagnosed" : "pending",
        });
      }

      return { result, analyzed: !!aiText };
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
        content: z.string().min(1).max(500_000), // generous — a compressed photo data URL is much longer than any real text message
        cropId: z.number().optional(),
        messageType: z.enum(["text", "image", "quick_reply", "product_card", "guide"]).default("text"),
        metadata: z.record(z.string(), z.any()).optional(),
        // Which language to reply in — defaults to English so older clients
        // that don't send this yet keep working unchanged.
        lang: z.enum(["en", "sw"]).default("en"),
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

      // Try the real AI first, with recent history for context; fall back to
      // the local rule-based responses if no API key is configured or the
      // call fails for any reason (network, rate limit, etc.) — a farmer
      // should never be left with a blank reply because of that.
      const history = await advisoryMessages
        .find({ userId: ctx.user.id })
        .sort({ createdAt: -1 })
        .limit(AI_HISTORY_TURNS)
        .lean();
      const turns = history.reverse().map(toTurn);
      const aiText = await generateAiResponse(turns, input.lang);

      const response = aiText
        ? { content: aiText, messageType: "text" as const, metadata: undefined as Record<string, any> | undefined }
        : input.messageType === "image"
          ? photoAcknowledgmentResponse(input.lang)
          : generateAdvisoryResponse(input.content, input.lang, input.cropId);

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

  // Public, ephemeral version of sendMessage — lets anyone chat with the
  // Farm Assistant without signing in first (e.g. for a live demo where
  // receiving an OTP isn't practical). Nothing is persisted: there's no
  // farmer account to attribute a guest message to. Now that a real Claude
  // call can happen here, it's rate-limited by IP — this used to be a pure,
  // free local function with no abuse surface, but a public endpoint that
  // can trigger a billed API call needs a cap. Signed-in farmers keep using
  // sendMessage/getMessages above, which still saves their history.
  sendGuestMessage: publicQuery
    .input(z.object({
      content: z.string().min(1).max(500_000),
      messageType: z.enum(["text", "image"]).default("text"),
      lang: z.enum(["en", "sw"]).default("en"),
    }))
    .mutation(async ({ ctx, input }) => {
      const ip = ctx.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      if (!checkRateLimit(`guest-chat:${ip}`, GUEST_MAX_MESSAGES_PER_HOUR, GUEST_RATE_WINDOW_MS)) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many messages — please try again in a bit." });
      }

      const turn: ChatTurn = { role: "user", content: input.messageType === "image" ? { photoDataUrl: input.content } : input.content };
      const aiText = await generateAiResponse([turn], input.lang);
      if (aiText) return { content: aiText, messageType: "text" as const };

      return input.messageType === "image"
        ? photoAcknowledgmentResponse(input.lang)
        : generateAdvisoryResponse(input.content, input.lang);
    }),
});

type Lang = "en" | "sw";

// The one place every bilingual response funnels through, so a stray branch
// can't accidentally skip translation.
function t(lang: Lang, en: string, sw: string): string {
  return lang === "sw" ? sw : en;
}

// True if any of the given (already-lowercased) keywords appear in text.
// Bilingual by design: a farmer might type — or tap a quick-reply chip — in
// English or Kiswahili regardless of which language the UI currently shows,
// so both are always checked here; only the RESPONSE text/labels below
// follow the selected `lang`.
function hasAny(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

// A farmer can now actually attach a photo in chat (previously the disease
// response told them to "upload a photo" with no way to do it). There's no
// real vision model behind this though — running keyword matching against a
// base64 data URL would be meaningless, and fabricating a diagnosis from an
// image never analyzed would be actively misleading. Acknowledge honestly
// and redirect to the description-based path, which does work.
function photoAcknowledgmentResponse(lang: Lang): { content: string; messageType: string; metadata?: Record<string, any> } {
  return {
    content: t(
      lang,
      `📸 Thanks for the photo! I can't fully analyze images yet, but I'm good with descriptions — tell me what you're seeing (spots, yellowing, wilting, holes, powdery coating) and I'll help from there.`,
      `📸 Asante kwa picha! Bado sijaweza kuchambua picha kikamilifu, lakini ninaweza kusaidia kwa maelezo — niambie unachokiona (madoa, njano, kunyauka, mashimo, ganda jeupe) nami nitakusaidia kutoka hapo.`,
    ),
    messageType: "text",
  };
}

// Advisory response generator
export function generateAdvisoryResponse(content: string, lang: Lang = "en", _cropId?: number): {
  content: string;
  messageType: string;
  metadata?: Record<string, any>;
} {
  const lower = content.toLowerCase();

  // Pest/disease/symptom responses — checked before crop-name matching so a
  // message like "my tomato has brown spots" gets the actual symptom
  // response instead of always falling into the generic crop intro below.
  // Keywords match what this response itself lists as example symptoms.
  if (
    hasAny(lower, [
      "pest", "disease", "problem", "spot", "yellow", "wilt", "hole", "powder", "mold", "rot", "bug", "insect",
      "wadudu", "ugonjwa", "tatizo", "shida", "doa", "madoa", "njano", "manjano", "nyauka", "shimo", "mashimo", "ukungu", "oza", "mdudu",
    ])
  ) {
    return {
      content: t(
        lang,
        `I'm here to help with crop problems! 🔍\n\nPlease **upload a photo** of the affected plant, and I'll help diagnose the issue. You can also describe the symptoms:\n- Yellowing leaves?\n- Brown spots?\n- Wilting?\n- Holes in leaves?\n- White powdery coating?`,
        `Niko hapa kukusaidia na matatizo ya mazao! 🔍\n\nTafadhali **pakia picha** ya mmea ulioathirika, nami nitakusaidia kubaini tatizo. Unaweza pia kueleza dalili:\n- Majani kugeuka manjano?\n- Madoa ya kahawia?\n- Kunyauka?\n- Mashimo kwenye majani?\n- Ganda jeupe kama unga?`,
      ),
      messageType: "text",
      metadata: {
        actions: t(lang, "Upload Photo,Describe Symptoms", "Pakia Picha,Eleza Dalili").split(","),
      },
    };
  }

  // Crop selection responses
  if (hasAny(lower, ["tomato", "nyanya"])) {
    return {
      content: t(lang, `Great choice! Tomatoes are high-value crops. What stage are your tomatoes at?`, `Chaguo zuri! Nyanya ni zao lenye thamani kubwa. Nyanya zako ziko katika hatua gani?`),
      messageType: "quick_reply",
      metadata: {
        quickReplies: t(
          lang,
          "Nursery/Seedling,Vegetative,Flowering,Fruiting,Harvest",
          "Kitalu/Miche,Ukuaji wa Majani,Kuchanua Maua,Kuzaa Matunda,Mavuno",
        ).split(","),
      },
    };
  }

  if (hasAny(lower, ["onion", "kitunguu", "vitunguu"])) {
    return {
      content: t(lang, `Excellent! Onions store well and have steady demand. What stage are your onions at?`, `Vizuri sana! Vitunguu huhifadhika vizuri na vina soko la uhakika. Vitunguu vyako viko katika hatua gani?`),
      messageType: "quick_reply",
      metadata: {
        quickReplies: t(
          lang,
          "Nursery/Seedling,Vegetative,Bulbing,Maturing,Harvest",
          "Kitalu/Miche,Ukuaji wa Majani,Kutengeneza Vitunguu,Kukomaa,Mavuno",
        ).split(","),
      },
    };
  }

  if (hasAny(lower, ["maize", "corn", "mahindi"])) {
    return {
      content: t(lang, `Maize is a staple crop with great market potential! What stage are your maize plants at?`, `Mahindi ni zao kuu lenye soko zuri! Mahindi yako yako katika hatua gani?`),
      messageType: "quick_reply",
      metadata: {
        quickReplies: t(
          lang,
          "Germination,Vegetative,Tasseling,Grain Filling,Harvest",
          "Kuota,Ukuaji wa Majani,Kutoa Singa,Kujaza Nafaka,Mavuno",
        ).split(","),
      },
    };
  }

  if (hasAny(lower, ["coffee", "kahawa"])) {
    return {
      content: t(lang, `Coffee farming is rewarding! What stage are your coffee trees at?`, `Kilimo cha kahawa kina faida nzuri! Mikahawa yako iko katika hatua gani?`),
      messageType: "quick_reply",
      metadata: {
        quickReplies: t(
          lang,
          "Pruning,Flowering,Berry Development,Harvest,Processing",
          "Kupogoa,Kuchanua Maua,Kukua kwa Matunda,Mavuno,Uchakataji",
        ).split(","),
      },
    };
  }

  if (hasAny(lower, ["potato", "viazi"])) {
    return {
      content: t(lang, `Potatoes are profitable root crops! What stage are your potatoes at?`, `Viazi ni zao la mizizi lenye faida! Viazi vyako viko katika hatua gani?`),
      messageType: "quick_reply",
      metadata: {
        quickReplies: t(
          lang,
          "Planting,Sprouting,Tuber Initiation,Tuber Bulking,Harvest",
          "Kupanda,Kuchipua,Kuanza kwa Mizizi,Kukua kwa Mizizi,Mavuno",
        ).split(","),
      },
    };
  }

  // Stage-specific responses
  if (hasAny(lower, ["flowering", "kuchanua", "maua"])) {
    return {
      content: t(
        lang,
        `**Flowering Stage Guide** 🍅\n\n1. **Watering**: Keep soil moist, not waterlogged. 2-3 times/week.\n2. **Fertilizer**: Apply NPK 17:17:17 at 50g per plant\n3. **Pest Watch**: Check for whiteflies and aphids daily\n4. **Support**: Stake plants to prevent lodging\n\nWould you like product recommendations for this stage?`,
        `**Mwongozo wa Hatua ya Kuchanua Maua** 🍅\n\n1. **Kumwagilia**: Weka udongo unyevu, sio kujaa maji. Mara 2-3 kwa wiki.\n2. **Mbolea**: Weka NPK 17:17:17 gramu 50 kwa mmea\n3. **Ufuatiliaji wa Wadudu**: Angalia inzi weupe na vidukari kila siku\n4. **Msaada**: Weka vigingi kuzuia mimea kulala chini\n\nUngependa mapendekezo ya bidhaa kwa hatua hii?`,
      ),
      messageType: "text",
      metadata: {
        actions: t(lang, "View Full Calendar,Set Reminder,Ask About Pests", "Ona Ratiba Kamili,Weka Ukumbusho,Uliza Kuhusu Wadudu").split(","),
      },
    };
  }

  if (hasAny(lower, ["nursery", "seedling", "kitalu", "miche"])) {
    return {
      content: t(
        lang,
        `**Nursery/Seedling Stage Guide** 🌱\n\n1. **Seed Selection**: Use certified seeds for best germination\n2. **Seedbed Prep**: Mix soil with compost (3:1 ratio)\n3. **Sowing**: Plant seeds 1cm deep, 2cm apart\n4. **Watering**: Light misting twice daily\n5. **Protection**: Use shade net (50%) for first 2 weeks\n\nGermination typically takes 5-10 days. Ready for transplant at 4-6 weeks!`,
        `**Mwongozo wa Hatua ya Kitalu/Miche** 🌱\n\n1. **Uchaguzi wa Mbegu**: Tumia mbegu bora zilizothibitishwa kwa kuota vizuri\n2. **Maandalizi ya Kitalu**: Changanya udongo na mboji (uwiano wa 3:1)\n3. **Kupanda**: Panda mbegu kina cha sentimita 1, umbali wa sentimita 2\n4. **Kumwagilia**: Nyunyizia maji kidogo mara mbili kwa siku\n5. **Kinga**: Tumia wavu wa kivuli (50%) kwa wiki 2 za kwanza\n\nKuota huchukua siku 5-10. Tayari kupandikizwa baada ya wiki 4-6!`,
      ),
      messageType: "text",
      metadata: {
        actions: t(lang, "View Full Calendar,Buy Shamba Sokoni Seeds", "Ona Ratiba Kamili,Nunua Mbegu za Shamba Sokoni").split(","),
      },
    };
  }

  if (hasAny(lower, ["harvest", "mavuno", "vuna"])) {
    return {
      content: t(
        lang,
        `**Harvest Stage Guide** 🌾\n\n1. **Timing**: Harvest early morning for best shelf life\n2. **Tools**: Use clean sharp knives/cutters\n3. **Handling**: Avoid bruising - handle with care\n4. **Sorting**: Grade by size and quality\n5. **Storage**: Keep in shaded, ventilated area\n\nPost your harvest on the marketplace to connect with buyers!`,
        `**Mwongozo wa Hatua ya Mavuno** 🌾\n\n1. **Wakati**: Vuna asubuhi na mapema ili yadumu zaidi\n2. **Vifaa**: Tumia visu/mikasi safi na yenye ncha kali\n3. **Utunzaji**: Epuka kubonyeza - shughulikia kwa uangalifu\n4. **Upangaji**: Panga kwa ukubwa na ubora\n5. **Uhifadhi**: Weka mahali penye kivuli na hewa ya kutosha\n\nWeka mavuno yako sokoni ili kuungana na wanunuzi!`,
      ),
      messageType: "text",
      metadata: {
        actions: t(lang, "Post to Marketplace,View Buyer Prices", "Weka Sokoni,Ona Bei za Wanunuzi").split(","),
      },
    };
  }

  // Product recommendations
  if (hasAny(lower, ["product", "recommend", "fertilizer", "bidhaa", "pendekezo", "mbolea"])) {
    return {
      content: t(
        lang,
        `Based on your crop stage, here are Shamba Sokoni recommendations:\n\n**Shamba Sokoni Tomato Fertilizer**\nNPK 17:17:17 balanced formula\nPrice: KSh 1,500 per kg\n\n**Shamba Sokoni Pest Control**\nOrganic neem-based spray\nPrice: KSh 850 per liter\n\nWould you like to order any of these products?`,
        `Kulingana na hatua ya zao lako, haya ni mapendekezo ya Shamba Sokoni:\n\n**Mbolea ya Nyanya ya Shamba Sokoni**\nMchanganyiko sawa wa NPK 17:17:17\nBei: KSh 1,500 kwa kilo\n\n**Dawa ya Wadudu ya Shamba Sokoni**\nDawa ya asili ya mwarobaini\nBei: KSh 850 kwa lita\n\nUngependa kuagiza bidhaa yoyote kati ya hizi?`,
      ),
      messageType: "product_card",
      metadata: {
        products: [
          { name: t(lang, "Shamba Sokoni NPK Fertilizer", "Mbolea ya Shamba Sokoni NPK"), price: 1500, unit: "kg" },
          { name: t(lang, "Shamba Sokoni Organic Pest Spray", "Dawa ya Asili ya Wadudu ya Shamba Sokoni"), price: 850, unit: "liter" },
        ],
      },
    };
  }

  // Photo/diagnosis upload
  if (hasAny(lower, ["photo", "picture", "image", "picha"])) {
    return {
      content: t(
        lang,
        `Please upload a clear photo of the affected crop. For best results:\n\n1. Take photo in good daylight\n2. Include both healthy and affected areas\n3. Focus on the specific problem area\n4. Include a leaf/stem close-up\n\nI'll analyze it and provide diagnosis and treatment recommendations!`,
        `Tafadhali pakia picha safi ya zao lililoathirika. Kwa matokeo bora:\n\n1. Piga picha wakati wa mchana wenye mwanga mzuri\n2. Jumuisha sehemu zenye afya na zilizoathirika\n3. Lenga sehemu maalum yenye tatizo\n4. Jumuisha picha ya karibu ya jani/shina\n\nNitachambua na kutoa uchunguzi na mapendekezo ya matibabu!`,
      ),
      messageType: "text",
      metadata: {
        actions: t(lang, "Take Photo,Choose from Gallery", "Piga Picha,Chagua kwenye Picha Zako").split(","),
      },
    };
  }

  // Default greeting/help response
  return {
    content: t(
      lang,
      `Welcome to Shamba Sokoni Advisory! 🌱 I'm your farming assistant.\n\nHow can I help you today?\n\n**Quick Options:**\n• Select a crop for stage-by-stage guidance\n• Diagnose crop problems (upload a photo)\n• Get spray & fertilizer schedules\n• View market prices\n• Connect with buyers\n\nWhat crop are you growing?`,
      `Karibu kwenye Ushauri wa Shamba Sokoni! 🌱 Mimi ni msaidizi wako wa kilimo.\n\nNaweza kukusaidiaje leo?\n\n**Chaguo za Haraka:**\n• Chagua zao kupata mwongozo wa hatua kwa hatua\n• Bainisha matatizo ya mazao (pakia picha)\n• Pata ratiba za dawa na mbolea\n• Ona bei za soko\n• Ungana na wanunuzi\n\nUnalima zao gani?`,
    ),
    messageType: "quick_reply",
    metadata: {
      quickReplies: t(lang, "Tomato,Onion,Maize,Potato,Coffee,Other", "Nyanya,Kitunguu,Mahindi,Viazi,Kahawa,Nyingine").split(","),
    },
  };
}
