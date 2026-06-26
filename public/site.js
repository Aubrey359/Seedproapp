/* ── PRODUCTS DATA ── */
var PRODUCTS = [
  {id:1,  name:'Tomatoes',      emoji:'🍅', cat:'vegetables', price:95,  old:120, unit:'kg',    farmer:'James M.', county:'Nakuru',   rating:4.9, ok:true,  disc:'-21%'},
  {id:2,  name:'Maize',         emoji:'🌽', cat:'grains',     price:42,  old:null,unit:'kg',    farmer:'Grace A.', county:'Kisumu',   rating:4.7, ok:true,  disc:null },
  {id:3,  name:'Coffee AA',     emoji:'☕', cat:'cash',       price:320, old:null,unit:'kg',    farmer:'Mary W.',  county:'Thika',    rating:5.0, ok:true,  disc:null },
  {id:4,  name:'Avocado Hass',  emoji:'🥑', cat:'fruits',     price:85,  old:110, unit:'kg',    farmer:'Peter N.', county:'Muranga',  rating:4.8, ok:true,  disc:'-23%'},
  {id:5,  name:'Onions',        emoji:'🧅', cat:'vegetables', price:110, old:null,unit:'kg',    farmer:'Aisha O.', county:'Naivasha', rating:4.6, ok:false, disc:null },
  {id:6,  name:'Beans',         emoji:'🫘', cat:'legumes',    price:135, old:null,unit:'kg',    farmer:'Simon K.', county:'Meru',     rating:4.5, ok:true,  disc:null },
  {id:7,  name:'Sukuma Wiki',   emoji:'🥬', cat:'vegetables', price:35,  old:null,unit:'bunch', farmer:'Faith M.', county:'Kiambu',   rating:4.4, ok:false, disc:null },
  {id:8,  name:'Sweet Potato',  emoji:'🍠', cat:'vegetables', price:55,  old:null,unit:'kg',    farmer:'David O.', county:'Kakamega', rating:4.7, ok:true,  disc:null },
  {id:9,  name:'Bananas',       emoji:'🍌', cat:'fruits',     price:48,  old:null,unit:'bunch', farmer:'Ruth A.',  county:'Kisii',    rating:4.8, ok:true,  disc:null },
  {id:10, name:'Pishori Rice',  emoji:'🍚', cat:'grains',     price:185, old:220, unit:'kg',    farmer:'Hassan M.',county:'Mwea',     rating:4.9, ok:true,  disc:'-16%'},
  {id:11, name:'Tea KTDA',      emoji:'🍵', cat:'cash',       price:280, old:null,unit:'kg',    farmer:'CTC Farm', county:'Kericho',  rating:4.6, ok:true,  disc:null },
  {id:12, name:'French Beans',  emoji:'🫛', cat:'vegetables', price:145, old:null,unit:'kg',    farmer:'Esther K.',county:'Meru',     rating:4.8, ok:true,  disc:null },
];

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
    '<div class="prod-img">' + p.emoji +
      (p.disc ? '<div class="prod-discount">' + p.disc + '</div>' : '') +
      (p.ok   ? '<div class="prod-check">✓</div>' : '') +
      '<button class="prod-fav" onclick="event.stopPropagation();showToast(\'❤️ Saved!\')">♡</button>' +
    '</div>' +
    '<div class="prod-body">' +
      '<div class="prod-name">' + p.name + '</div>' +
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
  el.innerHTML = PRODUCTS.slice(0,6).map(cardHTML).join('');
}

function renderShopGrid() {
  var f = filtered(), el = document.getElementById('shopGrid'); if (!el) return;
  el.innerHTML = f.length ? f.map(cardHTML).join('') :
    '<p style="grid-column:span 2;text-align:center;padding:24px;color:var(--grey-text)">No products found</p>';
  var c = document.getElementById('prodCount');
  if (c) c.textContent = f.length + ' product' + (f.length!==1?'s':'');
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
  if (v==='default')    PRODUCTS.sort(function(a,b){return a.id-b.id;});
  renderShopGrid();
}

function shopCat(cat) { activeCat = cat; window.location.href = 'shop.html'; }

/* ── NAV / UI ── */
function handleSearch() {
  var q = (document.getElementById('globalSearch')||{}).value||'';
  if (q.trim()) { window.location.href = 'shop.html'; }
}

function toggleCart() {
  document.getElementById('cartOverlay').classList.toggle('open');
  document.getElementById('cartDrawer').classList.toggle('open');
}

function checkout() {
  if (!cart.length) { showToast('Your cart is empty'); return; }
  toggleCart(); enterApp();
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
renderHomeGrid();
renderShopGrid();
