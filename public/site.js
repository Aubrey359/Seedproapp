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
    })
    .catch(function(err){ console.error('Failed to load listings', err); PRODUCTS = []; })
    .then(function(){
      productsLoaded = true;
      renderHomeGrid();
      renderShopGrid();
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

/* ── CARD HTML ── */
function cardHTML(p) {
  var inCart = cart.find(function(c){return c.id===p.id;});
  return '<div class="prod-card">' +
    '<div class="prod-img">' +
      '<span class="prod-emoji">' + p.emoji + '</span>' +
      (p.img ? '<img class="prod-photo" src="' + p.img + '" alt="' + p.name + '" loading="lazy" onerror="this.remove()">' : '') +
      (p.disc ? '<div class="prod-discount">' + p.disc + '</div>' : '') +
      (p.ok   ? '<div class="prod-check">✓</div>' : '') +
      (p.hasPhoto ? '<div class="prod-photo-badge" title="Real photo from farmer">📸 Verified</div>' : '') +
      '<button class="prod-fav" onclick="event.stopPropagation();showToast(\'❤️ Saved!\')">♡</button>' +
    '</div>' +
    '<div class="prod-body">' +
      '<div class="prod-name">' + p.name + (p.premium ? ' <span class="prod-premium-badge" title="Premium seller">⭐</span>' : '') + '</div>' +
      '<div class="prod-meta">📍 ' + p.county + ' · <span class="prod-rating">★ ' + p.rating + '</span></div>' +
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
  toggleCart();
  openMpesaPayment();
}

/* ── M-PESA PAYMENT MODAL ── */
function openMpesaPayment() {
  var total = cart.reduce(function(s,c){return s+c.price*c.qty;},0);
  var existing = document.getElementById('mpesaModal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'mpesaModal';
  modal.innerHTML = [
    '<div class="mpesa-overlay" onclick="closeMpesa()"></div>',
    '<div class="mpesa-sheet">',
      '<button class="auth-close" onclick="closeMpesa()">✕</button>',
      '<div class="mpesa-logo">💳</div>',
      '<h2 class="auth-title">Lipa na M-Pesa</h2>',
      '<p class="auth-sub">You will receive a prompt on your phone</p>',
      '<div class="mpesa-amount">KSh <strong>' + total.toLocaleString() + '</strong></div>',
      '<div class="mpesa-items">' + cart.map(function(c){ return '<span>' + c.emoji + ' ' + c.name + ' ×' + c.qty + '</span>'; }).join('') + '</div>',
      '<div class="auth-field" style="margin-top:16px"><label>M-Pesa Phone Number</label>',
        '<input type="tel" id="mpesaPhone" placeholder="e.g. 0712 345 678" />',
      '</div>',
      '<button class="auth-submit mpesa-pay-btn" onclick="initiateMpesa(' + total + ')">',
        '📲 Send M-Pesa Request',
      '</button>',
      '<p style="text-align:center;font-size:11px;color:var(--grey-text);margin-top:10px">Powered by Safaricom Daraja · Secure · Instant</p>',
      '<div id="mpesaStatus" style="display:none"></div>',
    '</div>'
  ].join('');
  document.body.appendChild(modal);
  requestAnimationFrame(function(){ modal.classList.add('open'); });
}

function closeMpesa() {
  var m = document.getElementById('mpesaModal');
  if (m) m.remove();
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

  // Call the tRPC STK Push endpoint
  fetch('/api/trpc/mpesa.stkPush', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      json: {
        phone:       phone,
        amount:      amount,
        accountRef:  'Shamba Sokoni',
        description: 'Farm Produce'
      }
    })
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

/* ── SIGN-IN MODAL ── */
function enterApp() {
  var existing = document.getElementById('authModal');
  if (existing) { existing.classList.add('open'); return; }

  var modal = document.createElement('div');
  modal.id = 'authModal';
  modal.innerHTML = [
    '<div class="auth-overlay" onclick="closeAuth()"></div>',
    '<div class="auth-sheet">',
      '<button class="auth-close" onclick="closeAuth()">✕</button>',
      '<div class="auth-logo"><span>🌱</span></div>',
      '<h2 class="auth-title">Welcome to Shamba Sokoni</h2>',
      '<p class="auth-sub">Kenya\'s #1 Farm Marketplace</p>',
      '<div class="auth-tabs">',
        '<button class="auth-tab active" id="atab-login" onclick="switchAuthTab(\'login\')">Sign In</button>',
        '<button class="auth-tab" id="atab-register" onclick="switchAuthTab(\'register\')">Register Free</button>',
      '</div>',
      /* LOGIN */
      '<div id="auth-login">',
        '<div class="auth-field"><label>Phone Number</label><input type="tel" id="authPhone" placeholder="e.g. 0712 345 678" /></div>',
        '<div class="auth-field"><label>Password</label><div class="auth-pwd-wrap"><input type="password" id="authPass" placeholder="Your password" /><button class="pwd-eye" onclick="togglePwd()">👁</button></div></div>',
        '<button class="auth-submit" onclick="doLogin()">🔐 Sign In</button>',
        '<div class="auth-or"><span>or</span></div>',
        '<button class="auth-mpesa" onclick="doMpesaLogin()">💳 Sign in with M-Pesa</button>',
        '<div class="auth-forgot" onclick="showToast(\'📲 OTP sent to your phone\')">Forgot password?</div>',
      '</div>',
      /* REGISTER */
      '<div id="auth-register" style="display:none">',
        '<div class="auth-field"><label>Full Name</label><input type="text" id="regName" placeholder="e.g. James Mwangi" /></div>',
        '<div class="auth-field"><label>Phone Number</label><input type="tel" id="regPhone" placeholder="e.g. 0712 345 678" /></div>',
        '<div class="auth-field"><label>County</label><select id="regCounty"><option value="">Select county…</option><option>Nairobi</option><option>Nakuru</option><option>Kisumu</option><option>Mombasa</option><option>Muranga</option><option>Thika</option><option>Meru</option><option>Kericho</option><option>Kakamega</option><option>Eldoret</option><option>Naivasha</option><option>Nyeri</option><option>Kisii</option><option>Kiambu</option><option>Embu</option><option>Mwea</option></select></div>',
        '<div class="auth-field"><label>I am a…</label><div class="auth-role-row"><button class="role-btn active" id="role-farmer" onclick="setRole(\'farmer\')">🌾 Farmer</button><button class="role-btn" id="role-buyer" onclick="setRole(\'buyer\')">🛒 Buyer</button></div></div>',
        '<div class="auth-field"><label>Password</label><input type="password" id="regPass" placeholder="Create a password" /></div>',
        '<button class="auth-submit" onclick="doRegister()">🌱 Create Free Account</button>',
        '<p class="auth-terms">By registering you agree to our <span onclick="showToast(\'Terms opening soon…\')">Terms</span> &amp; <span onclick="showToast(\'Privacy policy opening soon…\')">Privacy Policy</span></p>',
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

function switchAuthTab(tab) {
  document.getElementById('auth-login').style.display    = tab === 'login'    ? '' : 'none';
  document.getElementById('auth-register').style.display = tab === 'register' ? '' : 'none';
  document.getElementById('atab-login').classList.toggle('active',    tab === 'login');
  document.getElementById('atab-register').classList.toggle('active', tab === 'register');
}

var _authRole = 'farmer';
function setRole(r) {
  _authRole = r;
  document.getElementById('role-farmer').classList.toggle('active', r === 'farmer');
  document.getElementById('role-buyer').classList.toggle('active',  r === 'buyer');
}

function togglePwd() {
  var inp = document.getElementById('authPass');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

function doLogin() {
  var phone = (document.getElementById('authPhone')||{}).value||'';
  var pass  = (document.getElementById('authPass')||{}).value||'';
  if (!phone.trim()) { showToast('⚠️ Please enter your phone number'); return; }
  if (!pass.trim())  { showToast('⚠️ Please enter your password'); return; }
  var btn = document.querySelector('#auth-login .auth-submit');
  btn.textContent = '⏳ Signing in…'; btn.disabled = true;
  setTimeout(function() {
    btn.textContent = '🔐 Sign In'; btn.disabled = false;
    closeAuth();
    showToast('✅ Welcome back! Full app coming soon.');
  }, 1200);
}

function doMpesaLogin() {
  showToast('📲 M-Pesa OTP sent — enter the code to continue');
}

function doRegister() {
  var name  = (document.getElementById('regName')||{}).value||'';
  var phone = (document.getElementById('regPhone')||{}).value||'';
  var county= (document.getElementById('regCounty')||{}).value||'';
  var pass  = (document.getElementById('regPass')||{}).value||'';
  if (!name.trim())   { showToast('⚠️ Please enter your name');     return; }
  if (!phone.trim())  { showToast('⚠️ Please enter your phone');    return; }
  if (!county)        { showToast('⚠️ Please select your county');  return; }
  if (!pass.trim())   { showToast('⚠️ Please create a password');   return; }
  var btn = document.querySelector('#auth-register .auth-submit');
  btn.textContent = '⏳ Creating account…'; btn.disabled = true;
  setTimeout(function() {
    btn.textContent = '🌱 Create Free Account'; btn.disabled = false;
    closeAuth();
    showToast('🎉 Account created! Welcome to Shamba Sokoni, ' + name.split(' ')[0] + '!');
  }, 1400);
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
loadProducts();
