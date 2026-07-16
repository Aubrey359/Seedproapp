/* ── SITE SETTINGS: admin-editable hero copy, social links, footer text ── */
function applySiteSettings(s) {
  if (!s) return;
  if (s.heroHeadline) { var hh = document.getElementById('heroHeadline'); if (hh) hh.textContent = s.heroHeadline; }
  if (s.heroSubtext)  { var hs = document.getElementById('heroSubtext');  if (hs) hs.textContent = s.heroSubtext; }
  if (s.whatsappNumber) {
    var waHref = 'https://wa.me/' + s.whatsappNumber.replace(/[^\d]/g, '');
    document.querySelectorAll('.social-btn.wa').forEach(function(a) {
      a.href = waHref;
      a.title = 'WhatsApp ' + s.whatsappNumber;
      a.setAttribute('aria-label', 'WhatsApp ' + s.whatsappNumber);
    });
  }
  if (s.instagramUrl) document.querySelectorAll('.social-btn.ig').forEach(function(a){ a.href = s.instagramUrl; });
  if (s.xUrl)         document.querySelectorAll('.social-btn.x').forEach(function(a){ a.href = s.xUrl; });
  if (s.facebookUrl)  document.querySelectorAll('.social-btn.fb').forEach(function(a){ a.href = s.facebookUrl; });
  if (s.footerTagline) document.querySelectorAll('.footer-tagline').forEach(function(el){ el.textContent = s.footerTagline; });
  if (s.footerAddress) document.querySelectorAll('.footer-address-text').forEach(function(el){ el.textContent = s.footerAddress; });
}

function loadSiteSettings() {
  return fetch('/api/trpc/settings.get')
    .then(function(r){ return r.json(); })
    .then(function(d){ applySiteSettings((d && d.result && d.result.data && d.result.data.json) || null); })
    .catch(function(){});
}

/* ── PRODUCTS: live listings from MongoDB via tRPC market.list ── */
var PRODUCTS = [];
var productsLoaded = false;

/* Crop look (emoji + photo + category) isn't on a listing row, so it's
   keyed by crop name here — mirrors the crop photos already shipped. */
var CROP_META = {
  'tomato':       { emoji:'🍅', img:'/images/crop-tomato.jpg',      cat:'vegetables' },
  'onion':        { emoji:'🧅', img:'/images/crop-onion.jpg',       cat:'vegetables' },
  'maize':        { emoji:'🌽', img:'/images/crop-maize.jpg',       cat:'grains' },
  'coffee':       { emoji:'☕', img:'/images/crop-coffee.jpg',      cat:'cash' },
  'potato':       { emoji:'🥔', img:'/images/crop-potato.jpg',      cat:'vegetables' },
  'cabbage':      { emoji:'🥬', img:'/images/crop-cabbage.jpg',     cat:'vegetables' },
  'beans':        { emoji:'🫘', img:'/images/crop-beans.jpg',       cat:'legumes' },
  'pishori rice': { emoji:'🍚', img:'/images/crop-rice.jpg',        cat:'grains' },
  'rice':         { emoji:'🍚', img:'/images/crop-rice.jpg',        cat:'grains' },
  'tea':          { emoji:'🍵', img:'/images/crop-tea.jpg',         cat:'cash' },
  'avocado':      { emoji:'🥑', img:'/images/crop-avocado.jpg',     cat:'fruits' },
  'banana':       { emoji:'🍌', img:'/images/crop-banana.jpg',      cat:'fruits' },
  'french beans': { emoji:'🫛', img:'/images/crop-frenchbeans.jpg', cat:'vegetables' },
  'sukuma wiki':  { emoji:'🥬', img:'/images/crop-sukuma.jpg',      cat:'vegetables' },
  'sweet potato': { emoji:'🍠', img:'/images/crop-sweetpotato.jpg', cat:'vegetables' },
};
function cropMeta(name) {
  return CROP_META[(name||'').toLowerCase().trim()] || { emoji:'🌾', img:null, cat:'vegetables' };
}

/* Map a live listing (from market.list) into the shape cardHTML expects. */
function mapListing(l) {
  var meta = cropMeta(l.cropName);
  var realPhoto = (l.images && l.images.length) ? l.images[0] : null;
  return {
    id: l.id,
    name: l.cropName,
    emoji: meta.emoji,
    img: realPhoto || meta.img,
    hasPhoto: !!realPhoto,
    cat: meta.cat,
    price: l.expectedPrice,
    old: null,
    unit: l.quantityUnit || 'kg',
    farmer: l.farmerName || 'Verified Farmer',
    farmerId: l.farmerId,
    county: l.location,
    rating: l.farmerRating || 4.5,
    ok: !!l.farmerVerified,
    premium: !!l.farmerPremium,
    disc: null,
  };
}

function loadProducts() {
  return fetch('/api/trpc/market.list')
    .then(function(r){ return r.json(); })
    .then(function(d){
      var rows = (d && d.result && d.result.data && d.result.data.json) || [];
      PRODUCTS = rows.map(mapListing);
      applyLocationSort();
    })
    .catch(function(err){ console.error('Failed to load listings', err); PRODUCTS = []; })
    .then(function(){
      productsLoaded = true;
      renderHomeGrid();
      renderShopGrid();
    });
}

/* ── "Farmers near me": buyer picks their town, matching listings float
   to the top. Client-side only (no new profile field, no location
   permission prompt) — just a stable sort over the already-fetched
   PRODUCTS array, so it works for logged-out browsing too. ── */
var BUYER_LOCATION = (function(){ try { return localStorage.getItem('sp_buyer_location') || ''; } catch(e){ return ''; } })();

function applyLocationSort() {
  if (!BUYER_LOCATION) return;
  var loc = BUYER_LOCATION.toLowerCase();
  PRODUCTS = PRODUCTS
    .map(function(p, i){ return { p: p, i: i }; })
    .sort(function(a, b){
      var an = (a.p.county||'').toLowerCase() === loc ? 0 : 1;
      var bn = (b.p.county||'').toLowerCase() === loc ? 0 : 1;
      return an !== bn ? an - bn : a.i - b.i;
    })
    .map(function(x){ return x.p; });
}

function setBuyerLocation(loc) {
  BUYER_LOCATION = loc || '';
  try { localStorage.setItem('sp_buyer_location', BUYER_LOCATION); } catch(e){}
  // Multiple pages (Shop, Farmer Next Door) each have their own copy of this
  // picker — keep them all in sync rather than relying on one #id.
  document.querySelectorAll('.buyer-location-sel').forEach(function(sel){ sel.value = BUYER_LOCATION; });
  if (productsLoaded) {
    loadProducts(); // re-fetch so the sort re-applies from a clean base order
  }
  populateWardOptions(); // ward choices depend on which county is selected — may clear a stale BUYER_WARD
  updateNearMeBanner(); // must run after populateWardOptions so it reflects any ward reset above
  renderNearbyFarmers();
  renderFarmersPage();
}

/* ── Ward-level filtering, layered on top of the county picker above.
   Farmer Next Door only (not Shop) — a farmer's ward isn't collected
   anywhere yet, so options are built from whatever real farmers actually
   have on file rather than a fixed master list of Kenya's ~1,450 wards. ── */
