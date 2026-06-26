import { useState, useEffect } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import {
  FiPlus, FiTrendingUp, FiMessageCircle, FiFileText, FiClipboard,
  FiChevronRight, FiAlertTriangle, FiSun, FiCamera
} from "react-icons/fi";
import { AppLayout } from "@/components/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DEFAULT_TOWN, CROP_EMOJI, formatKES,
} from "@contracts/kenya";

const heroSlides = [
  {
    image: "/images/hero-farm-1.jpg",
    headline: "Tomato Prices Rising in Nairobi",
    subline: "Post your harvest now and connect with buyers across Kenya",
    cta: "Post Produce",
    link: "/market?action=post",
  },
  {
    image: "/images/hero-farm-2.jpg",
    headline: "Long Rains Season Guide",
    subline: "Get expert advice for maximum yield this season",
    cta: "Get Advisory",
    link: "/advisory",
  },
];

const quickActions = [
  { icon: FiPlus, label: "Post Produce", color: "bg-seed-green", link: "/market?action=post" },
  { icon: FiCamera, label: "Scan Plant", color: "bg-seed-brown", link: "/scan" },
  { icon: FiTrendingUp, label: "Get Prices", color: "bg-seed-gold", link: "/prices" },
  { icon: FiMessageCircle, label: "Ask Expert", color: "bg-seed-green", link: "/advisory" },
  { icon: FiFileText, label: "My Listings", color: "bg-seed-brown", link: "/profile?tab=listings" },
  { icon: FiClipboard, label: "Orders", color: "bg-seed-green", link: "/profile?tab=orders" },
];

