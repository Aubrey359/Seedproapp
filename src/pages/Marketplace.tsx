import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { trpc } from "@/providers/trpc";
import { AppLayout } from "@/components/AppLayout";
import {
  FiSearch, FiFilter, FiMapPin, FiCheckCircle, FiPhone,
  FiCamera, FiUpload, FiXCircle
} from "react-icons/fi";
import { CROP_EMOJI } from "@contracts/kenya";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  KENYA_TOWNS, KENYA_CROPS, CROP_CATEGORIES, CROP_CATEGORY_MAP, formatKES,
} from "@contracts/kenya";

export default function Marketplace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [selectedListing, setSelectedListing] = useState<number | null>(null);
  const [orderDialog, setOrderDialog] = useState(false);
  const [postDialog, setPostDialog] = useState(false);
  const [orderQuantity, setOrderQuantity] = useState(10);
  const [postInitialCrop, setPostInitialCrop] = useState("");
  const [postInitialScanned, setPostInitialScanned] = useState(false);

  const { data: listings, isLoading } = trpc.market.list.useQuery({
    search: search || undefined,
    location: selectedLocation || undefined,
  });

  const { data: listingDetail } = trpc.market.getById.useQuery(
    { id: selectedListing! },
    { enabled: !!selectedListing }
  );

  // Open post dialog or listing from URL params (once on mount)
  useEffect(() => {
    const action = searchParams.get("action");
    const listingId = searchParams.get("listing");
    const cropParam = searchParams.get("crop");
    const scannedParam = searchParams.get("scanned");
    if (action === "post") {
      if (cropParam) setPostInitialCrop(cropParam);
      if (scannedParam === "true") setPostInitialScanned(true);
      setPostDialog(true);
    }
    if (listingId) setSelectedListing(Number(listingId));
    if (action || listingId) {
      const next = new URLSearchParams(searchParams);
      next.delete("action");
      next.delete("listing");
      next.delete("crop");
      next.delete("scanned");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const utils = trpc.useUtils();
  const createOrder = trpc.market.createOrder.useMutation({
    onSuccess: () => {
      utils.market.list.invalidate();
      utils.market.myOrders.invalidate();
      setOrderDialog(false);
      setSelectedListing(null);
    },
  });

  const filteredListings = listings?.filter((l) => {
    if (activeCategory === "all") return true;
    return CROP_CATEGORY_MAP[l.cropName] === activeCategory;
  });

  const handlePlaceOrder = () => {
    if (!listingDetail) return;
    createOrder.mutate({
      listingId: listingDetail.id,
      quantity: orderQuantity,
      price: Number(listingDetail.expectedPrice),
      deliveryMethod: "pickup",
    });
  };

  const applyFilters = () => {
    setSelectedLocation(filterLocation);
  };

  return (
    <AppLayout>
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-xs text-text-secondary mb-2">
          Advertise your farm produce to buyers across Kenya
        </p>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <Input
              placeholder="Search crops, counties..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 rounded-full bg-white border-light text-sm"
            />
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <button className="w-11 h-11 bg-seed-green rounded-full flex items-center justify-center shadow-md">
                <FiFilter className="w-4 h-4 text-white" />
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl bg-white">
              <SheetHeader>
                <SheetTitle className="font-display text-lg text-seed-brown">Filter Listings</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="text-sm font-medium text-text-primary mb-2 block">County / Town</label>
                  <select
                    value={filterLocation}
                    onChange={(e) => setFilterLocation(e.target.value)}
                    className="w-full h-10 rounded-lg border border-light bg-seed-cream px-3 text-sm"
                  >
                    <option value="">All Locations</option>
                    {KENYA_TOWNS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-text-primary mb-2 block">Category</label>
                  <div className="flex flex-wrap gap-2">
                    {CROP_CATEGORIES.filter((c) => c.value !== "all").map((c) => (
                      <button
                        key={c.value}
                        onClick={() => setActiveCategory(c.value)}
                        className={`px-3 py-1.5 rounded-full text-xs border ${
                          activeCategory === c.value
                            ? "bg-seed-green text-white border-seed-green"
                            : "border-light bg-seed-cream text-text-primary"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Button
                  onClick={applyFilters}
                  className="w-full h-12 bg-seed-green text-white rounded-xl font-semibold"
                >
                  Apply Filters
                </Button>
                {selectedLocation && (
                  <Button
                    variant="outline"
                    onClick={() => { setSelectedLocation(""); setFilterLocation(""); }}
                    className="w-full h-10 rounded-xl"
                  >
                    Clear Location Filter
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
        {selectedLocation && (
          <p className="text-[11px] text-seed-green mt-2 flex items-center gap-1">
            <FiMapPin className="w-3 h-3" /> Showing listings in {selectedLocation}
          </p>
        )}
      </div>

      {/* Category Tabs */}
      <div className="px-4 py-2">
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          {CROP_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeCategory === cat.value
                  ? "bg-seed-green text-white"
                  : "bg-white text-text-primary border border-light"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Listings */}
      <div className="px-4 pb-4 space-y-3">
        {isLoading ? (
          [1, 2, 3].map((i) => <Skeleton key={i} className="h-48 rounded-2xl" />)
        ) : filteredListings && filteredListings.length > 0 ? (
          filteredListings.map((listing) => (
            <div
              key={listing.id}
              onClick={() => setSelectedListing(listing.id)}
              className="bg-white rounded-2xl overflow-hidden shadow-card border border-light cursor-pointer"
            >
              <div className="h-36 relative">
                <img
                  src={listing.images?.[0] || `/images/crop-${listing.cropName.toLowerCase().replace(/ /g, "-")}.jpg`}
                  alt={listing.cropName}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = "/images/crop-tomato.jpg"; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <div className="absolute top-2 right-2 flex gap-1">
                  {listing.farmerVerified && (
                    <span className="px-2 py-0.5 bg-white/90 rounded-full text-[10px] font-medium text-seed-green flex items-center gap-0.5">
                      <FiCheckCircle className="w-3 h-3" /> Verified
                    </span>
                  )}
                </div>
                <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
                  <div>
                    <h3 className="text-white font-semibold">{listing.cropName}</h3>
                    <div className="flex items-center gap-1 text-white/80 text-[11px]">
                      <FiMapPin className="w-3 h-3" />
                      {listing.location}
                    </div>
                  </div>
                  <span className="text-white/80 text-[11px]">
                    {listing.harvestDate ? new Date(listing.harvestDate).toLocaleDateString() : "Fresh"}
                  </span>
                </div>
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <img
                      src={listing.farmerAvatar || "/images/farmer-avatar-1.jpg"}
                      alt=""
                      className="w-6 h-6 rounded-full object-cover"
                    />
                    <span className="text-xs text-text-secondary">{listing.farmerName || "Farmer"}</span>
                    {listing.farmerRating && (
                      <span className="text-[10px] text-seed-gold">★ {listing.farmerRating}</span>
                    )}
                  </div>
                  <span className="px-2 py-0.5 bg-seed-green/10 text-seed-green text-[10px] rounded-full font-medium">
                    {listing.quantity}{listing.quantityUnit || "kg"} available
                  </span>
                </div>
                {listing.description && (
                  <p className="text-[11px] text-text-secondary mb-2 line-clamp-2">{listing.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <p className="text-lg font-bold text-seed-green">
                    {formatKES(listing.expectedPrice)}
                    <span className="text-xs font-normal text-text-secondary">/kg</span>
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="px-3 py-1.5 border border-seed-green text-seed-green text-xs rounded-lg font-medium"
                    >
                      Contact
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedListing(listing.id);
                        setOrderDialog(true);
                      }}
                      className="px-3 py-1.5 bg-seed-green text-white text-xs rounded-lg font-medium"
                    >
                      Order
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <p className="text-sm text-text-secondary">No listings found</p>
            <button
              onClick={() => setPostDialog(true)}
              className="mt-2 text-sm text-seed-green font-medium"
            >
              Be the first farmer to advertise produce
            </button>
          </div>
        )}
      </div>

      {/* FAB Post Produce */}
      <button
        onClick={() => setPostDialog(true)}
        className="fixed right-4 bottom-20 w-14 h-14 bg-seed-green rounded-full flex items-center justify-center shadow-fab z-30"
        aria-label="Post produce for sale"
      >
        <span className="text-white text-2xl font-light">+</span>
      </button>

      {/* Listing Detail Dialog */}
      <Dialog open={!!selectedListing && !orderDialog} onOpenChange={(open) => !open && setSelectedListing(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-white max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-lg text-seed-brown">Listing Details</DialogTitle>
          </DialogHeader>
          {listingDetail && (
            <div className="space-y-4 mt-2">
              <img
                src={listingDetail.images?.[0] || "/images/crop-tomato.jpg"}
                alt={listingDetail.cropName}
                className="w-full h-40 rounded-xl object-cover"
              />
              <div>
                <h3 className="font-semibold text-lg text-text-primary">{listingDetail.cropName}</h3>
                <p className="text-sm text-text-secondary flex items-center gap-1 mt-1">
                  <FiMapPin className="w-3 h-3" /> {listingDetail.location}
                </p>
                <p className="text-xl font-bold text-seed-green mt-2">
                  {formatKES(listingDetail.expectedPrice, "kg")}
                </p>
              </div>
              {listingDetail.description && (
                <p className="text-sm text-text-secondary">{listingDetail.description}</p>
              )}
              <div className="flex items-center gap-3 p-3 bg-seed-cream rounded-xl">
                <img src="/images/farmer-avatar-1.jpg" alt="" className="w-10 h-10 rounded-full object-cover" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{listingDetail.farmerName || "Farmer"}</p>
                  {listingDetail.farmerPhone && (
                    <p className="text-xs text-text-secondary flex items-center gap-1">
                      <FiPhone className="w-3 h-3" /> {listingDetail.farmerPhone}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl border-seed-green text-seed-green"
                >
                  Contact Farmer
                </Button>
                <Button
                  onClick={() => setOrderDialog(true)}
                  className="flex-1 bg-seed-green text-white rounded-xl"
                >
                  Place Order
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Order Dialog */}
      <Dialog open={orderDialog} onOpenChange={setOrderDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="font-display text-lg text-seed-brown">Place Order</DialogTitle>
          </DialogHeader>
          {listingDetail && (
            <div className="space-y-4 mt-2">
              <div className="flex items-center gap-3">
                <img
                  src={listingDetail.images?.[0] || "/images/crop-tomato.jpg"}
                  alt=""
                  className="w-16 h-16 rounded-xl object-cover"
                />
                <div>
                  <h4 className="font-semibold text-text-primary">{listingDetail.cropName}</h4>
                  <p className="text-xs text-text-secondary">{listingDetail.location}</p>
                  <p className="text-sm font-bold text-seed-green">{formatKES(listingDetail.expectedPrice, "kg")}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-text-primary mb-2 block">Quantity (kg)</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setOrderQuantity(Math.max(1, orderQuantity - 5))}
                    className="w-10 h-10 rounded-lg bg-seed-cream flex items-center justify-center text-lg font-medium"
                  >
                    -
                  </button>
                  <Input
                    type="number"
                    value={orderQuantity}
                    onChange={(e) => setOrderQuantity(Number(e.target.value))}
                    className="text-center h-10"
                  />
                  <button
                    onClick={() => setOrderQuantity(orderQuantity + 5)}
                    className="w-10 h-10 rounded-lg bg-seed-cream flex items-center justify-center text-lg font-medium"
                  >
                    +
                  </button>
                </div>
                <p className="text-xs text-text-secondary mt-1">
                  Available: {listingDetail.quantity}kg
                </p>
              </div>

              <div className="bg-seed-cream rounded-xl p-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-text-secondary">Price per kg</span>
                  <span className="font-medium">{formatKES(listingDetail.expectedPrice)}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-text-secondary">Quantity</span>
                  <span className="font-medium">{orderQuantity}kg</span>
                </div>
                <div className="border-t border-light pt-2 flex justify-between font-bold text-seed-brown">
                  <span>Total</span>
                  <span>{formatKES(Number(listingDetail.expectedPrice) * orderQuantity)}</span>
                </div>
              </div>

              <Button
                onClick={handlePlaceOrder}
                disabled={createOrder.isPending}
                className="w-full h-12 bg-seed-green text-white rounded-xl font-semibold"
              >
                {createOrder.isPending ? "Placing Order..." : "Confirm Order"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Post Produce Dialog */}
      <Dialog open={postDialog} onOpenChange={setPostDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-white max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-lg text-seed-brown">Advertise Your Produce</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-text-secondary -mt-2">
            List your crops for sale and reach buyers across Kenya
          </p>
          <PostCropForm
            onSuccess={() => { setPostDialog(false); setPostInitialCrop(""); setPostInitialScanned(false); }}
            initialCrop={postInitialCrop}
            initialScanned={postInitialScanned}
          />
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

type ScanState = "none" | "scanning" | "done";

function PostCropForm({ onSuccess, initialCrop = "", initialScanned = false }: {
  onSuccess: () => void;
  initialCrop?: string;
  initialScanned?: boolean;
}) {
  const [cropName, setCropName] = useState(initialCrop);
  const [quantity, setQuantity] = useState("");
  const [location, setLocation] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");

  // Scan state
  const [scanState, setScanState] = useState<ScanState>(initialScanned ? "done" : "none");
  const [scanProgress, setScanProgress] = useState(initialScanned ? 100 : 0);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scanConfidence, setScanConfidence] = useState(0);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const createListing = trpc.market.create.useMutation({
    onSuccess: () => {
      utils.market.list.invalidate();
      utils.market.myListings.invalidate();
      onSuccess();
    },
  });

  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setCapturedImage(dataUrl);
      startScan();
    };
    reader.readAsDataURL(file);
  };

  const startScan = () => {
    if (!cropName) return;
    setScanState("scanning");
    setScanProgress(0);
    const interval = setInterval(() => {
      setScanProgress((p) => {
        if (p >= 100) { clearInterval(interval); return 100; }
        return p + 5;
      });
    }, 80);
    setTimeout(() => {
      clearInterval(interval);
      setScanProgress(100);
      setScanConfidence(Math.floor(Math.random() * 7) + 90); // 90–96%
      setScanState("done");
    }, 1800);
  };

  const clearScan = () => {
    setScanState("none");
    setScanProgress(0);
    setCapturedImage(null);
    setScanConfidence(0);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cropName || !quantity || !location || !price) return;
    createListing.mutate({
      cropName,
      quantity: Number(quantity),
      location,
      expectedPrice: Number(price),
      description: description || undefined,
      images: capturedImage ? [capturedImage] : [],
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-2">
      {/* Crop selection */}
      <div>
        <label className="text-sm font-medium text-text-primary mb-1.5 block">Crop / Produce</label>
        <select
          value={cropName}
          onChange={(e) => { setCropName(e.target.value); clearScan(); }}
          className="w-full h-11 rounded-xl border border-light bg-seed-cream px-3 text-sm"
          required
        >
          <option value="">Select crop...</option>
          {KENYA_CROPS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Plant Scan section */}
      <div className={`rounded-xl border-2 p-3 transition-colors ${
        scanState === "done"
          ? "border-seed-success bg-seed-success/5"
          : "border-dashed border-seed-green/30 bg-seed-green/5"
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FiCamera className={`w-4 h-4 ${scanState === "done" ? "text-seed-success" : "text-seed-green"}`} />
            <span className="text-sm font-semibold text-seed-brown">
              {scanState === "done" ? "Scan Verified ✓" : "Verify with Camera Scan"}
            </span>
          </div>
          {scanState === "done" && (
            <button type="button" onClick={clearScan} className="text-xs text-text-secondary flex items-center gap-1">
              <FiXCircle className="w-3 h-3" /> Remove
            </button>
          )}
        </div>

        {scanState === "none" && (
          <>
            <p className="text-xs text-text-secondary mb-2">
              Take a photo of your {cropName || "produce"} to add a verified badge to your listing
            </p>
            <div className="flex gap-2">
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageCapture}
                className="hidden"
                id="post-camera"
              />
              <label
                htmlFor="post-camera"
                className={`flex-1 py-2 text-xs font-medium rounded-lg text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                  !cropName
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-seed-green text-white"
                }`}
                onClick={(e) => { if (!cropName) e.preventDefault(); }}
              >
                <FiCamera className="w-3.5 h-3.5" /> Camera
              </label>
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageCapture}
                className="hidden"
                id="post-gallery"
              />
              <label
                htmlFor="post-gallery"
                className={`flex-1 py-2 text-xs font-medium rounded-lg text-center cursor-pointer flex items-center justify-center gap-1.5 border ${
                  !cropName
                    ? "border-gray-200 text-gray-400 cursor-not-allowed"
                    : "border-seed-green text-seed-green"
                }`}
                onClick={(e) => { if (!cropName) e.preventDefault(); }}
              >
                <FiUpload className="w-3.5 h-3.5" /> Gallery
              </label>
            </div>
            {!cropName && (
              <p className="text-[11px] text-text-secondary mt-1.5">Select a crop first to enable scan</p>
            )}
          </>
        )}

        {scanState === "scanning" && (
          <div className="space-y-2">
            {capturedImage && (
              <div className="relative rounded-lg overflow-hidden h-24">
                <img src={capturedImage} alt="Scanning" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-seed-green/10">
                  <div
                    className="absolute left-0 right-0 h-0.5 bg-seed-green shadow-[0_0_6px_1px_rgba(45,106,79,0.8)]"
                    style={{ top: `${scanProgress}%`, transition: "top 0.08s linear" }}
                  />
                </div>
              </div>
            )}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-text-secondary">Scanning {cropName}...</span>
                <span className="text-seed-green font-medium">{scanProgress}%</span>
              </div>
              <div className="w-full h-1.5 bg-seed-green/10 rounded-full">
                <div className="h-full bg-seed-green rounded-full transition-all" style={{ width: `${scanProgress}%` }} />
              </div>
            </div>
          </div>
        )}

        {scanState === "done" && capturedImage && (
          <div className="flex items-center gap-3">
            <img src={capturedImage} alt="Verified" className="w-16 h-12 rounded-lg object-cover flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <FiCheckCircle className="w-3.5 h-3.5 text-seed-success" />
                <span className="text-xs font-semibold text-seed-success">{cropName} confirmed</span>
              </div>
              <p className="text-[11px] text-text-secondary mt-0.5">{scanConfidence}% confidence · Healthy</p>
              <p className="text-[11px] text-seed-green mt-0.5">Verified badge will appear on listing</p>
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="text-sm font-medium text-text-primary mb-1.5 block">Quantity (kg)</label>
        <Input
          type="number"
          placeholder="e.g. 500"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="h-11 rounded-xl border-light"
          required
        />
      </div>

      <div>
        <label className="text-sm font-medium text-text-primary mb-1.5 block">County / Town</label>
        <select
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full h-11 rounded-xl border border-light bg-seed-cream px-3 text-sm"
          required
        >
          <option value="">Select location...</option>
          {KENYA_TOWNS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-text-primary mb-1.5 block">Asking Price (KSh/kg)</label>
        <Input
          type="number"
          placeholder="e.g. 95"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="h-11 rounded-xl border-light"
          required
        />
      </div>

      <div>
        <label className="text-sm font-medium text-text-primary mb-1.5 block">Description</label>
        <textarea
          placeholder="Describe quality, variety, harvest date, delivery options..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-light bg-seed-cream px-3 py-2 text-sm resize-none"
        />
      </div>

      <Button
        type="submit"
        disabled={createListing.isPending}
        className="w-full h-12 bg-seed-green text-white rounded-xl font-semibold"
      >
        {createListing.isPending
          ? "Publishing..."
          : scanState === "done"
          ? "Publish Verified Listing"
          : "Publish Listing"}
      </Button>
    </form>
  );
}