var BUYER_WARD = (function(){ try { return localStorage.getItem('sp_buyer_ward') || ''; } catch(e){ return ''; } })();

function setBuyerWard(ward) {
  BUYER_WARD = ward || '';
  try { localStorage.setItem('sp_buyer_ward', BUYER_WARD); } catch(e){}
  document.querySelectorAll('.buyer-ward-sel').forEach(function(sel){ sel.value = BUYER_WARD; });
  updateNearMeBanner();
  renderNearbyFarmers();
  renderFarmersPage();
}

function populateWardOptions() {
  var sels = document.querySelectorAll('.buyer-ward-sel');
  if (!sels.length) return;

  var inCounty = NEARBY_FARMERS.filter(function(f){
    return !BUYER_LOCATION || (f.location||'').toLowerCase() === BUYER_LOCATION.toLowerCase();
  });
  var wards = [];
  inCounty.forEach(function(f){
    if (f.ward && wards.indexOf(f.ward) === -1) wards.push(f.ward);
  });

  // The selected ward may not belong to the newly-selected county anymore.
  if (BUYER_WARD && wards.indexOf(BUYER_WARD) === -1) { BUYER_WARD = ''; try { localStorage.setItem('sp_buyer_ward', ''); } catch(e){} }

  var optionsHTML = '<option value="">' + (wards.length ? 'Any ward' : 'No wards on file yet') + '</option>' +
    wards.map(function(w){ return '<option>' + w + '</option>'; }).join('');
  sels.forEach(function(sel){ sel.innerHTML = optionsHTML; sel.value = BUYER_WARD; sel.disabled = !wards.length; });
}

function updateNearMeBanner() {
  document.querySelectorAll('.near-me-banner').forEach(function(banner){
    var text = banner.querySelector('.near-me-text');
    if (BUYER_LOCATION) {
      var place = BUYER_WARD ? (BUYER_WARD + ', ' + BUYER_LOCATION) : BUYER_LOCATION;
      if (text) text.textContent = '📍 Showing farmers near ' + place + ' first';
      banner.style.display = 'flex';
    } else {
      banner.style.display = 'none';
    }
  });
}

/* ── "Farmer Next Door" — real verified farmers (market.nearbyFarmers),
   not the 5 hardcoded demo cards this used to be. Reuses BUYER_LOCATION
   from the near-me picker above so the same "near you" choice affects
   both listings and farmers. ── */
var NEARBY_FARMERS = [];

function loadNearbyFarmers() {
  return fetch('/api/trpc/market.nearbyFarmers')
    .then(function(r){ return r.json(); })
    .then(function(d) {
      NEARBY_FARMERS = (d && d.result && d.result.data && d.result.data.json) || [];
    })
    .catch(function(err){ console.error('Failed to load nearby farmers', err); NEARBY_FARMERS = []; })
    .then(function(){
      populateWardOptions();
      renderNearbyFarmers();
      renderFarmersPage();
    });
}

/* Ranks a ward match above a county-only match above no match at all —
   sort, not filter, since most farmers won't have a ward on file yet and
   a strict filter would too easily show an empty page. */
function farmerLocationRank(f) {
  if (BUYER_WARD && (f.ward||'').toLowerCase() === BUYER_WARD.toLowerCase()) return 0;
  if (BUYER_LOCATION && (f.location||'').toLowerCase() === BUYER_LOCATION.toLowerCase()) return 1;
  return 2;
}

function sortedNearbyFarmers() {
  var list = NEARBY_FARMERS.slice();
  if (!BUYER_LOCATION && !BUYER_WARD) return list;
  return list
    .map(function(f, i){ return { f: f, i: i }; })
    .sort(function(a, b){
      var an = farmerLocationRank(a.f), bn = farmerLocationRank(b.f);
      return an !== bn ? an - bn : a.i - b.i;
    })
    .map(function(x){ return x.f; });
}

