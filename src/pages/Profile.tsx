import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import {
  FiStar, FiCheckCircle, FiMapPin, FiPhone,
  FiLogOut, FiShoppingBag, FiFileText, FiTrendingUp, FiPlus
} from "react-icons/fi";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DEFAULT_TOWN, PHONE_PREFIX, formatKES, formatKESCompact, CROP_EMOJI,
} from "@contracts/kenya";

const sampleReviews = [
  {
    reviewer: "Jane Wanjiru",
    avatar: "/images/buyer-avatar-1.jpg",
    rating: 5,
    date: "2 weeks ago",
    text: "Excellent quality tomatoes! Very fresh and well-packed. Wanjiku is reliable and delivers on time.",
    tags: ["Quality produce", "Reliable", "On time"],
  },
  {
    reviewer: "Robert Mwangi",
    avatar: "/images/farmer-avatar-2.jpg",
    rating: 4,
    date: "1 month ago",
    text: "Good consistent quality. Always meets expectations. Recommended for bulk orders.",
    tags: ["Quality produce", "Professional"],
  },
  {
    reviewer: "Faith Muthoni",
    avatar: "/images/farmer-avatar-1.jpg",
    rating: 5,
    date: "2 months ago",
    text: "Best supplier in Nairobi region. The tomatoes are always ripe and ready for market.",
    tags: ["Reliable", "Fast Payment"],
  },
];

const ratingBreakdown = [
  { stars: 5, percent: 45 },
  { stars: 4, percent: 25 },
  { stars: 3, percent: 10 },
  { stars: 2, percent: 5 },
  { stars: 1, percent: 15 },
];

type Tab = "overview" | "listings" | "reviews" | "orders";

