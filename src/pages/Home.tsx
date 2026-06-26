import { useState, useEffect } from "react";
import { Link } from "react-router";
import {
  FiCamera, FiShoppingBag, FiTrendingUp, FiMessageCircle,
  FiCheckCircle, FiStar, FiArrowRight, FiMapPin, FiUsers,
  FiPackage, FiChevronRight,
} from "react-icons/fi";
import { AppLayout } from "@/components/AppLayout";
import { CROP_EMOJI } from "@contracts/kenya";

/* ─── static mock data ─────────────────────────────────────── */
const FEATURED = [
  { id: 1, crop: "Tomato", farmer: "James Mwangi", location: "Nakuru", price: 95, qty: 500, rating: 4.9, verified: true, img: "/images/crop-tomato.jpg" },
  { id: 2, crop: "Maize",  farmer: "Grace Achieng", location: "Kisumu", price: 42, qty: 2000, rating: 4.7, verified: true, img: "/images/crop-maize.jpg" },
  { id: 3, crop: "Potato", farmer: "Peter Njoroge", location: "Nyeri",  price: 58, qty: 800, rating: 4.8, verified: false, img: "/images/crop-potato.jpg" },
  { id: 4, crop: "Coffee", farmer: "Mary Wanjiku",  location: "Thika",  price: 320, qty: 200, rating: 5.0, verified: true, img: "/images/crop-coffee.jpg" },
];

const PRICES = [
  { crop: "Tomato",  price: 95,  trend: "up",   pct: 12 },
  { crop: "Maize",   price: 42,  trend: "down",  pct: 3  },
  { crop: "Coffee",  price: 320, trend: "up",    pct: 8  },
  { crop: "Potato",  price: 58,  trend: "up",    pct: 5  },
  { crop: "Onion",   price: 110, trend: "up",    pct: 15 },
  { crop: "Cabbage", price: 35,  trend: "down",  pct: 2  },
];

const TESTIMONIALS = [
  { name: "Grace Achieng", role: "Maize Farmer, Kisumu", quote: "I sold 3 tonnes in one week after posting my verified listing. Buyers trust the scan badge — it makes all the difference.", avatar: "👩🏾‍🌾" },
  { name: "James Mwangi",  role: "Tomato Farmer, Nakuru", quote: "Before SeedPro I drove 2 hours to find buyers. Now they come to me. I've tripled my income in 3 months.", avatar: "👨🏿‍🌾" },
  { name: "Mary Wanjiku",  role: "Coffee Farmer, Thika",  quote: "The price tracker told me when to hold and when to sell. I got 22% more than my neighbours this season.", avatar: "👩🏽‍🌾" },
];

const HERO_SLIDES = [
  { headline: "Kenya's Farmer Marketplace", sub: "Sell your produce directly to buyers — no middlemen, better prices.", cta: "Post Produce", link: "/market?action=post", bg: "from-[#1a4731] to-[#2D6A4F]" },
  { headline: "Scan Your Plant, Prove It's Real", sub: "Use your camera to verify produce authenticity and earn the trusted badge.", cta: "Try Plant Scan", link: "/scan", bg: "from-[#2D6A4F] to-[#52B788]" },
  { headline: "Real-Time Market Prices", sub: "Track prices across 12 Kenyan counties and sell at exactly the right moment.", cta: "Check Prices", link: "/prices", bg: "from-[#3d5a3e] to-[#2D6A4F]" },
];