function farmerCardHTML(f) {
  var rank = farmerLocationRank(f);
  var wardMatch = rank === 0;
  var countyMatch = rank === 1;
  var rating = f.rating || 0;
  var fullStars = Math.round(rating);
  var stars = '★'.repeat(fullStars) + '☆'.repeat(Math.max(0, 5 - fullStars));
  var nameEsc = (f.name || 'Farmer').replace(/'/g, "\\'");
  var placeText = f.ward ? (f.ward + ', ' + (f.location || 'Kenya')) : (f.location || 'Kenya');
  return '<div class="farmer-card" onclick="showFarmerShop(' + f.id + ')">' +
    '<div class="farmer-av">' + (f.avatar ? '<img class="farmer-photo" src="' + f.avatar + '" alt="" loading="lazy" onerror="this.remove()">' : '<span class="fa-emoji">🧑‍🌾</span>') + '</div>' +
    '<div class="farmer-name">' + (f.name || 'Farmer') + '<span class="verified-badge-inline" title="Verified Seller">' + VERIFIED_BADGE_SVG + '</span></div>' +
    (wardMatch ? '<div class="near-me-tag" style="display:inline-block;margin:2px 0 3px">Same ward</div>' : countyMatch ? '<div class="near-me-tag" style="display:inline-block;margin:2px 0 3px">Near you</div>' : '') +
    '<div class="farmer-loc">📍 ' + placeText + '</div>' +
    '<div class="farmer-stars">' + stars + ' ' + rating.toFixed(1) + '</div>' +
    '<div class="farmer-count">' + f.listingCount + ' Listing' + (f.listingCount === 1 ? '' : 's') + '</div>' +
    '<button class="farmer-card-wa" onclick="event.stopPropagation();contactFarmer(\'' + (f.phone || '') + '\',\'' + nameEsc + '\')">💬 Message</button>' +
  '</div>';
}

function renderNearbyFarmers() {
  var el = document.getElementById('nearbyFarmersRow');
  if (!el) return;
  var list = sortedNearbyFarmers();
  el.innerHTML = list.length
    ? list.slice(0, 8).map(farmerCardHTML).join('')
    : '<p style="padding:12px 4px;color:var(--grey-text);font-size:12.5px">No verified farmers yet — check back soon.</p>';
}

/* Premium-tier verified farmers (admin-granted — same `premium` flag
   already used for listing sort priority elsewhere) get a distinct
   gradient carousel, echoing Shamba Direct's "Featured Farm
   Advertisements" reserved for farmers who'd hit the 5-sale milestone. */
function featuredFarmerCardHTML(f) {
  var placeText = f.ward ? (f.ward + ', ' + (f.location || 'Kenya')) : (f.location || 'Kenya');
  return '<div class="featured-farmer-card" onclick="showFarmerShop(' + f.id + ')">' +
    '<div class="ff-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/></svg>Featured Farm</div>' +
    '<div class="ff-name">' + (f.name || 'Farmer') + '<span class="verified-badge-inline" title="Verified Seller">' + VERIFIED_BADGE_SVG + '</span></div>' +
    '<div class="ff-loc">📍 ' + placeText + '</div>' +
    '<div class="ff-stats">' +
      '<div class="ff-stat"><b>' + f.listingCount + '</b>Listings</div>' +
      '<div class="ff-stat"><b>★ ' + (f.rating || 0).toFixed(1) + '</b>' + f.reviewCount + ' reviews</div>' +
    '</div>' +
  '</div>';
}

/* Full, uncapped version for the dedicated Farmer Next Door page (as
   opposed to the 8-card homepage teaser row above). */
function renderFarmersPage() {
  var el = document.getElementById('farmersGrid');
  var featuredWrap = document.getElementById('featuredFarmersWrap');
  var featuredRow = document.getElementById('featuredFarmersRow');
  if (!el) return;
  var list = sortedNearbyFarmers();
  var count = document.getElementById('farmersCount');
  if (count) count.textContent = NEARBY_FARMERS.length ? (list.length + ' verified farmer' + (list.length !== 1 ? 's' : '')) : 'Loading…';

  if (featuredWrap && featuredRow) {
    var featured = list.filter(function(f){ return f.premium; });
    if (featured.length) {
      featuredRow.innerHTML = featured.map(featuredFarmerCardHTML).join('');
      featuredWrap.style.display = '';
    } else {
      featuredWrap.style.display = 'none';
    }
  }

  el.innerHTML = list.length
    ? list.map(farmerCardHTML).join('')
    : '<p style="grid-column:1/-1;text-align:center;padding:24px;color:var(--grey-text)">No verified farmers yet — check back soon.</p>';
}

function contactFarmer(phone, name) {
  if (!phone) { showToast('📵 No contact number on file for ' + name); return; }
  var digits = phone.replace(/[^\d]/g, '');
  window.open('https://wa.me/' + digits, '_blank', 'noopener');
}

/* ── FARMER SHOP (a farmer's own storefront — their profile + everything
   they currently have listed) ── */
function renderFarmerShopHeader(f) {
  var avatarEl = document.getElementById('fsAvatar');
  if (avatarEl) avatarEl.innerHTML = f.avatar
    ? '<img class="farmer-photo" src="' + f.avatar + '" alt="" loading="lazy" onerror="this.remove()">'
    : '<span class="fa-emoji">🧑‍🌾</span>';

  var nameEl = document.getElementById('fsName');
  if (nameEl) nameEl.textContent = f.name || 'Farmer';

  var badgesEl = document.getElementById('fsBadges');
  if (badgesEl) {
    var badges = '';
    if (f.verified) badges += '<span class="verified-badge-inline" title="Verified Seller">' + VERIFIED_BADGE_SVG + '</span>';
    if (f.premium) badges += '<span class="fs-premium-tag">⭐ Premium Seller</span>';
    badgesEl.innerHTML = badges;
  }

  var metaEl = document.getElementById('fsMeta');
  if (metaEl) {
    var placeText = f.ward ? (f.ward + ', ' + (f.location || 'Kenya')) : (f.location || 'Kenya');
    var rating = f.rating || 0;
    metaEl.innerHTML =
      '<span>📍 ' + placeText + '</span>' +
      '<span>★ ' + rating.toFixed(1) + ' (' + f.reviewCount + ' review' + (f.reviewCount === 1 ? '' : 's') + ')</span>' +
      '<span>' + f.listings.length + ' listing' + (f.listings.length === 1 ? '' : 's') + '</span>';
  }

  var waBtn = document.getElementById('fsWaBtn');
  if (waBtn) {
    waBtn.style.display = '';
    waBtn.onclick = function() { contactFarmer(f.phone, f.name || 'this farmer'); };
  }
}

function renderFarmerShop(farmerId) {
  var grid = document.getElementById('farmerShopGrid');
  if (grid) grid.innerHTML = loadingHTML();

  fetch('/api/trpc/market.farmerProfile?input=' + encodeURIComponent(JSON.stringify({ json: { farmerId: farmerId } })))
    .then(function(r){ return r.json(); })
    .then(function(data) {
      var f = data && data.result && data.result.data && data.result.data.json;
      if (!f) {
        document.getElementById('fsName').textContent = 'Farmer not found';
        document.getElementById('fsMeta').innerHTML = '';
        document.getElementById('fsBadges').innerHTML = '';
        var waBtn = document.getElementById('fsWaBtn'); if (waBtn) waBtn.style.display = 'none';
        if (grid) grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:24px;color:var(--grey-text)">This farmer couldn\'t be found.</p>';
        return;
      }
      renderFarmerShopHeader(f);
      var titleEl = document.getElementById('fsListingsTitle');
      var products = f.listings.map(mapListing);
      if (titleEl) titleEl.textContent = '🌾 Listings (' + products.length + ')';
      if (grid) {
        grid.innerHTML = products.length
          ? products.map(cardHTML).join('')
          : '<p style="grid-column:1/-1;text-align:center;padding:24px;color:var(--grey-text)">No active listings right now — check back soon.</p>';
      }
    })
    .catch(function() {
      if (grid) grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:24px;color:var(--grey-text)">Couldn\'t load this shop. Try again shortly.</p>';
    });
}

/* ── CART (localStorage-backed) ── */
var cart = (function(){
  try { return JSON.parse(localStorage.getItem('sp_cart')||'[]'); } catch(e){ return []; }
})();
var activeCat = 'all', searchQ = '';

function saveCart() {
  try { localStorage.setItem('sp_cart', JSON.stringify(cart)); } catch(e){}
}

/* Green "verified seller" seal (Instagram/Twitter scalloped-badge style) —
   dropped into a .prod-check or .verified-badge-inline wrapper wherever a
   farmer has earned it via real completed sales (see
   VERIFIED_SELLER_ORDER_THRESHOLD server-side). The 16-point outline is a
   computed polygon (8 outer/8 inner vertices, alternating r=10.5/9.0 from
   center 12,12), not a hand-drawn curve — exact trig, not eyeballed. */
var VERIFIED_BADGE_SVG = '<svg viewBox="0 0 24 24"><defs><linearGradient id="vbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#4AF0A0"/><stop offset="100%" stop-color="#16A863"/></linearGradient></defs><polygon points="12,1.5 15.44,3.69 19.42,4.58 20.32,8.56 22.5,12 20.32,15.44 19.42,19.42 15.44,20.32 12,22.5 8.56,20.32 4.58,19.42 3.69,15.44 1.5,12 3.69,8.56 4.58,4.58 8.56,3.69" fill="url(#vbg)"/><path d="M5 13l5 5L19 7" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* ── CARD HTML ── */
function cardHTML(p) {
  var inCart = cart.find(function(c){return c.id===p.id;});
  return '<div class="prod-card">' +
    '<div class="prod-img">' +
      '<span class="prod-emoji">' + p.emoji + '</span>' +
      (p.img ? '<img class="prod-photo" src="' + p.img + '" alt="' + p.name + '" loading="lazy" onerror="this.remove()">' : '') +
      (p.disc ? '<div class="prod-discount">' + p.disc + '</div>' : '') +
      (p.ok   ? '<div class="prod-check">' + VERIFIED_BADGE_SVG + '</div>' : '') +
      (p.hasPhoto ? '<div class="prod-photo-badge" title="Real photo from farmer">📸 Verified</div>' : '') +
      '<button class="prod-fav" onclick="event.stopPropagation();showToast(\'❤️ Saved!\')">♡</button>' +
    '</div>' +
    '<div class="prod-body">' +
      '<div class="prod-name">' + p.name + (p.premium ? ' <span class="prod-premium-badge" title="Premium seller">⭐</span>' : '') + '</div>' +
      (p.farmerId ? '<div class="prod-farmer" onclick="event.stopPropagation();showFarmerShop(' + p.farmerId + ')">🧑‍🌾 ' + p.farmer + '</div>' : '') +
      '<div class="prod-meta">📍 ' + p.county +
        (BUYER_LOCATION && (p.county||'').toLowerCase() === BUYER_LOCATION.toLowerCase() ? ' <span class="near-me-tag">Near you</span>' : '') +
        ' · <span class="prod-rating">★ ' + p.rating + '</span></div>' +
      '<div class="prod-price-row">' +
        '<div class="prod-price">KSh ' + p.price + '</div>' +
        '<div class="prod-unit">/' + p.unit + '</div>' +
        (p.old ? '<div class="prod-old">KSh ' + p.old + '</div>' : '') +
      '</div>' +
      '<div class="prod-actions">' +
        '<button class="prod-add' + (inCart ? ' added' : '') + '" onclick="addToCart(event,' + p.id + ')">' +
          (inCart ? '✓ Added' : '+ Cart') +
        '</button>' +
        '<button class="prod-wa" onclick="event.stopPropagation();openWA(\'' + p.name + '\')">💬</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function filtered() {
  return PRODUCTS.filter(function(p){
    return (activeCat==='all'||p.cat===activeCat) &&
           (!searchQ||p.name.toLowerCase().includes(searchQ.toLowerCase())||p.county.toLowerCase().includes(searchQ.toLowerCase()));
  });
}

function renderHomeGrid() {
  var el = document.getElementById('homeGrid'); if (!el) return;
  if (!productsLoaded) { el.innerHTML = loadingHTML(); return; }
  el.innerHTML = PRODUCTS.length ? PRODUCTS.slice(0,6).map(cardHTML).join('') :
    '<p style="grid-column:span 3;text-align:center;padding:24px;color:var(--grey-text)">No listings yet — be the first to sell!</p>';
}

function renderShopGrid() {
  var el = document.getElementById('shopGrid'); if (!el) return;
  if (!productsLoaded) {
    el.innerHTML = loadingHTML();
    var lc = document.getElementById('prodCount'); if (lc) lc.textContent = 'Loading…';
    return;
  }
  var f = filtered();
  el.innerHTML = f.length ? f.map(cardHTML).join('') :
    '<p style="grid-column:span 2;text-align:center;padding:24px;color:var(--grey-text)">No products found</p>';
  var c = document.getElementById('prodCount');
  if (c) c.textContent = f.length + ' product' + (f.length!==1?'s':'');
}

function loadingHTML() {
  return '<p style="grid-column:span 2;text-align:center;padding:24px;color:var(--grey-text)">🌾 Loading fresh produce…</p>';
}

/* ── CART ACTIONS ── */
function addToCart(e, id) {
  e.stopPropagation();
  var p = PRODUCTS.find(function(x){return x.id===id;});
  var ex = cart.find(function(c){return c.id===id;});
  if (ex) ex.qty++; else cart.push({id:p.id,name:p.name,emoji:p.emoji,price:p.price,unit:p.unit,qty:1});
  saveCart(); updateCart(); renderHomeGrid(); renderShopGrid();
  showToast('✓ ' + p.name + ' added to cart');
}

function quickAdd(id) { addToCart({stopPropagation:function(){}}, id); }

function changeQty(id, d) {
  var item = cart.find(function(c){return c.id===id;}); if (!item) return;
  item.qty += d;
  if (item.qty <= 0) cart = cart.filter(function(c){return c.id!==id;});
  saveCart(); updateCart(); renderHomeGrid(); renderShopGrid();
}

function removeItem(id) {
  cart = cart.filter(function(c){return c.id!==id;});
  saveCart(); updateCart(); renderHomeGrid(); renderShopGrid();
}

function updateCart() {
  var count = cart.reduce(function(s,c){return s+c.qty;},0);
  var total = cart.reduce(function(s,c){return s+c.price*c.qty;},0);
  var badge = document.getElementById('cartBadge');
  var totEl = document.getElementById('cartTotal');
  if (badge) badge.textContent = count;
  if (totEl) totEl.textContent = 'KSh ' + total.toLocaleString();
  var body = document.getElementById('cartBody');
  if (!body) return;
  if (!cart.length) { body.innerHTML = '<div class="cart-empty"><span>🌿</span><p>Your cart is empty</p></div>'; return; }
  body.innerHTML = cart.map(function(c){
    return '<div class="cart-item">' +
      '<div class="cart-item-img">' + c.emoji + '</div>' +
      '<div class="cart-item-info">' +
        '<div class="cart-item-name">' + c.name + '</div>' +
        '<div class="cart-item-price">KSh ' + (c.price*c.qty).toLocaleString() + '</div>' +
        '<div class="qty-row">' +
          '<button class="qty-btn" onclick="changeQty(' + c.id + ',-1)">−</button>' +
          '<span class="qty-val">' + c.qty + '</span>' +
          '<button class="qty-btn" onclick="changeQty(' + c.id + ',1)">+</button>' +
          '<button class="cart-rm" onclick="removeItem(' + c.id + ')">Remove</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

/* ── FILTERS / SORT ── */
function setCat(cat, el) {
  activeCat = cat;
  document.querySelectorAll('.cat-card').forEach(function(c){c.classList.remove('active');});
  el.classList.add('active');
  renderShopGrid();
}

function filterProds() {
  searchQ = (document.getElementById('shopSearch')||{}).value || '';
  renderShopGrid();
}

function sortProds(v) {
  if (v==='price-asc')  PRODUCTS.sort(function(a,b){return a.price-b.price;});
  if (v==='price-desc') PRODUCTS.sort(function(a,b){return b.price-a.price;});
  if (v==='rating')     PRODUCTS.sort(function(a,b){return b.rating-a.rating;});
  if (v==='default')    PRODUCTS.sort(function(a,b){return b.id-a.id;});
  renderShopGrid();
}

function shopCat(cat) { activeCat = cat; window.location.href = 'shop.html'; }

/* ── NAV / UI ── */
function handleSearch() {
  var q = (document.getElementById('globalSearch')||{}).value||'';
  if (!q.trim()) return;
  // If already on shop page, filter inline
  var shopInput = document.getElementById('shopSearch');
  if (shopInput) {
    shopInput.value = q;
    searchQ = q;
    renderShopGrid();
    shopInput.scrollIntoView({behavior:'smooth', block:'center'});
  } else {
    window.location.href = 'shop.html?q=' + encodeURIComponent(q);
  }
}

function toggleCart() {
  document.getElementById('cartOverlay').classList.toggle('open');
  document.getElementById('cartDrawer').classList.toggle('open');
}

function checkout() {
  if (!cart.length) { showToast('🛒 Your cart is empty'); return; }
  if (!CURRENT_USER) {
    showToast('👤 Please sign in to complete checkout');
    enterApp();
    return;
  }
  toggleCart();
  openPaymentModal();
}

/* Turns the current cart into real `orders` records (one per line item) so
   a purchase actually shows up in My Orders / Farmer Next Door's flow —
   used by all three payment methods right before they charge the buyer. */
function createOrdersFromCart() {
  return fetch('/api/trpc/market.createOrders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ json: { items: cart.map(function(c){ return { listingId: c.id, quantity: c.qty }; }) } })
  })
  .then(function(r){ return r.json(); })
  .then(function(data) {
    if (data.error) throw new Error(data.error.message || 'Could not create your order');
    return data.result.data.json.orderIds;
  });
}

/* ── PAYMENT MODAL (choose method, then per-method detail) ── */
var PAY_TOTAL = 0;

function openPaymentModal() {
  PAY_TOTAL = cart.reduce(function(s,c){return s+c.price*c.qty;},0);
  var existing = document.getElementById('mpesaModal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'mpesaModal';
  modal.innerHTML = [
    '<div class="mpesa-overlay" onclick="closeMpesa()"></div>',
    '<div class="mpesa-sheet">',
      '<button class="auth-close" onclick="closeMpesa()">✕</button>',
      '<h2 class="auth-title">Choose Payment Method</h2>',
      '<div class="mpesa-amount">KSh <strong>' + PAY_TOTAL.toLocaleString() + '</strong></div>',
      '<div class="mpesa-items">' + cart.map(function(c){ return '<span>' + c.emoji + ' ' + c.name + ' ×' + c.qty + '</span>'; }).join('') + '</div>',
      '<div id="payMethods">',
        '<button class="pay-method-btn" onclick="selectPayMethod(\'mpesa\')"><img class="mpesa-icon" src="/images/mpesa-logo.png" alt="M-Pesa"><span>M-Pesa</span></button>',
        '<button class="pay-method-btn" onclick="selectPayMethod(\'paypal\')"><img class="pay-logo-icon" src="/images/paypal-logo.png" alt="PayPal"><span>PayPal</span></button>',
        '<button class="pay-method-btn" onclick="selectPayMethod(\'pesapal\')"><img class="pay-logo-icon pesapal" src="/images/pesapal-logo.png" alt="Pesapal"><span>Pesapal</span></button>',
      '</div>',
      '<div id="payDetail"></div>',
    '</div>'
  ].join('');
  document.body.appendChild(modal);
  requestAnimationFrame(function(){ modal.classList.add('open'); });
}

function closeMpesa() {
  var m = document.getElementById('mpesaModal');
  if (m) m.remove();
}

function backToMethods() {
  var methods = document.getElementById('payMethods');
  var detail = document.getElementById('payDetail');
  if (methods) methods.style.display = '';
  if (detail) detail.innerHTML = '';
}

function selectPayMethod(method) {
  document.getElementById('payMethods').style.display = 'none';
  var detail = document.getElementById('payDetail');
  var knownPhone = (CURRENT_USER && CURRENT_USER.phone) ? CURRENT_USER.phone : '';
  if (method === 'mpesa') {
    detail.innerHTML = [
      '<div class="auth-field" style="margin-top:4px"><label>M-Pesa Phone Number</label>',
        '<input type="tel" id="mpesaPhone" placeholder="e.g. 0712 345 678" value="' + knownPhone + '" />',
      '</div>',
      '<button class="auth-submit mpesa-pay-btn" onclick="initiateMpesa(' + PAY_TOTAL + ')">📲 Send M-Pesa Request</button>',
      '<p class="pay-back-link" onclick="backToMethods()">↩ Choose a different method</p>',
      '<p style="text-align:center;font-size:11px;color:var(--grey-text);margin-top:10px">Powered by Safaricom Daraja · Secure · Instant</p>',
      '<div id="mpesaStatus" style="display:none"></div>',
    ].join('');
  } else if (method === 'paypal') {
    detail.innerHTML = [
      '<p class="auth-sub" style="margin-top:4px">You\'ll be redirected to PayPal to complete payment in USD.</p>',
      '<button class="auth-submit" id="paypalBtn" onclick="initiatePaypal()">Continue to PayPal →</button>',
      '<p class="pay-back-link" onclick="backToMethods()">↩ Choose a different method</p>',
    ].join('');
  } else if (method === 'pesapal') {
    detail.innerHTML = [
      '<div class="auth-field" style="margin-top:4px"><label>Phone Number</label><input type="tel" id="pesapalPhone" placeholder="e.g. 0712 345 678" value="' + knownPhone + '" /></div>',
      '<div class="auth-field"><label>Email (optional)</label><input type="email" id="pesapalEmail" placeholder="you@example.com" /></div>',
      '<button class="auth-submit" id="pesapalBtn" onclick="initiatePesapal()">Continue to Pesapal →</button>',
      '<p class="pay-back-link" onclick="backToMethods()">↩ Choose a different method</p>',
      '<p style="text-align:center;font-size:11px;color:var(--grey-text);margin-top:10px">Accepts M-Pesa, Airtel Money &amp; cards</p>',
    ].join('');
  }
}

function initiatePaypal() {
  var btn = document.getElementById('paypalBtn');
  btn.textContent = '⏳ Creating order…'; btn.disabled = true;
  createOrdersFromCart()
  .then(function(orderIds) {
    return fetch('/api/trpc/paypal.createOrder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: { amountKes: PAY_TOTAL, orderIds: orderIds } })
    });
  })
  .then(function(r){ return r.json(); })
  .then(function(data) {
    if (data.error) throw new Error(data.error.message || 'Could not start PayPal checkout');
    window.location.href = data.result.data.json.approveUrl;
  })
  .catch(function(err) {
    btn.textContent = 'Continue to PayPal →'; btn.disabled = false;
    showToast('❌ ' + (err.message || 'Could not start PayPal checkout'));
  });
}

function initiatePesapal() {
  var phone = (document.getElementById('pesapalPhone')||{}).value || '';
  var email = (document.getElementById('pesapalEmail')||{}).value || '';
  if (!phone.trim() && !email.trim()) { showToast('⚠️ Please enter your phone number or email'); return; }
  var btn = document.getElementById('pesapalBtn');
  btn.textContent = '⏳ Creating order…'; btn.disabled = true;
  createOrdersFromCart()
  .then(function(orderIds) {
    return fetch('/api/trpc/pesapal.submitOrder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: { amount: PAY_TOTAL, orderIds: orderIds, phone: phone.trim() || undefined, email: email.trim() || undefined } })
    });
  })
  .then(function(r){ return r.json(); })
  .then(function(data) {
    if (data.error) throw new Error(data.error.message || 'Could not start Pesapal checkout');
    window.location.href = data.result.data.json.redirectUrl;
  })
  .catch(function(err) {
    btn.textContent = 'Continue to Pesapal →'; btn.disabled = false;
    showToast('❌ ' + (err.message || 'Could not start Pesapal checkout'));
  });
}

/* ── Handle redirect back from PayPal / Pesapal (full page redirect) ── */
function handlePaymentRedirect() {
  var params = new URLSearchParams(location.search);
  var pay = params.get('pay');
  if (!pay) return;
  var provider = params.get('provider') || 'payment';
  var label = provider === 'paypal' ? 'PayPal' : provider === 'pesapal' ? 'Pesapal' : provider;
  if (pay === 'success') {
    cart = []; saveCart(); updateCart(); renderHomeGrid(); renderShopGrid();
    showToast('✅ Payment received via ' + label + '! Order confirmed.');
  } else if (pay === 'cancelled') {
    showToast('🚫 ' + label + ' payment cancelled.');
  } else if (pay === 'pending') {
    showToast('⏳ ' + label + ' payment is still processing — we\'ll confirm once it clears.');
  } else if (pay === 'failed') {
    showToast('❌ ' + label + ' payment failed. Please try again.');
  } else {
    showToast('❌ Something went wrong. Contact support if you were charged.');
  }
  history.replaceState(null, '', location.pathname + location.hash);
}

function initiateMpesa(amount) {
  var phone = (document.getElementById('mpesaPhone')||{}).value||'';
  if (!phone.trim()) { showToast('⚠️ Please enter your M-Pesa phone number'); return; }

  var btn = document.querySelector('.mpesa-pay-btn');
  btn.textContent = '⏳ Sending request…';
  btn.disabled = true;

  var statusEl = document.getElementById('mpesaStatus');
  statusEl.style.display = 'block';
  statusEl.className = 'mpesa-status pending';
  statusEl.innerHTML = '📲 <strong>Check your phone</strong><br>Enter your M-Pesa PIN when prompted.';

  // Create the real order records first, then request the STK push
  createOrdersFromCart()
  .then(function(orderIds) {
    return fetch('/api/trpc/mpesa.stkPush', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        json: {
          phone:       phone,
          amount:      amount,
          orderIds:    orderIds,
          accountRef:  'Shamba Sokoni',
          description: 'Farm Produce'
        }
      })
    });
  })
  .then(function(r){ return r.json(); })
  .then(function(data) {
    if (data.error) throw new Error(data.error.message || 'STK Push failed');
    var result = data.result && data.result.data ? data.result.data : data.result;
    var checkoutId = result.checkoutRequestId;
    showToast('📲 M-Pesa prompt sent! Check your phone.');
    pollMpesaStatus(checkoutId, 0);
  })
  .catch(function(err) {
    btn.textContent = '📲 Send M-Pesa Request';
    btn.disabled = false;
    statusEl.className = 'mpesa-status failed';
    statusEl.innerHTML = '❌ <strong>Request failed:</strong> ' + (err.message || 'Please try again.');
    console.error('M-Pesa error:', err);
  });
}

