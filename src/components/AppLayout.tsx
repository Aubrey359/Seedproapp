import { useState } from "react";
import { Link, useLocation } from "react-router";
import { FiHome, FiShoppingBag, FiMessageCircle, FiTrendingUp, FiUser, FiBell, FiMenu } from "react-icons/fi";
import { useAuth } from "@/hooks/useAuth";
import { APP_TAGLINE } from "@contracts/kenya";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const tabs = [
  { path: "/", icon: FiHome, label: "Home" },
  { path: "/market", icon: FiShoppingBag, label: "Market" },
  { path: "/advisory", icon: FiMessageCircle, label: "Advisory" },
  { path: "/prices", icon: FiTrendingUp, label: "Prices" },
  { path: "/profile", icon: FiUser, label: "Profile" },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-seed-cream flex flex-col max-w-lg mx-auto relative">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-seed-cream/95 backdrop-blur-sm border-b border-light">
        <div className="flex items-center justify-between h-14 px-4">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <button className="p-2 rounded-lg hover:bg-seed-green/10 transition-colors">
                <FiMenu className="w-5 h-5 text-seed-brown" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-seed-cream border-r border-light">
              <SheetHeader>
                <SheetTitle className="font-display text-xl text-seed-brown">SeedPro</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 space-y-1">
                {[
                  { path: "/", label: "Home" },
                  { path: "/market", label: "Marketplace" },
                  { path: "/scan", label: "Scan Plant" },
                  { path: "/advisory", label: "Crop Advisory" },
                  { path: "/prices", label: "Market Prices" },
                  { path: "/profile", label: "My Profile" },
                ].map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`block px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      isActive(item.path)
                        ? "bg-seed-green text-white"
                        : "text-text-primary hover:bg-seed-green/10"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-8 px-4">
                <p className="text-xs text-text-secondary uppercase tracking-wider mb-2">Account</p>
                {isAuthenticated ? (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-seed-brown">{user?.name || "User"}</p>
                    <p className="text-xs text-text-secondary">{user?.email || ""}</p>
                  </div>
                ) : (
                  <Link
                    to="/login"
                    onClick={() => setSidebarOpen(false)}
                    className="block px-4 py-2 rounded-lg bg-seed-green text-white text-sm text-center font-medium"
                  >
                    Login
                  </Link>
                )}
              </div>
            </SheetContent>
          </Sheet>

          <Link to="/" className="flex flex-col items-center">
            <span className="font-display text-xl font-bold text-seed-brown leading-tight">SeedPro</span>
            <span className="text-[9px] text-seed-green font-medium tracking-wide">{APP_TAGLINE}</span>
          </Link>

          <button className="p-2 rounded-lg hover:bg-seed-green/10 transition-colors relative">
            <FiBell className="w-5 h-5 text-seed-brown" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-seed-error rounded-full" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-light shadow-[0_-2px_12px_rgba(45,106,79,0.08)] max-w-lg mx-auto">
        <div className="flex items-center justify-around h-16">
          {tabs.map((tab) => {
            const active = isActive(tab.path);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`flex flex-col items-center justify-center w-full h-full relative transition-colors ${
                  active ? "text-seed-green" : "text-text-secondary"
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? "stroke-[2.5px]" : "stroke-[1.5px]"}`} />
                <span className={`text-[10px] mt-0.5 ${active ? "font-semibold" : ""}`}>{tab.label}</span>
                {active && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-seed-green rounded-full" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