export default function Home() {
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSlide(s => (s + 1) % HERO_SLIDES.length), 4500);
    return () => clearInterval(t);
  }, []);

  const current = HERO_SLIDES[slide];

  return (
    <AppLayout>
      {/* ── HERO CAROUSEL ─────────────────────────────────── */}
      <div className={`relative bg-gradient-to-br ${current.bg} px-5 pt-8 pb-10 overflow-hidden transition-all duration-700`}>
        {/* decorative blobs */}
        <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/5 rounded-full" />
        <div className="absolute bottom-0 -left-6 w-28 h-28 bg-white/5 rounded-full" />

        {/* floating emojis */}
        <div className="absolute top-5 right-5 text-3xl opacity-30 animate-bounce">🌱</div>
        <div className="absolute bottom-8 right-12 text-2xl opacity-20">🌿</div>

        <p className="text-white/60 text-[11px] font-semibold tracking-widest uppercase mb-2">SeedPro Kenya</p>
        <h1 className="text-white font-bold text-2xl leading-tight mb-3 max-w-[260px]">
          {current.headline}
        </h1>
        <p className="text-white/75 text-sm leading-relaxed mb-6 max-w-[280px]">
          {current.sub}
        </p>
        <div className="flex gap-3">
          <Link
            to={current.link}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-[#2D6A4F] rounded-full text-sm font-bold shadow-lg"
          >
            {current.cta} <FiArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/market"
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-white/30 text-white rounded-full text-sm font-medium"
          >
            Browse
          </Link>
        </div>

        {/* slide dots */}
        <div className="flex gap-1.5 mt-6">
          {HERO_SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === slide ? "w-6 bg-white" : "w-1.5 bg-white/40"}`}
            />
          ))}
        </div>
      </div>

      {/* ── STATS BAR ─────────────────────────────────────── */}
      <div className="bg-white border-b border-[#E8DFD4] px-4 py-3">
        <div className="flex items-center justify-around">
          {[
            { icon: FiUsers,   val: "2,400+", label: "Farmers" },
            { icon: FiPackage, val: "8,100+", label: "Listings" },
            { icon: FiMapPin,  val: "12",     label: "Counties" },
          ].map(({ icon: Icon, val, label }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#2D6A4F]/10 flex items-center justify-center">
                <Icon className="w-4 h-4 text-[#2D6A4F]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#2C1810] leading-none">{val}</p>
                <p className="text-[10px] text-[#6B5B4F]">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── QUICK ACTIONS ─────────────────────────────────── */}
      <div className="px-4 pt-5 pb-2">
        <div className="grid grid-cols-4 gap-3">
          {[
            { icon: FiShoppingBag, label: "Post Produce", link: "/market?action=post", bg: "bg-[#2D6A4F]" },
            { icon: FiCamera,      label: "Scan Plant",   link: "/scan",              bg: "bg-[#52B788]" },
            { icon: FiTrendingUp,  label: "Prices",       link: "/prices",            bg: "bg-[#D4A373]" },
            { icon: FiMessageCircle, label: "Advisory",   link: "/advisory",          bg: "bg-[#6B4226]" },
          ].map(({ icon: Icon, label, link, bg }) => (
            <Link key={label} to={link} className="flex flex-col items-center gap-1.5">
              <div className={`w-14 h-14 ${bg} rounded-2xl flex items-center justify-center shadow-md`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <span className="text-[11px] font-medium text-[#2C1810] text-center leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── PLANT SCAN SPOTLIGHT ──────────────────────────── */}
      <div className="px-4 mt-5">
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#1a4731] to-[#2D6A4F] p-5">
          <div className="absolute right-0 top-0 bottom-0 w-28 flex items-center justify-center opacity-20">
            <span className="text-7xl">🌿</span>
          </div>
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1 mb-3">
              <FiCamera className="w-3 h-3 text-white" />
              <span className="text-white text-[11px] font-semibold">NEW FEATURE</span>
            </div>
            <h3 className="text-white font-bold text-lg leading-tight mb-1">Scan & Verify Your Crop</h3>
            <p className="text-white/70 text-xs mb-4 max-w-[200px]">
              Point your camera at any plant — our AI identifies it and adds a trusted verified badge to your listing.
            </p>
            <Link
              to="/scan"
              className="inline-flex items-center gap-2 bg-white text-[#2D6A4F] rounded-full px-4 py-2 text-xs font-bold"
            >
              <FiCamera className="w-3.5 h-3.5" /> Try Plant Scan
            </Link>
          </div>
        </div>
      </div>

      {/* ── LIVE PRICES ───────────────────────────────────── */}
      <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-[#2C1810] text-base">Today's Prices</h2>
          <Link to="/prices" className="text-xs text-[#2D6A4F] font-semibold flex items-center gap-0.5">
            View all <FiChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {PRICES.map(({ crop, price, trend, pct }) => (
            <div key={crop} className="bg-white rounded-xl p-3 border border-[#E8DFD4] shadow-sm">
              <div className="text-xl mb-1">{CROP_EMOJI[crop] || "🌱"}</div>
              <p className="text-xs font-semibold text-[#2C1810] truncate">{crop}</p>
              <p className="text-sm font-bold text-[#2D6A4F]">KSh {price}</p>
              <p className={`text-[10px] font-medium ${trend === "up" ? "text-emerald-600" : "text-red-500"}`}>
                {trend === "up" ? "▲" : "▼"} {pct}%
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURED LISTINGS ─────────────────────────────── */}
      <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-[#2C1810] text-base">Fresh Listings</h2>
          <Link to="/market" className="text-xs text-[#2D6A4F] font-semibold flex items-center gap-0.5">
            Browse all <FiChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="space-y-3">
          {FEATURED.map(({ id, crop, farmer, location, price, qty, rating, verified, img }) => (
            <Link
              key={id}
              to="/market"
              className="flex gap-3 bg-white rounded-2xl p-3 border border-[#E8DFD4] shadow-sm"
            >
              <div className="relative flex-shrink-0">
                <img
                  src={img}
                  alt={crop}
                  className="w-20 h-20 rounded-xl object-cover"
                  onError={e => { (e.target as HTMLImageElement).src = "/images/crop-tomato.jpg"; }}
                />
                {verified && (
                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shadow">
                    <FiCheckCircle className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1">
                  <h3 className="font-bold text-[#2C1810] text-sm">{crop}</h3>
                  <span className="text-sm font-bold text-[#2D6A4F] flex-shrink-0">KSh {price}<span className="text-[10px] font-normal text-[#6B5B4F]">/kg</span></span>
                </div>
                <p className="text-xs text-[#6B5B4F] flex items-center gap-0.5 mt-0.5">
                  <FiMapPin className="w-3 h-3" /> {location}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-[#6B5B4F]">{farmer}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FiStar className="w-3 h-3 text-[#D4A373] fill-current" />
                    <span className="text-xs font-semibold text-[#2C1810]">{rating}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10px] bg-[#2D6A4F]/10 text-[#2D6A4F] rounded-full px-2 py-0.5 font-medium">
                    {qty.toLocaleString()} kg
                  </span>
                  {verified && (
                    <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                      <FiCheckCircle className="w-3 h-3" /> Scan Verified
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ──────────────────────────────────── */}
      <div className="px-4 mt-8">
        <h2 className="font-bold text-[#2C1810] text-base mb-4 text-center">How SeedPro Works</h2>
        <div className="space-y-3">
          {[
            { step: "1", icon: "📸", title: "Scan Your Crop", desc: "Take a photo — our AI verifies it's real and healthy" },
            { step: "2", icon: "📋", title: "Post Your Listing", desc: "Add your price, quantity and location in under 60 seconds" },
            { step: "3", icon: "💰", title: "Connect & Sell", desc: "Buyers find you directly — no broker, full price for you" },
          ].map(({ step, icon, title, desc }) => (
            <div key={step} className="flex items-start gap-4 bg-white rounded-2xl p-4 border border-[#E8DFD4] shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#2D6A4F] flex items-center justify-center flex-shrink-0 shadow">
                <span className="text-lg">{icon}</span>
              </div>
              <div className="flex-1">
                <p className="text-[10px] text-[#2D6A4F] font-bold uppercase tracking-wider mb-0.5">Step {step}</p>
                <p className="text-sm font-bold text-[#2C1810]">{title}</p>
                <p className="text-xs text-[#6B5B4F] mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TESTIMONIALS ──────────────────────────────────── */}
      <div className="px-4 mt-8">
        <h2 className="font-bold text-[#2C1810] text-base mb-4">What Farmers Say</h2>
        <div className="space-y-3">
          {TESTIMONIALS.map(({ name, role, quote, avatar }) => (
            <div key={name} className="bg-white rounded-2xl p-4 border border-[#E8DFD4] shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-full bg-[#2D6A4F]/10 flex items-center justify-center text-xl">
                  {avatar}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#2C1810]">{name}</p>
                  <p className="text-[11px] text-[#6B5B4F]">{role}</p>
                </div>
                <div className="ml-auto flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <FiStar key={i} className="w-3 h-3 text-[#D4A373] fill-current" />
                  ))}
                </div>
              </div>
              <p className="text-sm text-[#6B5B4F] leading-relaxed italic">"{quote}"</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── BOTTOM CTA ────────────────────────────────────── */}
      <div className="px-4 mt-8 mb-6">
        <div className="bg-gradient-to-br from-[#1a4731] to-[#2D6A4F] rounded-2xl p-6 text-center relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/5 rounded-full" />
          <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-white/5 rounded-full" />
          <span className="text-3xl mb-3 block">🌱</span>
          <h3 className="text-white font-bold text-lg mb-2">Start Selling Today</h3>
          <p className="text-white/70 text-sm mb-5 leading-relaxed">
            Join 2,400 Kenyan farmers earning more by selling directly to buyers.
          </p>
          <Link
            to="/market?action=post"
            className="inline-flex items-center gap-2 bg-white text-[#2D6A4F] rounded-full px-6 py-3 text-sm font-bold shadow-lg"
          >
            Post Your First Listing <FiArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <p className="text-center text-[11px] text-[#6B5B4F] pb-6">SeedPro Kenya · Empowering Farmers</p>
    </AppLayout>
  );
}
