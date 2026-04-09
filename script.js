function showSignup() {
  document.getElementById("loginBox").classList.add("hidden");
  document.getElementById("signupBox").classList.remove("hidden");
}

function showLogin() {
  document.getElementById("signupBox").classList.add("hidden");
  document.getElementById("loginBox").classList.remove("hidden");
}

function showPopup(message) {
  const popupMessage = document.getElementById("popupMessage");
  if (popupMessage) popupMessage.textContent = message;
  const popup = document.getElementById("popup");
  if (popup) popup.classList.remove("hidden");
  // auto-hide short informational popups (keeps manual close available)
  try { clearTimeout(window._popupTimeout); } catch (e) {}
  window._popupTimeout = setTimeout(() => {
    const p = document.getElementById('popup'); if (p) p.classList.add('hidden');
  }, 2200);
}

function closePopup() {
  const popup = document.getElementById("popup");
  if (popup) popup.classList.add("hidden");
}

function showToast(message = '', duration = 1800) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), duration);
}

async function hashPassword(password) {
  const enc = new TextEncoder();
  const buf = enc.encode(password);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  const hashArray = Array.from(new Uint8Array(hashBuf));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function logout() {
  // show dashboard toast if present, then clear session and redirect
  const toast = document.getElementById('toast');
  localStorage.removeItem('session_user');
  // show toast when available
  if (toast) {
    toast.textContent = 'Successfully logged out';
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
      window.location.href = 'index.html';
    }, 900);
  } else {
    window.location.href = 'index.html';
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  const modeToggle = document.getElementById('modeToggle');

  // Entrance animation: auth container already uses CSS animation
  // CSS animation runs via stylesheet; no JS trigger required

  // Preference: dark/light
  try {
    const pref = localStorage.getItem('mode');
    if (pref === 'light') document.body.classList.add('light-mode');
  } catch (e) {}

  if (modeToggle) {
    modeToggle.addEventListener('click', () => {
      document.body.classList.toggle('light-mode');
      const now = document.body.classList.contains('light-mode') ? 'light' : 'dark';
      localStorage.setItem('mode', now);
    });
  }

  // removed inline validation icons and peek buttons for a cleaner production-ready form

  // SIGN UP
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = document.getElementById("signupUsername").value.trim();
      const email = document.getElementById("signupEmail").value.trim();
      const password = document.getElementById("signupPassword").value;
      const error = document.getElementById("signupError");

      error.textContent = "";
      if (username === "" || email === "" || password === "") {
        error.textContent = "All fields are required!";
        return;
      }

      const existing = localStorage.getItem('user_' + username);
      if (existing) {
        error.textContent = "Username already exists. Choose another.";
        return;
      }

      const hashed = await hashPassword(password);
      localStorage.setItem("user_" + username, JSON.stringify({ email, passwordHash: hashed }));
      showPopup("Registration successful! Please sign in.");
      showLogin();
    });
  }

  // LOGIN
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = document.getElementById("loginUsername").value.trim();
      const password = document.getElementById("loginPassword").value;
      const error = document.getElementById("loginError");

      error.textContent = "";
      if (username === "" || password === "") {
        error.textContent = "Fields cannot be empty!";
        return;
      }

      const userData = localStorage.getItem("user_" + username);
      if (!userData) {
        error.textContent = "No account found. Please register first.";
        return;
      }

      const user = JSON.parse(userData);
      const hashed = await hashPassword(password);
      if (user.passwordHash !== hashed) {
        error.textContent = "Incorrect password. Try again.";
        return;
      }

      // Session setup
      // show personalized routing message
      showPopup(`Authenticating ${username}...`);
      localStorage.setItem("session_user", username);
      // small delay so user sees message
      setTimeout(() => {
        showPopup('Preparing your dashboard...');
      }, 600);
      setTimeout(() => window.location.href = "dashboard.html", 1200);
    });
  }

  // Forgot Password simulation
  const forgotPassword = document.getElementById("forgotPassword");
  if (forgotPassword) {
    forgotPassword.addEventListener("click", (e) => {
      e.preventDefault();
      const username = document.getElementById("loginUsername").value.trim();
      if (username === "") {
        showPopup("Please enter your username first.");
        return;
      }
      const userData = localStorage.getItem("user_" + username);
      if (!userData) {
        showPopup("No account found. Please register first.");
        return;
      }
      const user = JSON.parse(userData);
      showPopup("Password reset link sent to: " + user.email);
    });
  }

  // Dashboard logic (protect route)
  const welcomeMessage = document.getElementById("welcomeMessage");
  if (welcomeMessage) {
    const sessionUser = localStorage.getItem('session_user');
    if (!sessionUser) { window.location.href = 'index.html'; return; }

    // display user info
    welcomeMessage.textContent = `Welcome, ${sessionUser}!`;
    const userData = localStorage.getItem('user_' + sessionUser);
    if (userData) {
      try {
        const user = JSON.parse(userData);
        const userEmailEl = document.getElementById('userEmail');
        if (userEmailEl) userEmailEl.textContent = user.email || '';
      } catch (err) { console.error('User parse error', err); }
    }

    // Hero: show datetime and dynamic greeting
    const nowTime = document.getElementById('nowTime');
    const greeting = document.getElementById('greeting');
    function updateTime() {
      const d = new Date();
      const hours = d.getHours();
      const opts = { weekday: 'short', month: 'short', day: 'numeric' };
      if (greeting) {
        let g = 'Hello';
        if (hours < 12) g = 'Good Morning'; else if (hours < 18) g = 'Good Afternoon'; else g = 'Good Evening';
        greeting.textContent = g;
      }
      if (nowTime) nowTime.textContent = d.toLocaleString(undefined, opts) + ' • ' + d.toLocaleTimeString();
    }
    updateTime(); setInterval(updateTime, 1000);

    // Live feed: use jsonplaceholder for demo and coin prices from coingecko
    const feedList = document.getElementById('feedList');
    const feedSkeleton = document.getElementById('feedSkeleton');
    const refreshBtn = document.getElementById('refreshFeed');
    let prices = {};
    const FEED_LAST_KEY = 'feed_last_fetch'; // timestamp in ms

    async function fetchPrices() {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd');
        const data = await res.json();
        return data;
      } catch (e) { return null; }
    }

    async function refreshFeed(force = false) {
      if (!force) {
        const last = Number(localStorage.getItem(FEED_LAST_KEY) || 0);
        const now = Date.now();
        // if fetched within last 24 hours, skip automatic fetch
        if (last && (now - last) < (24 * 60 * 60 * 1000)) {
          if (feedSkeleton) feedSkeleton.style.display = 'none';
          return; // keep existing feed content
        }
      }
      if (feedSkeleton) feedSkeleton.style.display = 'block';
      if (feedList) feedList.innerHTML = '';
      try {
        // If user provided a NewsAPI key, fetch top headlines with images
        const userKey = localStorage.getItem('news_api_key');
        let hits = [];
        if (userKey) {
          try {
            const url = `https://newsapi.org/v2/top-headlines?country=us&pageSize=8&apiKey=${encodeURIComponent(userKey)}`;
            const news = await fetch(url).then(r => r.json());
            if (news && news.articles && news.articles.length) {
              hits = news.articles.map((a, i) => ({
                title: a.title,
                url: a.url,
                image: a.urlToImage,
                source: a.source && a.source.name,
                publishedAt: a.publishedAt
              }));
            }
          } catch (e) {
            console.warn('NewsAPI fetch failed, falling back to Hacker News', e);
            hits = [];
          }
        }

        // fallback to Hacker News if no hits from NewsAPI
        if (!hits.length) {
          const hn = await fetch('https://hn.algolia.com/api/v1/search?tags=front_page').then(r => r.json());
          const hnHits = hn && hn.hits ? hn.hits.slice(0, 8) : [];
          hits = hnHits.map(h => ({ title: h.title || h.story_title || 'Untitled', url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}` }));
        }
        const newPrices = await fetchPrices();
        const prev = JSON.parse(sessionStorage.getItem('prevPrices') || '{}');
        prices = newPrices || prices;
        if (newPrices) sessionStorage.setItem('prevPrices', JSON.stringify(newPrices));
        // record last successful fetch time
        localStorage.setItem(FEED_LAST_KEY, Date.now().toString());

        if (feedSkeleton) feedSkeleton.style.display = 'none';
        if (feedList) {
          if (hits.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No news available.';
            feedList.appendChild(li);
          } else {
              hits.forEach(h => {
                const li = document.createElement('li');
                const card = document.createElement('article'); card.className = 'news-card';

                // image (if present)
                const imgWrap = document.createElement('div'); imgWrap.className = 'news-img';
                const img = document.createElement('img');
                img.alt = h.title || '';
                // show placeholder first, replace if we discover a better image
                const placeholder = 'https://via.placeholder.com/640x400?text=News';
                img.src = placeholder;
                imgWrap.appendChild(img);
                card.appendChild(imgWrap);

                // If article provided an image, use it. Otherwise try to fetch OpenGraph image via AllOrigins proxy.
                if (h.image) {
                  img.src = h.image;
                } else if (h.url) {
                  try {
                    // fetch the raw HTML through a CORS proxy and look for og:image / twitter:image
                    fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(h.url)).then(r => r.text()).then(html => {
                      try {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(html, 'text/html');
                        const og = doc.querySelector('meta[property="og:image"]') || doc.querySelector('meta[name="twitter:image"]') || doc.querySelector('link[rel="image_src"]');
                        const src = og && (og.getAttribute('content') || og.getAttribute('href'));
                        if (src) {
                          // resolve relative URLs against the article URL
                          const resolved = new URL(src, h.url).href;
                          img.src = resolved;
                        }
                      } catch (e) { /* ignore parsing errors */ }
                    }).catch(() => {});
                  } catch (e) { /* ignore */ }
                }

                // body
                const body = document.createElement('div'); body.className = 'news-body';
                const a = document.createElement('a'); a.href = h.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.className = 'news-title';
                a.textContent = h.title || 'Untitled';
                body.appendChild(a);
                if (h.description || h.excerpt) {
                  const ex = document.createElement('div'); ex.className = 'news-excerpt';
                  ex.textContent = h.description || h.excerpt || '';
                  body.appendChild(ex);
                }

                const footer = document.createElement('div'); footer.className = 'news-footer';
                const badge = document.createElement('div'); badge.className = 'source-badge'; badge.textContent = h.source || '';
                footer.appendChild(badge);

                const follow = document.createElement('button'); follow.className = 'follow-btn'; follow.textContent = 'Follow';
                follow.addEventListener('click', (ev) => { ev.stopPropagation(); follow.classList.toggle('following'); follow.textContent = follow.classList.contains('following') ? 'Following' : 'Follow'; });
                footer.appendChild(follow);

                body.appendChild(footer);
                card.appendChild(body);
                li.appendChild(card);
                feedList.appendChild(li);
              });
          }

          // Append price info if available
          if (newPrices) {
            const priceInfo = document.createElement('div');
            priceInfo.style.marginTop = '10px';
            const btc = newPrices.bitcoin.usd;
            const eth = newPrices.ethereum.usd;
            const btcPrev = prev.bitcoin && prev.bitcoin.usd ? prev.bitcoin.usd : btc;
            const ethPrev = prev.ethereum && prev.ethereum.usd ? prev.ethereum.usd : eth;
            const upDown = (cur, prev) => cur >= prev ? 'up' : 'down';
            priceInfo.innerHTML = `<div>BTC: <span class="price ${upDown(btc,btcPrev)}">$${btc}</span> &nbsp; ETH: <span class="price ${upDown(eth,ethPrev)}">$${eth}</span></div>`;
            feedList.appendChild(priceInfo);
          }
        }
      } catch (err) { console.error('Feed error', err); if (feedSkeleton) feedSkeleton.style.display = 'none'; }
    }

    // manual refresh forces an immediate fetch
    refreshBtn && refreshBtn.addEventListener('click', () => { refreshFeed(true); });
    // initial load: fetch now so news with images are generated automatically
    refreshFeed(true);

    // News API key setter removed (button removed from UI)

    // Calculator removed — UI simplified

    // style for price up/down
    const stylePrice = document.createElement('style');
    stylePrice.innerHTML = `.price.up{color:#4caf50;font-weight:700}.price.down{color:#ff5252;font-weight:700}`;
    document.head.appendChild(stylePrice);

    // Good Thoughts removed

    /* Weather: simple no-key public API (Open-Meteo) for default location (NYC). */
    const weatherLocationEl = document.getElementById('weatherLocation');
    const weatherTempEl = document.getElementById('weatherTemp');
    const weatherDescEl = document.getElementById('weatherDesc');
    const weatherUpdatedEl = document.getElementById('weatherUpdated');
    const refreshWeatherBtn = document.getElementById('refreshWeather');

    async function fetchWeather(lat=40.7128, lon=-74.0060) {
      try {
        if (weatherLocationEl) weatherLocationEl.textContent = 'New York, NY';
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=fahrenheit`;
        const res = await fetch(url);
        const data = await res.json();
        if (data && data.current_weather) {
          const c = data.current_weather;
          if (weatherTempEl) weatherTempEl.textContent = Math.round(c.temperature) + '°F';
          if (weatherDescEl) weatherDescEl.textContent = `Wind ${Math.round(c.windspeed)} km/h • Weather code ${c.weathercode}`;
          if (weatherUpdatedEl) weatherUpdatedEl.textContent = 'Updated: ' + new Date().toLocaleTimeString();
        }
      } catch (e) { if (weatherLocationEl) weatherLocationEl.textContent = 'Weather unavailable'; }
    }
    if (refreshWeatherBtn) refreshWeatherBtn.addEventListener('click', () => fetchWeather());
    fetchWeather();

    // AI Assistant toggle and demo handler
    const aiBtn = document.getElementById('aiToolBtn');
    const aiCard = document.getElementById('aiAssistantCard');
    const closeAi = document.getElementById('closeAi');
    const aiInput = document.getElementById('aiInput');
    const aiSend = document.getElementById('aiSend');
    const aiResponse = document.getElementById('aiResponse');

    if (aiBtn && aiCard) {
      aiBtn.addEventListener('click', (e) => { e.preventDefault(); aiCard.classList.toggle('hidden'); if (!aiCard.classList.contains('hidden') && aiInput) aiInput.focus(); });
    }
    if (closeAi && aiCard) closeAi.addEventListener('click', () => aiCard.classList.add('hidden'));
    if (aiSend && aiInput && aiResponse) {
      async function sendAi() {
        const q = aiInput.value.trim();
        if (!q) { showToast('Type a question'); return; }
        aiResponse.textContent = 'Searching the web...';
        try {
          const url = 'https://api.duckduckgo.com/?q=' + encodeURIComponent(q) + '&format=json&no_redirect=1&no_html=1';
          const res = await fetch(url);
          const data = await res.json();
          const summary = data.AbstractText || (data.RelatedTopics && data.RelatedTopics[0] && (data.RelatedTopics[0].Text || '')) || '';
          if (summary && summary.length > 0) {
            aiResponse.textContent = summary;
            const more = document.createElement('div'); more.style.marginTop = '8px';
            const link = document.createElement('a');
            link.href = 'https://www.google.com/search?q=' + encodeURIComponent(q);
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = 'Open full search results';
            link.style.color = '#9c27b0';
            more.appendChild(link);
            aiResponse.appendChild(more);
          } else {
            aiResponse.textContent = 'No instant answer found — opening full search results.';
            window.open('https://www.google.com/search?q=' + encodeURIComponent(q), '_blank');
          }
        } catch (err) {
          aiResponse.textContent = 'Error searching — opening full search results.';
          window.open('https://www.google.com/search?q=' + encodeURIComponent(q), '_blank');
        }
      }
      aiSend.addEventListener('click', sendAi);
      aiInput.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); sendAi(); } });
    }

    // Leaflet integration — interactive map without search
    const mapEl = document.getElementById('map');
    let leafletMap = null;
    let leafletMarker = null;

    function initLeaflet() {
      if (!mapEl || typeof L === 'undefined') return;
      leafletMap = L.map(mapEl).setView([40.7128, -74.0060], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(leafletMap);
      leafletMarker = L.marker([40.7128, -74.0060]).addTo(leafletMap);

      // Try to center map on user's current location (permission required)
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
          try {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            const acc = pos.coords.accuracy || 50;
            if (leafletMap) {
              leafletMap.setView([lat, lon], 13);
              if (leafletMarker) leafletMarker.setLatLng([lat, lon]);
              else leafletMarker = L.marker([lat, lon]).addTo(leafletMap);
              L.circle([lat, lon], { radius: Math.max(acc, 20), color: '#3388ff', fillColor: '#3388ff', fillOpacity: 0.12 }).addTo(leafletMap);
              leafletMarker.bindPopup('You are here').openPopup();
            }
          } catch (e) { console.warn('Set location failed', e); }
        }, (err) => {
          console.warn('Geolocation failed', err);
          showToast('Location unavailable');
        }, { enableHighAccuracy: true, timeout: 8000 });
      }

      // ensure correct sizing if container layout changed; call after a short delay
      setTimeout(() => { try { leafletMap.invalidateSize(); } catch (e) {} }, 200);
      // visual confirmation
      showToast('Map loaded', 1200);
    }

    // init Leaflet (Leaflet script included before script.js in HTML)
    initLeaflet();
  }
});