function pollMpesaStatus(checkoutId, attempts) {
  if (attempts > 12) { // poll for max ~60 seconds
    var statusEl = document.getElementById('mpesaStatus');
    if (statusEl) {
      statusEl.className = 'mpesa-status failed';
      statusEl.innerHTML = '⏱ <strong>Timed out.</strong> Check your phone and try again.';
    }
    return;
  }
  setTimeout(function() {
    fetch('/api/trpc/mpesa.checkStatus?batch=1&input=' + encodeURIComponent(JSON.stringify({0:{json:{checkoutRequestId:checkoutId}}})))
    .then(function(r){ return r.json(); })
    .then(function(data) {
      var result = Array.isArray(data) ? data[0] : data;
      var status = result && result.result && result.result.data ? result.result.data.status : (result && result.result ? result.result.status : 'pending');
      var statusEl = document.getElementById('mpesaStatus');
      if (!statusEl) return;

      if (status === 'completed') {
        statusEl.className = 'mpesa-status completed';
        statusEl.innerHTML = '✅ <strong>Payment confirmed!</strong><br>Your order has been placed. Thank you!';
        cart = []; saveCart(); updateCart(); renderHomeGrid(); renderShopGrid();
        showToast('✅ Payment received! Order confirmed.');
        setTimeout(closeMpesa, 3000);
      } else if (status === 'failed') {
        statusEl.className = 'mpesa-status failed';
        statusEl.innerHTML = '❌ <strong>Payment failed.</strong> Please try again.';
        var btn = document.querySelector('.mpesa-pay-btn');
        if (btn) { btn.textContent = '📲 Send M-Pesa Request'; btn.disabled = false; }
      } else if (status === 'cancelled') {
        statusEl.className = 'mpesa-status failed';
        statusEl.innerHTML = '🚫 <strong>Cancelled.</strong> You cancelled the M-Pesa prompt.';
        var btn = document.querySelector('.mpesa-pay-btn');
        if (btn) { btn.textContent = '📲 Send M-Pesa Request'; btn.disabled = false; }
      } else {
        pollMpesaStatus(checkoutId, attempts + 1);
      }
    })
    .catch(function(){ pollMpesaStatus(checkoutId, attempts + 1); });
  }, 5000);
}

