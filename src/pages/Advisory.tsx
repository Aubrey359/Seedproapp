import { useState, useRef, useEffect } from "react";
import { trpc } from "@/providers/trpc";
import { AppLayout } from "@/components/AppLayout";
import {
  FiSend, FiCamera, FiChevronRight, FiBookOpen,
  FiCalendar, FiDroplet, FiSun, FiCloudRain
} from "react-icons/fi";

interface Message {
  id: number;
  direction: "incoming" | "outgoing";
  content: string;
  messageType: string;
  metadata?: Record<string, any> | null;
  createdAt: Date;
}

const initialMessages: Message[] = [
  {
    id: 1,
    direction: "incoming",
    content: "Welcome to SeedPro Advisory! 🌱 I'm your farming assistant. What crop are you growing?",
    messageType: "quick_reply",
    metadata: {
      quickReplies: ["Tomato", "Onion", "Maize", "Potato", "Coffee", "Other"],
    },
    createdAt: new Date(Date.now() - 60000),
  },
];

const stageEmojis: Record<string, string> = {
  Tomato: "🍅",
  Onion: "🧅",
  Maize: "🌽",
  Potato: "🥔",
  Coffee: "☕",
};

export default function Advisory() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputText, setInputText] = useState("");
  const [selectedCrop, setSelectedCrop] = useState<string | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showGuides, setShowGuides] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: cropList } = trpc.advisory.listCrops.useQuery();
  const { data: apiGuides } = trpc.advisory.getGuides.useQuery(
    { cropId: cropList?.find((c) => c.name === selectedCrop)?.id ?? 0 },
    { enabled: !!selectedCrop && !!cropList }
  );
  const { data: apiSchedule } = trpc.advisory.getSchedule.useQuery(
    { cropId: cropList?.find((c) => c.name === selectedCrop)?.id ?? 0 },
    { enabled: !!selectedCrop && !!cropList }
  );

  // Static fallback guides used when backend is unavailable
  const MOCK_GUIDES = [
    {
      stage: "Seedling",
      title: "Nursery & Seedbed Preparation",
      description: "Prepare a healthy seedbed to maximise germination and early growth.",
      tasks: ["Mix topsoil and compost at 3:1 ratio", "Sow seeds 1 cm deep, 2 cm apart", "Water lightly twice daily with a fine spray", "Apply 50% shade net for first 2 weeks"],
      tips: ["Use certified seeds for best germination rates — ask your agro-dealer for verified stock."],
    },
    {
      stage: "Vegetative",
      title: "Transplanting & Early Growth",
      description: "Transplant seedlings at 3–4 weeks and establish strong root systems.",
      tasks: ["Transplant in the evening or on cloudy days to reduce stress", "Water immediately after transplanting", "Apply DAP fertiliser at 2 g per hole", "Mulch to retain moisture and suppress weeds"],
      tips: ["Harden seedlings 3 days before transplanting by reducing shade gradually."],
    },
    {
      stage: "Flowering",
      title: "Flower Development & Pollination",
      description: "Support pollination and prevent blossom drop for a full harvest.",
      tasks: ["Apply CAN fertiliser at 5 g per plant", "Maintain consistent soil moisture — irregular watering causes drop", "Scout for whiteflies and thrips daily", "Stake plants to prevent lodging"],
      tips: ["Spray calcium nitrate at flowering to prevent blossom-end rot on tomatoes."],
    },
    {
      stage: "Harvest",
      title: "Harvesting & Post-Harvest",
      description: "Harvest at peak maturity to maximise shelf life and market value.",
      tasks: ["Harvest early morning for best freshness", "Use clean, sharp cutting tools", "Grade by size and quality before packing", "Store in a cool, shaded and ventilated area"],
      tips: ["Post your harvest on SeedPro Marketplace to reach buyers across Kenya before prices drop."],
    },
  ];

  const MOCK_SCHEDULE = [
    { stage:"Seedling",   activityType:"irrigation",  dayFrom:1,  dayTo:14,  productName:"Water",           dosage:"2 L/m²",      instructions:"Mist lightly twice daily to keep seedbed moist without waterlogging." },
    { stage:"Seedling",   activityType:"fertilizer",  dayFrom:7,  dayTo:10,  productName:"DAP",             dosage:"2 g/hole",    instructions:"Apply DAP at transplanting hole to boost root development." },
    { stage:"Vegetative", activityType:"fertilizer",  dayFrom:21, dayTo:28,  productName:"CAN",             dosage:"5 g/plant",   instructions:"Top-dress with CAN to support leafy growth. Water in after application." },
    { stage:"Vegetative", activityType:"pesticide",   dayFrom:25, dayTo:30,  productName:"Neem Extract",    dosage:"5 ml/L",      instructions:"Spray neem on leaf undersides to control aphids and whiteflies." },
    { stage:"Flowering",  activityType:"fertilizer",  dayFrom:40, dayTo:45,  productName:"NPK 17:17:17",    dosage:"10 g/plant",  instructions:"Apply balanced NPK at base of plant then water. Avoid contact with leaves." },
    { stage:"Flowering",  activityType:"fungicide",   dayFrom:42, dayTo:50,  productName:"Dithane M-45",    dosage:"2 g/L",       instructions:"Spray every 7 days to prevent early and late blight. Rotate fungicides." },
    { stage:"Fruiting",   activityType:"irrigation",  dayFrom:50, dayTo:70,  productName:"Drip Irrigation", dosage:"4 L/plant/day",instructions:"Maintain consistent moisture. Irregular watering causes fruit cracking." },
    { stage:"Fruiting",   activityType:"fertilizer",  dayFrom:55, dayTo:60,  productName:"Calcium Nitrate", dosage:"3 g/L spray", instructions:"Foliar spray to prevent blossom-end rot and strengthen cell walls." },
    { stage:"Harvest",    activityType:"other",       dayFrom:70, dayTo:90,  productName:"Harvesting",      dosage:undefined,     instructions:"Harvest at colour break. Use clean knives. Pack in ventilated crates." },
  ];

  const guides   = (apiGuides   && apiGuides.length   > 0) ? apiGuides   : (selectedCrop ? MOCK_GUIDES   : undefined);
  const schedule = (apiSchedule && apiSchedule.length > 0) ? apiSchedule : (selectedCrop ? MOCK_SCHEDULE : undefined);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMessage = (msg: Omit<Message, "id" | "createdAt">) => {
    const newMsg: Message = {
      ...msg,
      id: Date.now(),
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, newMsg]);
  };

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    // Add outgoing message
    addMessage({
      direction: "outgoing",
      content: text,
      messageType: "text",
    });
    setInputText("");

    // If it's a crop selection
    if (["Tomato", "Onion", "Maize", "Potato", "Coffee"].includes(text)) {
      setSelectedCrop(text);
    }

    // Simulate bot response
    setTimeout(() => {
      const response = generateResponse(text, selectedCrop);
      addMessage({
        direction: "incoming",
        content: response.content,
        messageType: response.messageType,
        metadata: response.metadata,
      });
    }, 600);
  };

  const handleQuickReply = (reply: string) => {
    handleSend(reply);
  };

  const lastIncomingMsg = [...messages].reverse().find((m) => m.direction === "incoming");
  const quickReplies = lastIncomingMsg?.metadata?.quickReplies as string[] | undefined;
  const actions = lastIncomingMsg?.metadata?.actions as string[] | undefined;

  return (
    <AppLayout>
      {/* Chat Interface */}
      <div className="flex flex-col h-[calc(100vh-56px-64px)]">
        {/* Crop Selector Header */}
        {selectedCrop && (
          <div className="bg-white border-b border-light px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">{stageEmojis[selectedCrop] || "🌱"}</span>
              <span className="text-sm font-semibold text-seed-brown">{selectedCrop} Advisory</span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => { setShowGuides(true); setShowSchedule(false); }}
                className="px-2 py-1 text-[10px] bg-seed-green/10 text-seed-green rounded-full font-medium"
              >
                Guides
              </button>
              <button
                onClick={() => { setShowSchedule(true); setShowGuides(false); }}
                className="px-2 py-1 text-[10px] bg-seed-gold/10 text-seed-gold rounded-full font-medium"
              >
                Calendar
              </button>
            </div>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 chat-bg">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.direction === "outgoing" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] px-4 py-3 ${
                  msg.direction === "outgoing"
                    ? "bg-seed-green text-white rounded-2xl rounded-tr-sm"
                    : "bg-white text-text-primary rounded-2xl rounded-tl-sm border-l-[3px] border-l-seed-green shadow-sm"
                }`}
              >
                <div
                  className={`text-sm whitespace-pre-line leading-relaxed ${
                    msg.direction === "outgoing" ? "text-white" : "text-text-primary"
                  }`}
                  dangerouslySetInnerHTML={{
                    __html: msg.content
                      .replace(/\*\*(.*?)\*/g, msg.direction === "outgoing" ? '<strong>$1</strong>' : '<strong class="text-seed-brown">$1</strong>')
                      .replace(/\n/g, "<br/>"),
                  }}
                />
                <p
                  className={`text-[10px] mt-1 ${
                    msg.direction === "outgoing" ? "text-white/60" : "text-text-secondary"
                  }`}
                >
                  {msg.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}

          {/* Action Buttons */}
          {actions && actions.length > 0 && (
            <div className="flex flex-wrap gap-2 pl-2">
              {actions.map((action) => (
                <button
                  key={action}
                  onClick={() => handleQuickReply(action)}
                  className="px-3 py-1.5 bg-seed-gold/10 text-seed-gold text-xs rounded-full font-medium border border-seed-gold/20"
                >
                  {action}
                </button>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Replies */}
        {quickReplies && quickReplies.length > 0 && (
          <div className="px-4 py-2 bg-white border-t border-light">
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
              {quickReplies.map((reply) => (
                <button
                  key={reply}
                  onClick={() => handleQuickReply(reply)}
                  className="px-4 py-2 bg-seed-green/10 text-seed-green text-xs rounded-full font-medium whitespace-nowrap hover:bg-seed-green/20 transition-colors"
                >
                  {reply}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="px-4 py-3 bg-white border-t border-light">
          <div className="flex items-center gap-2">
            <button className="w-10 h-10 rounded-full bg-seed-cream flex items-center justify-center flex-shrink-0">
              <FiCamera className="w-5 h-5 text-seed-green" />
            </button>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend(inputText)}
              placeholder="Type your message..."
              className="flex-1 h-10 px-4 rounded-full bg-seed-cream text-sm border-0 outline-none focus:ring-2 focus:ring-seed-green/30"
            />
            <button
              onClick={() => handleSend(inputText)}
              disabled={!inputText.trim()}
              className="w-10 h-10 rounded-full bg-seed-green flex items-center justify-center flex-shrink-0 disabled:opacity-40"
            >
              <FiSend className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Schedule/Calendar Overlay */}
      {showSchedule && schedule && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
          <div className="w-full bg-white rounded-t-3xl max-h-[70vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-4 py-3 border-b border-light flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-seed-brown">
                {selectedCrop} Spray Calendar
              </h3>
              <button onClick={() => setShowSchedule(false)} className="p-1">
                <span className="text-2xl leading-none text-text-secondary">&times;</span>
              </button>
            </div>
            <div className="p-4 space-y-3">
              {schedule.map((item, i) => (
                <div key={i} className="flex gap-3 p-3 bg-seed-cream rounded-xl">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    item.activityType === "fertilizer" ? "bg-seed-green/10 text-seed-green" :
                    item.activityType === "pesticide" ? "bg-seed-error/10 text-seed-error" :
                    item.activityType === "fungicide" ? "bg-seed-info/10 text-seed-info" :
                    "bg-seed-gold/10 text-seed-gold"
                  }`}>
                    {item.activityType === "fertilizer" ? <FiSun className="w-5 h-5" /> :
                     item.activityType === "pesticide" ? <FiDroplet className="w-5 h-5" /> :
                     item.activityType === "irrigation" ? <FiCloudRain className="w-5 h-5" /> :
                     <FiCalendar className="w-5 h-5" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-text-secondary uppercase">{item.stage}</span>
                      <span className="text-[10px] text-text-secondary">Day {item.dayFrom}{item.dayTo ? `-${item.dayTo}` : ""}</span>
                    </div>
                    <p className="text-sm font-semibold text-text-primary mt-0.5">
                      {item.productName || item.activityType}
                    </p>
                    {item.dosage && (
                      <p className="text-xs text-seed-green font-medium">{item.dosage}</p>
                    )}
                    <p className="text-xs text-text-secondary mt-1">{item.instructions}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Guides Overlay */}
      {showGuides && guides && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
          <div className="w-full bg-white rounded-t-3xl max-h-[70vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-4 py-3 border-b border-light flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-seed-brown">
                {selectedCrop} Growing Guide
              </h3>
              <button onClick={() => setShowGuides(false)} className="p-1">
                <span className="text-2xl leading-none text-text-secondary">&times;</span>
              </button>
            </div>
            <div className="p-4 space-y-4">
              {guides.map((guide, i) => (
                <div key={i} className="border border-light rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-seed-green/10 flex items-center justify-center">
                      <FiBookOpen className="w-4 h-4 text-seed-green" />
                    </div>
                    <div>
                      <span className="text-[10px] text-seed-green font-medium uppercase">{guide.stage}</span>
                      <h4 className="text-sm font-semibold text-text-primary">{guide.title}</h4>
                    </div>
                  </div>
                  <p className="text-xs text-text-secondary mb-2">{guide.description}</p>
                  {guide.tasks && (
                    <ul className="space-y-1">
                      {guide.tasks.map((task, j) => (
                        <li key={j} className="flex items-start gap-1.5 text-xs text-text-primary">
                          <FiChevronRight className="w-3 h-3 text-seed-green flex-shrink-0 mt-0.5" />
                          {task}
                        </li>
                      ))}
                    </ul>
                  )}
                  {guide.tips && guide.tips.length > 0 && (
                    <div className="mt-2 p-2 bg-seed-green/5 rounded-lg">
                      <p className="text-[10px] text-seed-green font-medium">💡 Tip</p>
                      <p className="text-xs text-text-secondary">{guide.tips[0]}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function generateResponse(text: string, currentCrop: string | null): {
  content: string;
  messageType: string;
  metadata?: Record<string, any>;
} {
  const lower = text.toLowerCase();

  if (["Tomato", "Onion", "Maize", "Potato", "Coffee"].includes(text)) {
    return {
      content: `Great choice! ${text} ${text === "Coffee" ? "is" : "is a high-value crop"}. What stage are your ${text.toLowerCase()} plants at?`,
      messageType: "quick_reply",
      metadata: {
        quickReplies: text === "Coffee"
          ? ["Pruning", "Flowering", "Berry Development", "Harvest", "Processing"]
          : ["Nursery/Seedling", "Vegetative", "Flowering", "Fruiting", "Harvest"],
      },
    };
  }

  if (lower.includes("nursery") || lower.includes("seedling")) {
    return {
      content: `**Nursery/Seedling Stage Guide** 🌱\n\n1. **Seed Selection**: Use certified seeds for best germination\n2. **Seedbed Prep**: Mix soil with compost (3:1 ratio)\n3. **Sowing**: Plant seeds 1cm deep, 2cm apart\n4. **Watering**: Light misting twice daily\n5. **Protection**: Use shade net (50%) for first 2 weeks\n\nGermination typically takes 5-10 days.`,
      messageType: "text",
      metadata: { actions: ["View Full Calendar"] },
    };
  }

  if (lower.includes("flowering")) {
    return {
      content: `**Flowering Stage Guide** 🌸\n\n1. **Watering**: Keep soil moist, not waterlogged. 2-3 times/week.\n2. **Fertilizer**: Apply NPK 17:17:17 at 50g per plant\n3. **Pest Watch**: Check for whiteflies and aphids daily\n4. **Support**: Stake plants to prevent lodging\n\n**Key tip**: Calcium application prevents blossom end rot!`,
      messageType: "text",
      metadata: { actions: ["View Full Calendar", "Product Recommendations"] },
    };
  }

  if (lower.includes("harvest")) {
    return {
      content: `**Harvest Stage Guide** 🌾\n\n1. **Timing**: Harvest early morning for best shelf life\n2. **Tools**: Use clean sharp knives/cutters\n3. **Handling**: Avoid bruising - handle with care\n4. **Sorting**: Grade by size and quality\n5. **Storage**: Keep in shaded, ventilated area\n\nPost your harvest on the marketplace to connect with buyers!`,
      messageType: "text",
      metadata: { actions: ["Post to Marketplace"] },
    };
  }

  if (lower.includes("pest") || lower.includes("disease")) {
    return {
      content: `I'm here to help with crop problems! 🔍\n\nPlease **upload a photo** of the affected plant, and I'll help diagnose it. You can also describe the symptoms:\n- Yellowing leaves?\n- Brown spots?\n- Wilting?\n- Holes in leaves?`,
      messageType: "text",
      metadata: { actions: ["Upload Photo", "Describe Symptoms"] },
    };
  }

  if (lower.includes("product") || lower.includes("fertilizer")) {
    return {
      content: `Based on your crop stage, here are SeedPro recommendations:\n\n**🌱 SeedPro NPK Fertilizer**\nBalanced 17:17:17 formula\nPrice: KSh 1,500/kg\n\n**🛡️ SeedPro Organic Pest Spray**\nNeem-based, safe for food crops\nPrice: KSh 850/liter\n\nWould you like to order any of these?`,
      messageType: "text",
      metadata: { actions: ["Order Now", "View All Products"] },
    };
  }

  if (lower.includes("photo")) {
    return {
      content: `Please upload a clear photo of the affected crop. For best results:\n\n1. Take photo in good daylight\n2. Include both healthy and affected areas\n3. Focus on the specific problem area\n4. Include a leaf/stem close-up\n\nI'll analyze it and provide diagnosis and treatment recommendations!`,
      messageType: "text",
    };
  }

  // Default
  return {
    content: `How can I help you today?\n\nI can assist with:\n• Crop stage-by-stage guidance\n• Pest and disease diagnosis\n• Spray and fertilizer schedules\n• Product recommendations\n• Market price information\n\nWhat would you like to know?`,
    messageType: "quick_reply",
    metadata: {
      quickReplies: currentCrop
        ? ["Nursery Guide", "Flowering Care", "Pest Control", "Harvest Tips", "Products"]
        : ["Tomato", "Onion", "Maize", "Potato", "Coffee"],
    },
  };
}