export default function Home() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const { data: listings, isLoading: listingsLoading } = trpc.market.list.useQuery({});
  const { data: prices } = trpc.prices.getByTown.useQuery({ town: DEFAULT_TOWN });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <AppLayout>
      {/* Hero Carousel */}
      <div className="relative h-48 overflow-hidden">
        {heroSlides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-700 ${
              index === currentSlide ? "opacity-100" : "opacity-0"
            }`}
          >
            <img
              src={slide.image}
              alt={slide.headline}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <h2 className="text-white font-semibold text-lg leading-tight">{slide.headline}</h2>
              <p className="text-white/80 text-xs mt-1">{slide.subline}</p>
              <Link
                to={slide.link}
                className="inline-block mt-2 px-4 py-1.5 bg-seed-green text-white text-xs font-medium rounded-full"
              >
                {slide.cta}
              </Link>
            </div>
          </div>
        ))}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
          {heroSlides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                i === currentSlide ? "bg-white w-3" : "bg-white/40"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-4">
        <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                to={action.link}
                className="flex flex-col items-center gap-1.5 min-w-[64px]"
              >
                <div className={`w-12 h-12 ${action.color} rounded-xl flex items-center justify-center shadow-md`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-[11px] font-medium text-text-primary">{action.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Market Snapshot */}
      <div className="px-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg font-semibold text-seed-brown">Today&apos;s Market</h3>
          <Link to="/prices" className="text-xs text-seed-green font-medium flex items-center gap-0.5">
            See All <FiChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {prices && prices.length > 0 ? (
          <div className="space-y-2">
            {prices.slice(0, 3).map((price) => (
              <div
                key={price.id}
                className="bg-white rounded-xl p-3 flex items-center justify-between shadow-card border border-light"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-seed-green/10 flex items-center justify-center">
                    <span className="text-lg">{CROP_EMOJI[price.cropName] || "🌱"}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{price.cropName}</p>
                    <p className="text-[11px] text-text-secondary">{DEFAULT_TOWN}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-seed-green">{formatKES(price.wholesalePrice, "kg")}</p>
                  <p className="text-[10px] flex items-center justify-end gap-0.5">
                    {price.trend === "up" ? (
                      <span className="text-seed-success flex items-center">▲ {price.trendPercent}%</span>
                    ) : price.trend === "down" ? (
                      <span className="text-seed-error flex items-center">▼ {price.trendPercent}%</span>
                    ) : (
                      <span className="text-text-secondary">— {price.trendPercent}%</span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        )}
      </div>

      {/* Crop Advisory Preview */}
      <div className="px-4 mb-4">
        <div className="bg-white rounded-2xl p-4 shadow-card border border-light border-l-4 border-l-[#25D366]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-full bg-[#25D366] flex items-center justify-center">
              <FiMessageCircle className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-semibold text-text-primary">SeedPro Advisory</span>
          </div>
          <div className="bg-seed-cream rounded-xl p-3 mb-2">
            <p className="text-sm text-text-primary">
              Habari! Your tomato crop is entering flowering stage. Time to apply calcium fertilizer before the rains.
            </p>
          </div>
          <p className="text-xs text-text-secondary italic mb-3">
            Reply with PHOTO to diagnose crop problems
          </p>
          <Link
            to="/advisory"
            className="block w-full py-2.5 bg-[#25D366] text-white text-sm font-semibold rounded-xl text-center"
          >
            Open Advisory
          </Link>
        </div>
      </div>

      {/* Daily Tip */}
      <div className="px-4 mb-4">
        <div className="rounded-2xl p-5 bg-gradient-to-br from-seed-green to-seed-green-light relative overflow-hidden">
          <FiSun className="absolute top-3 right-3 w-8 h-8 text-white/20" />
          <p className="text-[10px] font-medium text-white/70 uppercase tracking-wider mb-1">Tip of the Day</p>
          <p className="text-sm font-semibold text-white leading-relaxed">
            Rotate your tomato crops with legumes to improve soil nitrogen naturally and reduce pest pressure in Kenyan highlands.
          </p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="px-4 mb-4">
        <h3 className="font-display text-lg font-semibold text-seed-brown mb-3">Recent Activity</h3>
        <div className="space-y-3">
          {[
            { icon: FiFileText, text: "You posted 200kg of onions for sale", time: "2h ago", color: "text-seed-green bg-seed-green/10" },
            { icon: FiClipboard, text: "New buyer order #1234 for tomatoes", time: "5h ago", color: "text-seed-gold bg-seed-gold/10", action: "View" },
            { icon: FiAlertTriangle, text: "Price alert: Coffee prices up 8% in Nyeri", time: "1d ago", color: "text-seed-error bg-seed-error/10" },
          ].map((activity, i) => {
            const Icon = activity.icon;
            return (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-light last:border-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activity.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-text-primary">{activity.text}</p>
                  <p className="text-[11px] text-text-secondary">{activity.time}</p>
                </div>
                {activity.action && (
                  <button className="text-xs text-seed-green font-medium">{activity.action}</button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Featured Listings */}
      <div className="px-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg font-semibold text-seed-brown">Fresh Listings</h3>
          <Link to="/market" className="text-xs text-seed-green font-medium flex items-center gap-0.5">
            Browse <FiChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {listingsLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-40 rounded-2xl" />
            ))}
          </div>
        ) : listings && listings.length > 0 ? (
          <div className="space-y-3">
            {listings.slice(0, 2).map((listing) => (
              <Link
                key={listing.id}
                to={`/market?listing=${listing.id}`}
                className="block bg-white rounded-2xl overflow-hidden shadow-card border border-light"
              >
                <div className="h-28 relative">
                  <img
                    src={listing.images?.[0] || "/images/crop-tomato.jpg"}
                    alt={listing.cropName}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
                    <div>
                      <h4 className="text-white font-semibold text-sm">{listing.cropName}</h4>
                      <p className="text-white/80 text-[11px]">{listing.location}</p>
                    </div>
                    <span className="px-2 py-0.5 bg-seed-green text-white text-[10px] rounded-full font-medium">
                      {listing.quantity}kg
                    </span>
                  </div>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-text-secondary">{listing.farmerName || "Farmer"}</span>
                  </div>
                  <p className="text-sm font-bold text-seed-green">
                    {formatKES(listing.expectedPrice, "kg")}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 text-center border border-light">
            <p className="text-sm text-text-secondary">No listings yet. Be the first Kenyan farmer to post!</p>
            <Link to="/market?action=post" className="inline-block mt-2 text-sm text-seed-green font-medium">
              Advertise your produce
            </Link>
          </div>
        )}
      </div>

      <div className="text-center py-4 pb-24">
        <p className="text-[11px] text-text-secondary">SeedPro Kenya v1.0</p>
      </div>
    </AppLayout>
  );
}