/* ── SIGN-IN MODAL (phone + WhatsApp OTP — matches the identity model the
   WhatsApp bot and Sell form already use, no separate password to manage) ── */
var CURRENT_USER = null;
var _authPhone = '';

/* Shared 3D-style icon markup for the auth buttons — kept as constants so
   requestOtpCode()/verifyOtpCode() can restore the icon (not just plain
   text) when they reset button content after a request finishes. */
var WHATSAPP_BTN_HTML = '<svg class="auth-submit-icon" viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6 2 11c0 2 .8 3.8 2.1 5.3L3 21l5-1.3C9.2 20.2 10.6 20.5 12 20.5c5.5 0 10-4 10-9.5S17.5 2 12 2z" fill="rgba(255,255,255,.95)"/></svg>Send Code via WhatsApp';
var VERIFY_BTN_HTML = '<svg class="auth-submit-icon" viewBox="0 0 24 24"><path d="M12 2l7 3v6c0 5-3 8.5-7 11-4-2.5-7-6-7-11V5l7-3z" fill="rgba(255,255,255,.95)"/><path d="M8.5 12.5l2.3 2.3 4.7-5" stroke="#4A6B4D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>Verify &amp; Continue';

function enterApp() {
  var existing = document.getElementById('authModal');
  if (existing) { existing.classList.add('open'); return; }

  var modal = document.createElement('div');
  modal.id = 'authModal';
  modal.innerHTML = [
    '<div class="auth-overlay" onclick="closeAuth()"></div>',
    '<div class="auth-sheet">',
      '<button class="auth-close" onclick="closeAuth()">✕</button>',
      '<div class="auth-logo"><svg viewBox="0 0 24 24">' +
        '<path d="M12 21v-8" stroke="rgba(255,255,255,.95)" stroke-width="2.2" stroke-linecap="round" fill="none"/>' +
        '<path d="M12 13c0-4.5-3.5-7-8-7 0 4.5 3.5 7 8 7z" fill="rgba(255,255,255,.95)"/>' +
        '<path d="M12 13c0-4.5 3.5-7 8-7 0 4.5-3.5 7-8 7z" fill="rgba(255,255,255,.75)"/>' +
      '</svg></div>',
      '<h2 class="auth-title">Welcome to Shamba Sokoni</h2>',
      '<p class="auth-sub">Kenya\'s #1 Farm Marketplace</p>',
      /* STEP 1: phone */
      '<div id="auth-step-phone">',
        '<div class="auth-field"><label>Phone Number</label><input type="tel" id="authPhone" placeholder="e.g. 0712 345 678" /></div>',
        '<button class="auth-submit" id="authSendBtn" onclick="requestOtpCode(\'whatsapp\')">' + WHATSAPP_BTN_HTML + '</button>',
        '<div class="auth-forgot" id="authSmsLink" onclick="requestOtpCode(\'sms\')">No smartphone or WhatsApp? <u>Send code via SMS instead</u></div>',
      '</div>',
      /* STEP 2: code */
      '<div id="auth-step-code" style="display:none">',
        '<p class="auth-sub" id="authCodeSentTo"></p>',
        '<div class="auth-field"><label>Your Name <span style="font-weight:400">(first time only)</span></label><input type="text" id="authName" placeholder="e.g. James Mwangi" /></div>',
        '<div class="auth-field"><label>6-Digit Code</label><input type="text" inputmode="numeric" maxlength="6" id="authCode" placeholder="123456" /></div>',
        '<button class="auth-submit" id="authVerifyBtn" onclick="verifyOtpCode()">' + VERIFY_BTN_HTML + '</button>',
        '<div class="auth-forgot" onclick="backToPhoneStep()">↩ Use a different number</div>',
      '</div>',
    '</div>'
  ].join('');
  document.body.appendChild(modal);
  requestAnimationFrame(function(){ modal.classList.add('open'); });
}