export default function Profile() {
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated, logout } = useAuth();
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "listings" || tab === "orders" || tab === "reviews") {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const { data: myOrders } = trpc.market.myOrders.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: myListings } = trpc.market.myListings.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] px-8">
          <div className="w-20 h-20 rounded-full bg-seed-green/10 flex items-center justify-center mb-4">
            <FiStar className="w-8 h-8 text-seed-green" />
          </div>
          <h2 className="font-display text-xl font-semibold text-seed-brown mb-2">Welcome to SeedPro Kenya</h2>
          <p className="text-sm text-text-secondary text-center mb-6">
            Login to advertise your produce, manage listings, track orders, and connect with buyers across Kenya.
          </p>
          <Link
            to="/login"
            className="w-full max-w-xs py-3 bg-seed-green text-white text-sm font-semibold rounded-xl text-center"
          >
            Login
          </Link>
          <p className="text-xs text-text-secondary mt-4">
            For farmers, buyers, and aggregators in Kenya
          </p>
        </div>
      </AppLayout>
    );
  }

  const activeListings = myListings?.filter((l) => l.status === "active").length ?? 0;

  return (
    <AppLayout>
      <div className="relative">
        <div className="h-28 bg-gradient-to-r from-seed-green via-seed-green-light to-seed-gold relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <svg className="w-full h-full" viewBox="0 0 400 120" preserveAspectRatio="none">
              <path d="M0,80 Q100,40 200,70 T400,50 L400,120 L0,120 Z" fill="white" />
              <path d="M0,100 Q150,60 300,90 T400,80 L400,120 L0,120 Z" fill="white" opacity="0.5" />
            </svg>
          </div>
        </div>

        <div className="flex justify-center -mt-10 relative z-10">
          <div className="w-20 h-20 rounded-full border-4 border-white overflow-hidden shadow-lg">
            <img
              src={user?.avatar || "/images/farmer-avatar-1.jpg"}
              alt={user?.name || "User"}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <div className="text-center px-4 pt-2 pb-4">
          <h2 className="font-display text-lg font-semibold text-seed-brown">
            {user?.name || "Farmer"}
          </h2>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="px-2 py-0.5 bg-seed-success/10 text-seed-success text-[10px] rounded-full font-medium flex items-center gap-0.5">
              <FiCheckCircle className="w-3 h-3" /> Verified Farmer
            </span>
          </div>
          <div className="flex items-center justify-center gap-1 mt-2">
            {[1, 2, 3, 4].map((s) => (
              <FiStar key={s} className="w-4 h-4 text-seed-gold-light fill-current" />
            ))}
            <FiStar className="w-4 h-4 text-seed-gold-light" />
            <span className="text-sm font-semibold text-text-primary ml-1">4.5</span>
            <span className="text-xs text-text-secondary">(23 reviews)</span>
          </div>
          <div className="flex items-center justify-center gap-4 mt-2 text-xs text-text-secondary">
            <span className="flex items-center gap-1">
              <FiMapPin className="w-3 h-3" /> {user?.location || DEFAULT_TOWN}
            </span>
            <span className="flex items-center gap-1">
              <FiPhone className="w-3 h-3" /> {user?.phone || `${PHONE_PREFIX}712345678`}
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 mb-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Listings", value: activeListings.toString(), icon: FiFileText },
            { label: "Orders", value: myOrders?.length.toString() || "0", icon: FiShoppingBag },
            { label: "Sales", value: formatKESCompact(240000), icon: FiTrendingUp },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-white rounded-xl p-3 text-center shadow-sm border border-light">
                <Icon className="w-5 h-5 text-seed-green mx-auto mb-1" />
                <p className="text-lg font-bold text-seed-brown">{stat.value}</p>
                <p className="text-[10px] text-text-secondary">{stat.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-4 mb-4">
        <div className="flex bg-white rounded-xl p-1 border border-light overflow-x-auto hide-scrollbar">
          {(["overview", "listings", "reviews", "orders"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 min-w-[70px] py-2 rounded-lg text-xs font-medium capitalize transition-colors ${
                activeTab === tab ? "bg-seed-green text-white" : "text-text-secondary"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-6">
        {activeTab === "overview" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-light">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Rating Breakdown</h3>
              <div className="space-y-2">
                {ratingBreakdown.map((item) => (
                  <div key={item.stars} className="flex items-center gap-2">
                    <span className="text-xs text-text-secondary w-8">{item.stars} ★</span>
                    <div className="flex-1 h-2 bg-seed-cream rounded-full overflow-hidden">
                      <div
                        className="h-full bg-seed-gold rounded-full transition-all"
                        style={{ width: `${item.percent}%` }}
                      />
                    </div>
                    <span className="text-xs text-text-secondary w-8">{item.percent}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-light">
              <h3 className="text-sm font-semibold text-text-primary mb-2">About</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                {user?.bio || "Experienced farmer supplying fresh produce to markets across central Kenya. Passionate about sustainable agriculture and helping fellow Kenyan farmers grow their business."}
              </p>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-light">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Recent Orders</h3>
              {myOrders && myOrders.length > 0 ? (
                <div className="space-y-2">
                  {myOrders.slice(0, 3).map((order) => (
                    <div key={order.id} className="flex items-center justify-between py-2 border-b border-light last:border-0">
                      <div>
                        <p className="text-xs font-medium text-text-primary">Order #{order.id}</p>
                        <p className="text-[10px] text-text-secondary">{order.quantity}kg • {order.status}</p>
                      </div>
                      <span className="text-xs font-semibold text-seed-green">
                        {formatKES(order.totalAmount)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-secondary">No orders yet</p>
              )}
            </div>
          </div>
        )}

        {activeTab === "listings" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">My Produce Listings</h3>
              <Link to="/market?action=post" className="text-xs text-seed-green font-medium flex items-center gap-1">
                <FiPlus className="w-3 h-3" /> New Listing
              </Link>
            </div>
            {myListings && myListings.length > 0 ? (
              myListings.map((listing) => (
                <div key={listing.id} className="bg-white rounded-xl p-4 shadow-sm border border-light">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg bg-seed-green/10 flex items-center justify-center text-xl flex-shrink-0">
                      {CROP_EMOJI[listing.cropName] || "🌱"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-text-primary">{listing.cropName}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          listing.status === "active" ? "bg-seed-success/10 text-seed-success" :
                          listing.status === "sold" ? "bg-seed-gold/10 text-seed-gold" :
                          "bg-gray-100 text-text-secondary"
                        }`}>
                          {listing.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-secondary flex items-center gap-1 mt-0.5">
                        <FiMapPin className="w-3 h-3" /> {listing.location} · {listing.quantity}kg
                      </p>
                      <p className="text-sm font-bold text-seed-green mt-1">
                        {formatKES(listing.expectedPrice, "kg")}
                      </p>
                      {listing.description && (
                        <p className="text-[11px] text-text-secondary mt-1 line-clamp-2">{listing.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 bg-white rounded-xl border border-light">
                <FiFileText className="w-8 h-8 text-seed-green/40 mx-auto mb-2" />
                <p className="text-sm text-text-secondary">No listings yet</p>
                <p className="text-xs text-text-secondary mt-1 mb-3">Start advertising your farm produce to buyers</p>
                <Link
                  to="/market?action=post"
                  className="inline-block px-4 py-2 bg-seed-green text-white text-xs font-semibold rounded-xl"
                >
                  Post Your First Listing
                </Link>
              </div>
            )}
          </div>
        )}

        {activeTab === "reviews" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">Reviews</h3>
              <button
                onClick={() => setShowReviewDialog(true)}
                className="text-xs text-seed-green font-medium"
              >
                Write Review
              </button>
            </div>
            {sampleReviews.map((review, i) => (
              <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-light">
                <div className="flex items-center gap-2 mb-2">
                  <img src={review.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-text-primary">{review.reviewer}</p>
                    <p className="text-[10px] text-text-secondary">{review.date}</p>
                  </div>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <FiStar
                        key={s}
                        className={`w-3 h-3 ${s <= review.rating ? "text-seed-gold-light fill-current" : "text-gray-200"}`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed mb-2">{review.text}</p>
                <div className="flex flex-wrap gap-1">
                  {review.tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-seed-cream text-text-secondary text-[10px] rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "orders" && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-text-primary">My Orders</h3>
            {myOrders && myOrders.length > 0 ? (
              myOrders.map((order) => (
                <div key={order.id} className="bg-white rounded-xl p-4 shadow-sm border border-light">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-text-primary">Order #{order.id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      order.status === "delivered" ? "bg-seed-success/10 text-seed-success" :
                      order.status === "pending" ? "bg-seed-gold/10 text-seed-gold" :
                      "bg-seed-info/10 text-seed-info"
                    }`}>
                      {order.status}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-text-secondary">
                    <span>{order.quantity}kg</span>
                    <span className="font-semibold text-seed-green">
                      {formatKES(order.totalAmount)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-text-secondary">No orders yet</p>
                <Link to="/market" className="text-xs text-seed-green font-medium mt-1 inline-block">
                  Browse marketplace
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-4 pb-24">
        <button
          onClick={logout}
          className="w-full py-3 border border-seed-error/30 text-seed-error rounded-xl text-sm font-medium flex items-center justify-center gap-2"
        >
          <FiLogOut className="w-4 h-4" />
          Logout
        </button>
      </div>

      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="font-display text-lg text-seed-brown">Write a Review</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onClick={() => setReviewRating(s)}
                  className="p-1"
                >
                  <FiStar
                    className={`w-8 h-8 ${
                      s <= reviewRating ? "text-seed-gold-light fill-current" : "text-gray-200"
                    }`}
                  />
                </button>
              ))}
            </div>
            <textarea
              placeholder="Share your experience..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-light bg-seed-cream px-3 py-2 text-sm resize-none"
            />
            <div className="flex flex-wrap gap-2">
              {["Reliable", "Quality", "Fast Payment", "Good Communication"].map((tag) => (
                <button
                  key={tag}
                  className="px-3 py-1 bg-seed-cream text-text-secondary text-xs rounded-full border border-light"
                >
                  {tag}
                </button>
              ))}
            </div>
            <Button
              onClick={() => setShowReviewDialog(false)}
              className="w-full h-12 bg-seed-green text-white rounded-xl font-semibold"
            >
              Submit Review
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
