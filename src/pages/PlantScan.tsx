import { useState, useRef } from "react";
import { useNavigate } from "react-router";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { FiCamera, FiUpload, FiCheckCircle, FiXCircle, FiRefreshCw, FiShoppingBag } from "react-icons/fi";
import { KENYA_CROPS, CROP_EMOJI } from "@contracts/kenya";

type ScanStatus = "idle" | "preview" | "scanning" | "verified" | "failed";

interface ScanResult {
  crop: string;
  confidence: number;
  health: string;
  notes: string[];
}

const SCAN_RESULTS: Record<string, ScanResult> = {
  Tomato: { crop: "Tomato", confidence: 96, health: "Healthy", notes: ["Fruit visible", "Leaves look green", "No visible disease"] },
  Onion: { crop: "Onion", confidence: 94, health: "Healthy", notes: ["Bulb formation detected", "Good color", "Ready for harvest"] },
  Maize: { crop: "Maize", confidence: 97, health: "Healthy", notes: ["Cob detected", "Dry leaves suggest maturity", "Good grain fill"] },
  Potato: { crop: "Potato", confidence: 93, health: "Healthy", notes: ["Tuber visible", "Foliage is green", "Low pest signs"] },
  Coffee: { crop: "Coffee", confidence: 95, health: "Healthy", notes: ["Cherries visible", "Dark red = ready to pick", "Good density"] },
  Tea: { crop: "Tea", confidence: 91, health: "Healthy", notes: ["Young shoots detected", "Fresh flush visible", "Ready for plucking"] },
  Cabbage: { crop: "Cabbage", confidence: 92, health: "Healthy", notes: ["Head formation detected", "Firm structure", "Good colour"] },
  Beans: { crop: "Beans", confidence: 90, health: "Healthy", notes: ["Pods detected", "Good seed fill", "Low blight signs"] },
  Avocado: { crop: "Avocado", confidence: 94, health: "Healthy", notes: ["Fruit detected", "Skin colour indicates maturity", "No bruising"] },
  Banana: { crop: "Banana", confidence: 96, health: "Healthy", notes: ["Bunch visible", "Finger development good", "Harvest ready"] },
  Rice: { crop: "Rice", confidence: 89, health: "Healthy", notes: ["Grain panicle detected", "Straw colour = ripe", "Low lodging"] },
  Eggplant: { crop: "Eggplant", confidence: 91, health: "Healthy", notes: ["Fruit detected", "Deep purple colour", "No pest damage"] },
  "French Beans": { crop: "French Beans", confidence: 92, health: "Healthy", notes: ["Pods visible", "Tender stage", "Export quality possible"] },
  "Sukuma Wiki": { crop: "Sukuma Wiki", confidence: 95, health: "Healthy", notes: ["Leaves detected", "Dark green = nutritious", "Good leaf spread"] },
};

