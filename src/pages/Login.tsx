import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { FiShoppingBag, FiTruck, FiUser, FiCheck } from "react-icons/fi";

const userTypes = [
  { icon: FiUser,        label: "Farmer",      desc: "Post & sell your farm produce" },
  { icon: FiShoppingBag, label: "Buyer",        desc: "Source fresh produce directly" },
  { icon: FiTruck,       label: "Aggregator",   desc: "Collect & distribute produce" },
];

export default function Login() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState("Farmer");

  return (
    <div className="min-h-screen bg-seed-cream flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Logo */}
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-seed-green to-seed-green-light flex items-center justify-center shadow-lg mb-4">
          <span className="text-4xl">🌱</span>
        </div>
        <h1 className="font-display text-2xl font-bold text-seed-brown mb-1">SeedPro Kenya</h1>
        <p className="text-xs text-seed-green font-semibold tracking-wider uppercase mb-2">Fresh From the Farm</p>
        <p className="text-sm text-text-secondary text-center mb-8 max-w-xs">
          Connect with buyers, post listings, scan your crops and track live market prices across Kenya.
        </p>

        {/* Role selector */}
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3 self-start">I am a…</p>
        <div className="w-full max-w-xs space-y-2 mb-8">
          {userTypes.map((type) => {
            const Icon = type.icon;
            const active = selected === type.label;
            return (
              <button
                key={type.label}
                onClick={() => setSelected(type.label)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                  active
                    ? "border-seed-green bg-seed-green/5 shadow-sm"
                    : "border-light bg-white"
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${active ? "bg-seed-green" : "bg-seed-green/10"}`}>
                  <Icon className={`w-5 h-5 ${active ? "text-white" : "text-seed-green"}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-text-primary">{type.label}</p>
                  <p className="text-[11px] text-text-secondary">{type.desc}</p>
                </div>
                {active && <FiCheck className="w-4 h-4 text-seed-green flex-shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Features list */}
        <div className="w-full max-w-xs mb-8 space-y-2">
          {["✅ Verified farmer badges", "💳 M-Pesa payments", "📈 Live market prices", "📸 Plant scan AI"].map((f) => (
            <p key={f} className="text-xs text-text-secondary">{f}</p>
          ))}
        </div>

        <Button
          onClick={() => navigate("/")}
          className="w-full max-w-xs h-12 bg-seed-green text-white rounded-xl font-semibold text-sm shadow-md hover:bg-seed-green/90"
        >
          Enter as {selected} →
        </Button>

        <p className="text-[11px] text-text-secondary text-center mt-4 max-w-xs">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>

      <div className="text-center py-6">
        <p className="text-[11px] text-text-secondary">SeedPro Kenya · Empowering Kenyan Farmers</p>
      </div>
    </div>
  );
}
