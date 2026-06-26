import { Button } from "@/components/ui/button";
import { FiShoppingBag, FiTruck, FiUser } from "react-icons/fi";

function getOAuthUrl() {
  const kimiAuthUrl = import.meta.env.VITE_KIMI_AUTH_URL;
  const appID = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${kimiAuthUrl}/api/oauth/authorize`);
  url.searchParams.set("client_id", appID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "profile");
  url.searchParams.set("state", state);

  return url.toString();
}

const userTypes = [
  { icon: FiUser, label: "Farmer", desc: "Sell your crops" },
  { icon: FiShoppingBag, label: "Buyer", desc: "Source produce" },
  { icon: FiTruck, label: "Aggregator", desc: "Collect & distribute" },
];

export default function Login() {
  return (
    <div className="min-h-screen bg-seed-cream flex flex-col">
      {/* Header */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-seed-green to-seed-green-light flex items-center justify-center shadow-lg mb-6">
          <span className="text-4xl">🌱</span>
        </div>
        <h1 className="font-display text-2xl font-bold text-seed-brown mb-2">SeedPro Kenya</h1>
        <p className="text-sm text-text-secondary text-center mb-8 max-w-xs">
          Advertise your farm produce, connect with buyers, and grow your agribusiness across Kenya
        </p>

        {/* User Type Cards */}
        <div className="w-full max-w-xs space-y-3 mb-8">
          {userTypes.map((type) => {
            const Icon = type.icon;
            return (
              <div
                key={type.label}
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-light shadow-sm"
              >
                <div className="w-10 h-10 rounded-lg bg-seed-green/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-seed-green" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{type.label}</p>
                  <p className="text-[11px] text-text-secondary">{type.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Login Button */}
        <Button
          onClick={() => {
            window.location.href = getOAuthUrl();
          }}
          className="w-full max-w-xs h-12 bg-seed-green text-white rounded-xl font-semibold text-sm shadow-md hover:bg-seed-green/90"
        >
          Get Started
        </Button>

        <p className="text-[11px] text-text-secondary text-center mt-4 max-w-xs">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>

      {/* Footer */}
      <div className="text-center py-6">
        <p className="text-[11px] text-text-secondary">SeedPro Kenya · Built for Kenyan farmers</p>
      </div>
    </div>
  );
}