function closeAuth() {
  var m = document.getElementById('authModal');
  if (m) m.classList.remove('open');
}

function backToPhoneStep() {
  document.getElementById('auth-step-code').style.display = 'none';
  document.getElementById('auth-step-phone').style.display = '';
}

function requestOtpCode(channel) {
  channel = channel === 'sms' ? 'sms' : 'whatsapp';
  var phone = (document.getElementById('authPhone')||{}).value || '';
  if (!phone.trim()) { showToast('⚠️ Please enter your phone number'); return; }
  var btn = document.getElementById('authSendBtn');
  var smsLink = document.getElementById('authSmsLink');
  var sendingText = channel === 'sms' ? '⏳ Sending SMS…' : '⏳ Sending…';
  btn.textContent = sendingText; btn.disabled = true;
  if (smsLink) smsLink.style.pointerEvents = 'none';
  fetch('/api/trpc/auth.requestOtp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ json: { phone: phone, channel: channel } })
  })
  .then(function(r){ return r.json(); })
  .then(function(data) {
    btn.innerHTML = WHATSAPP_BTN_HTML; btn.disabled = false;
    if (smsLink) smsLink.style.pointerEvents = '';
    if (data.error) throw new Error(data.error.message || 'Could not send code');
    _authPhone = phone;
    document.getElementById('auth-step-phone').style.display = 'none';
    document.getElementById('auth-step-code').style.display = '';
    document.getElementById('authCodeSentTo').textContent = 'Code sent to ' + phone + (channel === 'sms' ? ' via SMS' : ' via WhatsApp');
    showToast(channel === 'sms' ? '💬 Check your SMS inbox for your code' : '📲 Check WhatsApp for your code');
  })
  .catch(function(err) {
    btn.innerHTML = WHATSAPP_BTN_HTML; btn.disabled = false;
    if (smsLink) smsLink.style.pointerEvents = '';
    showToast('❌ ' + (err.message || 'Could not send code'));
  });
}