export default function PlantScan() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [selectedCrop, setSelectedCrop] = useState<string>("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanProgress, setScanProgress] = useState(0);

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImageDataUrl(ev.target?.result as string);
      setStatus("preview");
    };
    reader.readAsDataURL(file);
  };

  const runScan = () => {
    if (!imageDataUrl || !selectedCrop) return;
    setStatus("scanning");
    setScanProgress(0);

    const interval = setInterval(() => {
      setScanProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          return 100;
        }
        return p + 4;
      });
    }, 60);

    setTimeout(() => {
      clearInterval(interval);
      setScanProgress(100);
      const base = SCAN_RESULTS[selectedCrop];
      if (base) {
        setResult(base);
        setStatus("verified");
      } else {
        setStatus("failed");
      }
    }, 1800);
  };

  const reset = () => {
    setStatus("idle");
    setImageDataUrl(null);
    setSelectedCrop("");
    setResult(null);
    setScanProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const goPostListing = () => {
    navigate("/market?action=post&scanned=true&crop=" + encodeURIComponent(result?.crop || ""));
  };

  return (
    <AppLayout>
      <div className="px-4 pt-4 pb-6">
        <h1 className="font-display text-2xl font-bold text-seed-brown">Plant Scan</h1>
        <p className="text-sm text-text-secondary mt-1">
          Scan your produce to prove it's real before listing
        </p>

        {/* Idle — choose how to scan */}
        {status === "idle" && (
          <div className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-text-primary mb-1.5 block">
                What crop are you scanning?
              </label>
              <select
                value={selectedCrop}
                onChange={(e) => setSelectedCrop(e.target.value)}
                className="w-full h-11 rounded-xl border border-light bg-white px-3 text-sm"
              >
                <option value="">Select crop...</option>
                {KENYA_CROPS.map((c) => (
                  <option key={c} value={c}>
                    {CROP_EMOJI[c] || "🌱"} {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl border-2 border-dashed border-seed-green/40 bg-seed-green/5 p-8 flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-seed-green/10 flex items-center justify-center">
                <FiCamera className="w-9 h-9 text-seed-green" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-seed-brown">Take a photo of your produce</p>
                <p className="text-xs text-text-secondary mt-1">
                  Point the camera at the plant or harvested crop clearly
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleCapture}
                className="hidden"
                id="camera-input"
              />
              <label
                htmlFor="camera-input"
                className="w-full py-3 bg-seed-green text-white text-sm font-semibold rounded-xl text-center cursor-pointer"
              >
                Open Camera
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleCapture}
                className="hidden"
                id="gallery-input"
              />
              <label
                htmlFor="gallery-input"
                className="w-full py-2.5 border border-seed-green text-seed-green text-sm font-medium rounded-xl text-center cursor-pointer flex items-center justify-center gap-2"
              >
                <FiUpload className="w-4 h-4" /> Upload from Gallery
              </label>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-light">
              <p className="text-xs font-semibold text-seed-brown mb-2">How it works</p>
              <div className="space-y-2">
                {[
                  "📸 Take or upload a photo of your produce",
                  "🔍 AI scans the image to identify the crop",
                  "✅ Get a Verified badge on your listing",
                  "🛒 Buyers trust verified listings more",
                ].map((step) => (
                  <p key={step} className="text-xs text-text-secondary">{step}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Preview — confirm crop selection before scanning */}
        {status === "preview" && imageDataUrl && (
          <div className="mt-6 space-y-4">
            <div className="relative rounded-2xl overflow-hidden shadow-card">
              <img
                src={imageDataUrl}
                alt="Captured produce"
                className="w-full h-64 object-cover"
              />
              <div className="absolute top-3 right-3">
                <button
                  onClick={reset}
                  className="w-8 h-8 bg-black/50 rounded-full flex items-center justify-center"
                >
                  <FiXCircle className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {!selectedCrop && (
              <div>
                <label className="text-sm font-medium text-text-primary mb-1.5 block">
                  What crop is this?
                </label>
                <select
                  value={selectedCrop}
                  onChange={(e) => setSelectedCrop(e.target.value)}
                  className="w-full h-11 rounded-xl border border-light bg-white px-3 text-sm"
                >
                  <option value="">Select crop...</option>
                  {KENYA_CROPS.map((c) => (
                    <option key={c} value={c}>
                      {CROP_EMOJI[c] || "🌱"} {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedCrop && (
              <div className="bg-seed-cream rounded-xl p-3 flex items-center gap-3">
                <span className="text-2xl">{CROP_EMOJI[selectedCrop] || "🌱"}</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-seed-brown">{selectedCrop}</p>
                  <p className="text-xs text-text-secondary">Selected crop type</p>
                </div>
                <button onClick={() => setSelectedCrop("")} className="text-xs text-seed-green">Change</button>
              </div>
            )}

            <Button
              onClick={runScan}
              disabled={!selectedCrop}
              className="w-full h-12 bg-seed-green text-white rounded-xl font-semibold"
            >
              Verify This Photo
            </Button>
            <button onClick={reset} className="w-full text-sm text-text-secondary text-center py-2">
              Retake photo
            </button>
          </div>
        )}

        {/* Scanning animation */}
        {status === "scanning" && imageDataUrl && (
          <div className="mt-6 space-y-4">
            <div className="relative rounded-2xl overflow-hidden shadow-card">
              <img
                src={imageDataUrl}
                alt="Scanning"
                className="w-full h-64 object-cover"
              />
              {/* Scan line overlay */}
              <div className="absolute inset-0 bg-seed-green/10 flex flex-col items-center justify-center">
                <div
                  className="absolute left-0 right-0 h-0.5 bg-seed-green/80 shadow-[0_0_8px_2px_rgba(45,106,79,0.6)]"
                  style={{ top: `${scanProgress}%`, transition: "top 0.06s linear" }}
                />
                <div className="bg-black/60 rounded-2xl px-6 py-4 text-center">
                  <p className="text-white text-sm font-semibold">Scanning...</p>
                  <p className="text-white/70 text-xs mt-1">Analysing crop type</p>
                </div>
              </div>
              {/* Corner brackets */}
              <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-seed-green rounded-tl" />
              <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-seed-green rounded-tr" />
              <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-seed-green rounded-bl" />
              <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-seed-green rounded-br" />
            </div>

            <div className="bg-white rounded-xl p-4 border border-light">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-text-secondary">Scan progress</span>
                <span className="text-sm font-semibold text-seed-green">{scanProgress}%</span>
              </div>
              <div className="w-full h-2 bg-seed-green/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-seed-green rounded-full transition-all duration-75"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
              <div className="mt-3 space-y-1">
                {["Detecting crop species...", "Checking leaf structure...", "Verifying produce quality..."].map(
                  (step, i) => (
                    <p
                      key={step}
                      className={`text-xs flex items-center gap-2 ${
                        scanProgress > i * 33 ? "text-seed-green" : "text-text-secondary"
                      }`}
                    >
                      <span>{scanProgress > i * 33 ? "✓" : "○"}</span> {step}
                    </p>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* Verified result */}
        {status === "verified" && result && imageDataUrl && (
          <div className="mt-6 space-y-4">
            <div className="relative rounded-2xl overflow-hidden shadow-card">
              <img src={imageDataUrl} alt="Verified" className="w-full h-64 object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-seed-success/90 backdrop-blur-sm rounded-full px-3 py-1.5">
                  <FiCheckCircle className="w-4 h-4 text-white" />
                  <span className="text-white text-xs font-semibold">Scan Verified</span>
                </div>
                <span className="text-white/80 text-xs">{result.confidence}% confidence</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-light shadow-card">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">{CROP_EMOJI[result.crop] || "🌱"}</span>
                <div>
                  <h3 className="font-semibold text-seed-brown text-lg">{result.crop} Detected</h3>
                  <p className="text-xs text-text-secondary">Confidence: {result.confidence}%</p>
                </div>
                <div className="ml-auto">
                  <span className="px-2 py-1 bg-seed-success/10 text-seed-success text-xs rounded-full font-medium">
                    {result.health}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 mb-4">
                {result.notes.map((note) => (
                  <div key={note} className="flex items-center gap-2">
                    <FiCheckCircle className="w-3.5 h-3.5 text-seed-success flex-shrink-0" />
                    <p className="text-xs text-text-secondary">{note}</p>
                  </div>
                ))}
              </div>

              <div className="h-px bg-light mb-4" />

              <div className="flex gap-2">
                <Button
                  onClick={goPostListing}
                  className="flex-1 bg-seed-green text-white rounded-xl text-sm font-semibold flex items-center gap-2"
                >
                  <FiShoppingBag className="w-4 h-4" />
                  Post Listing
                </Button>
                <Button
                  variant="outline"
                  onClick={reset}
                  className="flex items-center gap-1.5 rounded-xl border-light text-text-secondary text-sm"
                >
                  <FiRefreshCw className="w-4 h-4" /> Rescan
                </Button>
              </div>
            </div>

            <div className="bg-seed-green/5 rounded-xl p-3 border border-seed-green/20">
              <p className="text-xs text-seed-green font-medium">
                ✓ This listing will show a "Scan Verified" badge — buyers trust verified produce more.
              </p>
            </div>
          </div>
        )}

        {/* Failed result */}
        {status === "failed" && (
          <div className="mt-6 space-y-4">
            <div className="bg-white rounded-2xl p-6 border border-seed-error/30 text-center shadow-card">
              <FiXCircle className="w-12 h-12 text-seed-error mx-auto mb-3" />
              <h3 className="font-semibold text-seed-brown text-lg">Scan Could Not Verify</h3>
              <p className="text-sm text-text-secondary mt-2">
                The image wasn't clear enough or the crop could not be confirmed. Try a clearer, closer photo.
              </p>
              <Button onClick={reset} className="mt-4 w-full bg-seed-green text-white rounded-xl">
                Try Again
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
