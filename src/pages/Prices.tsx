import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { AppLayout } from "@/components/AppLayout";
import {
  FiMapPin, FiChevronDown, FiTrendingUp, FiTrendingDown,
  FiBell, FiX
} from "react-icons/fi";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from "recharts";
import {
  KENYA_TOWNS, DEFAULT_TOWN, CROP_CATEGORY_MAP, CROP_EMOJI, formatKES,
} from "@contracts/kenya";

const categoryLabels: Record<string, string> = {
  vegetables: "VEGETABLES",
  grains: "GRAINS",
  cash_crops: "CASH CROPS",
  legumes: "LEGUMES",
  fruits: "FRUITS",
};

const mockTrendData = [
  { day: "Mon", price: 88 },
  { day: "Tue", price: 92 },
  { day: "Wed", price: 85 },
  { day: "Thu", price: 98 },
  { day: "Fri", price: 105 },
  { day: "Sat", price: 100 },
  { day: "Sun", price: 95 },
];

export default function Prices() {
  const [selectedTown, setSelectedTown] = useState(DEFAULT_TOWN);
  const [showTownPicker, setShowTownPicker] = useState(false);
  const [selectedCrop, setSelectedCrop] = useState<string | null>(null);
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [alertCrop, setAlertCrop] = useState("");
  const [alertPrice, setAlertPrice] = useState("");
  const [alertCondition, setAlertCondition] = useState<"above" | "below">("above");

  const { data: apiPrices, isLoading } = trpc.prices.getByTown.useQuery({ town: selectedTown });

  const utils = trpc.useUtils();
  const createAlert = trpc.prices.createAlert.useMutation({
    onSuccess: () => {
      utils.prices.getMyAlerts.invalidate();
      setShowAlertDialog(false);
    },
    onError: () => setShowAlertDialog(false), // graceful fallback when no backend
  });

  // Static mock prices used when backend is unavailable
  const MOCK_PRICES = [
    { id:1,  cropName:"Tomato",       wholesalePrice:95,  retailPrice:130, trend:"up"   as const, trendPercent:12 },
    { id:2,  cropName:"Maize",        wholesalePrice:42,  retailPrice:60,  trend:"down" as const, trendPercent:3  },
    { id:3,  cropName:"Potato",       wholesalePrice:58,  retailPrice:80,  trend:"up"   as const, trendPercent:5  },
    { id:4,  cropName:"Onion",        wholesalePrice:110, retailPrice:145, trend:"up"   as const, trendPercent:15 },
    { id:5,  cropName:"Cabbage",      wholesalePrice:35,  retailPrice:50,  trend:"down" as const, trendPercent:2  },
    { id:6,  cropName:"Coffee",       wholesalePrice:320, retailPrice:420, trend:"up"   as const, trendPercent:8  },
    { id:7,  cropName:"Tea",          wholesalePrice:280, retailPrice:350, trend:"up"   as const, trendPercent:4  },
    { id:8,  cropName:"Avocado",      wholesalePrice:85,  retailPrice:110, trend:"up"   as const, trendPercent:9  },
    { id:9,  cropName:"Sweet Potato", wholesalePrice:55,  retailPrice:75,  trend:"up"   as const, trendPercent:6  },
    { id:10, cropName:"Beans",        wholesalePrice:135, retailPrice:170, trend:"down" as const, trendPercent:4  },
    { id:11, cropName:"Sukuma Wiki",  wholesalePrice:30,  retailPrice:45,  trend:"up"   as const, trendPercent:3  },
    { id:12, cropName:"Banana",       wholesalePrice:48,  retailPrice:65,  trend:"up"   as const, trendPercent:7  },
    { id:13, cropName:"Mango",        wholesalePrice:65,  retailPrice:90,  trend:"down" as const, trendPercent:5  },
    { id:14, cropName:"Pineapple",    wholesalePrice:75,  retailPrice:100, trend:"up"   as const, trendPercent:2  },
  ];

  const prices = apiPrices && apiPrices.length > 0 ? apiPrices : (!isLoading ? MOCK_PRICES : undefined);

  const groupedPrices = prices?.reduce((acc, price) => {
    const cat = CROP_CATEGORY_MAP[price.cropName] || "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(price);
    return acc;
  }, {} as Record<string, typeof prices>);

  const selectedPrice = prices?.find((p) => p.cropName === selectedCrop);

  return (
    <AppLayout>
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => setShowTownPicker(true)}
              className="flex items-center gap-1.5 text-lg font-semibold text-seed-brown"
            >
              <FiMapPin className="w-4 h-4 text-seed-green" />
              {selectedTown}
              <FiChevronDown className="w-4 h-4 text-text-secondary" />
            </button>
            <p className="text-[11px] text-text-secondary">Kenya market prices · Updated today 6:00 AM</p>
          </div>
          <button
            onClick={() => setShowAlertDialog(true)}
            className="w-10 h-10 rounded-full bg-seed-green/10 flex items-center justify-center"
          >
            <FiBell className="w-4 h-4 text-seed-green" />
          </button>
        </div>
      </div>

      <div className="px-4 pb-4">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : groupedPrices && Object.keys(groupedPrices).length > 0 ? (
          <div className="space-y-4">
            {Object.entries(groupedPrices).map(([category, catPrices]) => (
              <div key={category}>
                <h4 className="text-[10px] font-medium text-text-secondary uppercase tracking-wider sticky top-0 bg-seed-cream py-2">
                  {categoryLabels[category] || category}
                </h4>
                <div className="space-y-1.5">
                  {catPrices?.map((price) => (
                    <button
                      key={price.id}
                      onClick={() => setSelectedCrop(price.cropName)}
                      className="w-full bg-white rounded-xl p-3 flex items-center justify-between shadow-sm border border-light text-left"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-9 h-9 rounded-lg bg-seed-green/10 flex items-center justify-center text-lg">
                          {CROP_EMOJI[price.cropName] || "🌱"}
                        </div>
                        <span className="text-sm font-medium text-text-primary">{price.cropName}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-text-primary">
                          {formatKES(price.wholesalePrice)}
                        </p>
                        <p className="text-[10px] text-text-secondary">
                          Retail: {formatKES(price.retailPrice)}
                        </p>
                      </div>
                      <div className="ml-3 flex items-center gap-0.5">
                        {price.trend === "up" ? (
                          <span className="flex items-center text-seed-success text-xs font-medium">
                            <FiTrendingUp className="w-3 h-3 mr-0.5" />
                            {price.trendPercent}%
                          </span>
                        ) : price.trend === "down" ? (
                          <span className="flex items-center text-seed-error text-xs font-medium">
                            <FiTrendingDown className="w-3 h-3 mr-0.5" />
                            {price.trendPercent}%
                          </span>
                        ) : (
                          <span className="text-text-secondary text-xs">—</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-sm text-text-secondary">No prices available for {selectedTown}</p>
          </div>
        )}
      </div>

      {selectedCrop && selectedPrice && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
          <div className="w-full bg-white rounded-t-3xl max-h-[70vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-4 py-3 border-b border-light flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{CROP_EMOJI[selectedCrop] || "🌱"}</span>
                <div>
                  <h3 className="font-display text-lg font-semibold text-seed-brown">{selectedCrop}</h3>
                  <p className="text-[10px] text-text-secondary">{selectedTown} Market</p>
                </div>
              </div>
              <button onClick={() => setSelectedCrop(null)} className="p-1">
                <FiX className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-seed-cream rounded-xl p-3 text-center">
                  <p className="text-[10px] text-text-secondary uppercase">High</p>
                  <p className="text-sm font-bold text-seed-brown">
                    {formatKES(Math.round(Number(selectedPrice.wholesalePrice) * 1.15))}
                  </p>
                </div>
                <div className="bg-seed-cream rounded-xl p-3 text-center">
                  <p className="text-[10px] text-text-secondary uppercase">Low</p>
                  <p className="text-sm font-bold text-seed-brown">
                    {formatKES(Math.round(Number(selectedPrice.wholesalePrice) * 0.85))}
                  </p>
                </div>
                <div className="bg-seed-cream rounded-xl p-3 text-center">
                  <p className="text-[10px] text-text-secondary uppercase">Avg</p>
                  <p className="text-sm font-bold text-seed-green">
                    {formatKES(selectedPrice.wholesalePrice)}
                  </p>
                </div>
              </div>

              <div className="bg-seed-cream rounded-xl p-4 mb-4">
                <h4 className="text-sm font-semibold text-text-primary mb-3">7-Day Price Trend</h4>
                <ResponsiveContainer width="100%" height={150}>
                  <AreaChart data={mockTrendData}>
                    <defs>
                      <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2D6A4F" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#2D6A4F" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD4" />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#6B5B4F" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#6B5B4F" }} width={45} />
                    <Tooltip
                      contentStyle={{
                        background: "#fff",
                        border: "1px solid #E8DFD4",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke="#2D6A4F"
                      strokeWidth={2}
                      fill="url(#priceGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-text-primary">Other Towns</h4>
                {KENYA_TOWNS.filter((t) => t !== selectedTown).slice(0, 4).map((town) => (
                  <div key={town} className="flex items-center justify-between py-2 border-b border-light last:border-0">
                    <span className="text-sm text-text-primary">{town}</span>
                    <span className="text-sm font-medium text-text-primary">
                      {formatKES(Math.round(Number(selectedPrice.wholesalePrice) * (0.9 + Math.random() * 0.2)))}
                    </span>
                  </div>
                ))}
              </div>

              <Button
                onClick={() => {
                  setSelectedCrop(null);
                  setAlertCrop(selectedCrop);
                  setShowAlertDialog(true);
                }}
                className="w-full h-12 bg-seed-green text-white rounded-xl font-semibold mt-4"
              >
                <FiBell className="w-4 h-4 mr-2" />
                Set Price Alert
              </Button>
            </div>
          </div>
        </div>
      )}

      {showTownPicker && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
          <div className="w-full bg-white rounded-t-3xl">
            <div className="px-4 py-3 border-b border-light flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-seed-brown">Select Town</h3>
              <button onClick={() => setShowTownPicker(false)} className="p-1">
                <FiX className="w-5 h-5 text-text-secondary" />
              </button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {KENYA_TOWNS.map((town) => (
                <button
                  key={town}
                  onClick={() => {
                    setSelectedTown(town);
                    setShowTownPicker(false);
                  }}
                  className={`p-3 rounded-xl text-sm font-medium transition-colors ${
                    town === selectedTown
                      ? "bg-seed-green text-white"
                      : "bg-seed-cream text-text-primary hover:bg-seed-green/10"
                  }`}
                >
                  {town}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <Dialog open={showAlertDialog} onOpenChange={setShowAlertDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="font-display text-lg text-seed-brown">Set Price Alert</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium text-text-primary mb-1.5 block">Crop</label>
              <select
                value={alertCrop}
                onChange={(e) => setAlertCrop(e.target.value)}
                className="w-full h-11 rounded-xl border border-light bg-seed-cream px-3 text-sm"
              >
                <option value="">Select crop...</option>
                {prices?.map((p) => (
                  <option key={p.cropName} value={p.cropName}>{p.cropName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary mb-1.5 block">Condition</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setAlertCondition("above")}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium ${
                    alertCondition === "above" ? "bg-seed-green text-white" : "bg-seed-cream text-text-primary"
                  }`}
                >
                  Goes Above
                </button>
                <button
                  onClick={() => setAlertCondition("below")}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium ${
                    alertCondition === "below" ? "bg-seed-green text-white" : "bg-seed-cream text-text-primary"
                  }`}
                >
                  Goes Below
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary mb-1.5 block">Target Price (KSh)</label>
              <Input
                type="number"
                placeholder="Enter target price"
                value={alertPrice}
                onChange={(e) => setAlertPrice(e.target.value)}
                className="h-11 rounded-xl border-light"
              />
            </div>
            <Button
              onClick={() => {
                if (alertCrop && alertPrice) {
                  createAlert.mutate({
                    cropName: alertCrop,
                    condition: alertCondition,
                    targetPrice: Number(alertPrice),
                  });
                }
              }}
              disabled={createAlert.isPending}
              className="w-full h-12 bg-seed-green text-white rounded-xl font-semibold"
            >
              {createAlert.isPending ? "Saving..." : "Save Alert"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