function verifyOtpCode() {
  var code = (document.getElementById('authCode')||{}).value || '';
  var name = (document.getElementById('authName')||{}).value || '';
  if (!code.trim()) { showToast('⚠️ Please enter the code'); return; }
  var btn = document.getElementById('authVerifyBtn');
  btn.textContent = '⏳ Verifying…'; btn.disabled = true;
  fetch('/api/trpc/auth.verifyOtp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ json: { phone: _authPhone, code: code, name: name || undefined } })
  })
  .then(function(r){ return r.json(); })
  .then(function(data) {
    btn.innerHTML = VERIFY_BTN_HTML; btn.disabled = false;
    if (data.error) throw new Error(data.error.message || 'Invalid code');
    closeAuth();
    checkAuthState();
    showToast('✅ Welcome to Shamba Sokoni!');
  })
  .catch(function(err) {
    btn.innerHTML = VERIFY_BTN_HTML; btn.disabled = false;
    showToast('❌ ' + (err.message || 'Invalid code'));
  });
}

function checkAuthState() {
  return fetch('/api/trpc/auth.me')
    .then(function(r){ return r.json(); })
    .then(function(d) {
      CURRENT_USER = (d && d.result && d.result.data && d.result.data.json) || null;
      renderAuthState();
      var chatPage = document.getElementById('page-chat');
      if (chatPage && chatPage.classList.contains('active') && typeof loadChatMessages === 'function') loadChatMessages();
      var ordersPage = document.getElementById('page-orders');
      if (ordersPage && ordersPage.classList.contains('active') && typeof renderOrdersPage === 'function') renderOrdersPage();
    })
    .catch(function() { CURRENT_USER = null; renderAuthState(); });
}

function renderAuthState() {
  var btn = document.getElementById('signInBtn');
  if (!btn) return;
  if (CURRENT_USER) {
    btn.textContent = '👤 ' + (CURRENT_USER.name || CURRENT_USER.phone || 'Account');
    btn.onclick = doLogout;
  } else {
    btn.textContent = 'Sign In';
    btn.onclick = enterApp;
  }
}

function doLogout() {
  fetch('/api/trpc/auth.logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    .then(function(){ CURRENT_USER = null; renderAuthState(); showToast('👋 Signed out'); })
    .catch(function(){ showToast('❌ Could not sign out, try again'); });
}

function openSaved() {
  if (CURRENT_USER) { showToast('❤️ Saved items coming soon'); return; }
  enterApp();
}

/* ── AI FARM ASSISTANT CHAT ── */
function escChat(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

function renderChatMessage(m) {
  var isOut = m.direction === 'outgoing'; // outgoing = farmer's message, incoming = assistant's reply
  return '<div class="chat-msg ' + (isOut ? 'out' : 'in') + '">' +
    (!isOut ? '<div class="chat-avatar">🤖</div>' : '') +
    '<div class="chat-bubble">' + escChat(m.content) + '</div>' +
  '</div>';
}

function showChatGate() {
  var gate = document.getElementById('chatSignInGate'), wrap = document.getElementById('chatWrap');
  if (gate) gate.style.display = '';
  if (wrap) wrap.style.display = 'none';
}

function showChatUI() {
  var gate = document.getElementById('chatSignInGate'), wrap = document.getElementById('chatWrap');
  if (gate) gate.style.display = 'none';
  if (wrap) wrap.style.display = '';
}

function loadChatMessages() {
  return fetch('/api/trpc/advisory.getMessages')
    .then(function(r){ return r.json(); })
    .then(function(d) {
      if (d.error) { showChatGate(); return; }
      var msgs = (d.result && d.result.data && d.result.data.json) || [];
      var el = document.getElementById('chatMessages');
      if (!el) return;
      el.innerHTML = msgs.length
        ? msgs.map(renderChatMessage).join('')
        : '<div class="chat-empty">👋 Ask me anything about your crops — try "Tomato" or "pests" to get started.</div>';
      el.scrollTop = el.scrollHeight;
      showChatUI();
    })
    .catch(function() { showChatGate(); });
}

function sendChatMessage() {
  var input = document.getElementById('chatInput');
  var text = (input.value || '').trim();
  if (!text) return;
  input.value = '';
  input.disabled = true;
  var el = document.getElementById('chatMessages');
  var empty = el.querySelector('.chat-empty'); if (empty) empty.remove();
  el.insertAdjacentHTML('beforeend', renderChatMessage({ direction: 'outgoing', content: text }));
  el.scrollTop = el.scrollHeight;
  fetch('/api/trpc/advisory.sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ json: { content: text } })
  })
  .then(function(r){ return r.json(); })
  .then(function(d) {
    input.disabled = false;
    if (d.error) { showToast('❌ ' + (d.error.message || 'Could not send message')); return; }
    return loadChatMessages();
  })
  .catch(function() {
    input.disabled = false;
    showToast('❌ Could not send message');
  });
}

function quickChatSend(text) {
  var input = document.getElementById('chatInput');
  if (input) input.value = text;
  sendChatMessage();
}

/* ── MY ORDERS (watch the flow of a sale from pending → delivered) ── */
var ORDER_STEPS = ['pending', 'confirmed', 'in_transit', 'delivered'];
var ORDER_STEP_LABELS = { pending: 'Pending', confirmed: 'Confirmed', in_transit: 'In Transit', delivered: 'Delivered' };
var ORDER_NEXT_STATUS = { pending: 'confirmed', confirmed: 'in_transit', in_transit: 'delivered' };
var ORDER_NEXT_LABEL  = { pending: '✓ Confirm Order', confirmed: '🚚 Mark In Transit', in_transit: '📦 Mark Delivered' };

function orderStepperHTML(status) {
  if (status === 'cancelled') return '<div class="order-cancelled-tag">✕ Order Cancelled</div>';
  var idx = ORDER_STEPS.indexOf(status);
  var html = '<div class="order-stepper">';
  ORDER_STEPS.forEach(function(s, i) {
    if (i > 0) html += '<span class="order-step-line' + (i <= idx ? ' filled' : '') + '"></span>';
    var cls = i < idx ? 'done' : (i === idx ? 'current' : '');
    html += '<div class="order-step ' + cls + '"><span class="order-step-dot">' + (i < idx ? '✓' : '') + '</span><span class="order-step-label">' + ORDER_STEP_LABELS[s] + '</span></div>';
  });
  return html + '</div>';
}

function orderCardHTML(o) {
  var meta = cropMeta(o.cropName);
  var dateStr = o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  var counterpartyLabel = o.role === 'farmer' ? 'Buyer' : 'Farmer';
  var roleTag = o.role === 'farmer'
    ? '<span class="order-role-tag seller">You\'re selling</span>'
    : '<span class="order-role-tag buyer">You\'re buying</span>';
  var actionBtn = (o.role === 'farmer' && ORDER_NEXT_STATUS[o.status])
    ? '<button class="order-action-btn" onclick="advanceOrderStatus(' + o.id + ',\'' + ORDER_NEXT_STATUS[o.status] + '\')">' + ORDER_NEXT_LABEL[o.status] + '</button>'
    : '';
  return '<div class="order-card">' +
    '<div class="order-card-top">' +
      '<div class="order-crop"><span class="order-crop-emoji">' + meta.emoji + '</span>' +
        '<div><div class="order-crop-name">' + o.cropName + ' · ' + o.quantity + o.quantityUnit + '</div>' +
        '<div class="order-crop-sub">' + counterpartyLabel + ': ' + o.counterpartyName + ' · ' + dateStr + '</div></div>' +
      '</div>' +
      roleTag +
    '</div>' +
    orderStepperHTML(o.status) +
    '<div class="order-card-bottom">' +
      '<div class="order-total">KSh ' + o.totalAmount.toLocaleString() + '</div>' +
      actionBtn +
    '</div>' +
  '</div>';
}

function showOrdersGate() {
  var gate = document.getElementById('ordersSignInGate'), wrap = document.getElementById('ordersWrap');
  if (gate) gate.style.display = '';
  if (wrap) wrap.style.display = 'none';
}

function showOrdersUI() {
  var gate = document.getElementById('ordersSignInGate'), wrap = document.getElementById('ordersWrap');
  if (gate) gate.style.display = 'none';
  if (wrap) wrap.style.display = '';
}

function renderOrdersPage() {
  if (!CURRENT_USER) { showOrdersGate(); return; }
  showOrdersUI();
  var list = document.getElementById('ordersList');
  var empty = document.getElementById('ordersEmpty');
  if (!list) return;
  list.innerHTML = '<p style="text-align:center;padding:24px;color:var(--grey-text)">Loading your orders…</p>';
  if (empty) empty.style.display = 'none';
  fetch('/api/trpc/market.myOrders')
    .then(function(r){ return r.json(); })
    .then(function(data) {
      if (data.error) { showOrdersGate(); return; }
      var rows = (data.result && data.result.data && data.result.data.json) || [];
      if (!rows.length) {
        list.innerHTML = '';
        if (empty) empty.style.display = '';
        return;
      }
      list.innerHTML = rows.map(orderCardHTML).join('');
    })
    .catch(function() {
      list.innerHTML = '<p style="text-align:center;padding:24px;color:var(--grey-text)">Couldn\'t load your orders. Try again shortly.</p>';
    });
}

function advanceOrderStatus(orderId, newStatus) {
  fetch('/api/trpc/market.updateOrderStatus', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ json: { orderId: orderId, status: newStatus } })
  })
  .then(function(r){ return r.json(); })
  .then(function(data) {
    if (data.error) throw new Error(data.error.message || 'Could not update order');
    showToast('✅ Order updated');
    renderOrdersPage();
  })
  .catch(function(err) {
    showToast('❌ ' + (err.message || 'Could not update order'));
  });
}

function openWA(name) { showToast('💬 Opening WhatsApp for ' + name + '…'); }
function openBlog(url) { window.location.href = url || 'blog.html'; }
function setBlogTab(el) {
  document.querySelectorAll('.blog-tab').forEach(function(b){b.classList.remove('active');});
  el.classList.add('active');
}

function showToast(msg) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  setTimeout(function(){t.classList.remove('show');}, 2600);
}

/* ── COUNTDOWN (shared timer for flash deals & deal of the day) ── */
(function(){
  var end = Date.now() + 4*3600000 + 27*60000;
  function tick(){
    var d = Math.max(0, end - Date.now());
    var h = String(Math.floor(d/3600000)).padStart(2,'0');
    var m = String(Math.floor((d%3600000)/60000)).padStart(2,'0');
    var s = String(Math.floor((d%60000)/1000)).padStart(2,'0');
    ['dh','fh'].forEach(function(id){var e=document.getElementById(id);if(e)e.textContent=h;});
    ['dm','fm'].forEach(function(id){var e=document.getElementById(id);if(e)e.textContent=m;});
    ['ds','fs'].forEach(function(id){var e=document.getElementById(id);if(e)e.textContent=s;});
  }
  tick(); setInterval(tick, 1000);
})();

/* ── INIT ── */
updateCart();
document.querySelectorAll('.buyer-location-sel').forEach(function(sel){ sel.value = BUYER_LOCATION; });
updateNearMeBanner();
loadProducts();
loadNearbyFarmers();
