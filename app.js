// ==============================================================================
// APPLICATION WEB PURE PWA - DÉPARTEMENT COMMUNICATION (KUN COM VH)
// Refonte Totale Instagram / Threads & Layout Web Responsive 100% Fluide
// ==============================================================================

(function() {
  console.log("🚀 Lancement de l'application Web (Style Instagram / Threads)...");

  // ETAT GLOBAL
  var activeTab = 'home';
  var activeStory = 'cadrage';
  var isLikedBilan = true;
  var likesBilanCount = 43;
  var isCheckedIn = false;
  
  var ratings = {
    web: { score: 5, comment: 'Direct streaming HD fluide' },
    proj: { score: 4, comment: 'Textes affichés dans les temps' },
    prod: { score: 4, comment: 'Transitions vidéo soignées' },
    regie: { score: 5, comment: 'Mixage acoustique excellent' },
    photo: { score: 4, comment: 'Tri rapide des photos' },
    vente: { score: 4, comment: 'Support CD/USB prêts' }
  };

  function initApp() {
    var root = document.getElementById('root');
    if (!root) return;

    render();

    function render() {
      root.innerHTML = `
        <div style="display:flex; flex-direction:column; min-height:100vh; width:100%; position:relative; background-color:#FFFFFF; font-family:-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif;">
          
          <!-- ÉCRAN ACTIF SCROLLABLE (RESPONSIVE FLUIDE) -->
          <div style="flex:1; padding-bottom:80px;">
            ${renderScreen()}
          </div>

          <!-- TAB BAR FIXE STYLE INSTAGRAM GLASSMORPHISM -->
          <nav style="position:fixed; bottom:0; left:50%; transform:translateX(-50%); width:100%; max-width:500px; height:68px; background:rgba(255,255,255,0.94); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); border-top:1px solid #F2F2F7; display:flex; justify-content:space-around; align-items:center; z-index:99999;">
            <button onclick="window.setTab('home')" style="${tabStyle(activeTab === 'home')}">
              <span style="font-size:22px;">🏠</span>
            </button>

            <button onclick="window.setTab('planning')" style="${tabStyle(activeTab === 'planning')}">
              <span style="font-size:22px;">📅</span>
            </button>

            <!-- BOUTON CENTRAL + SURÉLEVÉ -->
            <button onclick="window.setTab('debrief')" style="width:48px; height:48px; border-radius:24px; background-color:#007AFF; color:#FFF; border:none; font-size:24px; display:flex; align-items:center; justify-content:center; margin-top:-20px; box-shadow:0 6px 16px rgba(0,122,255,0.35); cursor:pointer;">
              +
            </button>

            <button onclick="window.setTab('halloffame')" style="${tabStyle(activeTab === 'halloffame')}">
              <span style="font-size:22px;">🌟</span>
              <span style="position:absolute; top:12px; right:20%; width:6px; height:6px; border-radius:3px; background:#FF2D55;"></span>
            </button>

            <button onclick="window.setTab('profile')" style="${tabStyle(activeTab === 'profile')}">
              <span style="font-size:22px;">👤</span>
            </button>
          </nav>
        </div>
      `;
    }

    // Handlers Globaux
    window.setTab = function(t) { activeTab = t; render(); };
    window.setStory = function(s) { activeStory = s; render(); };
    window.toggleBilanLike = function() {
      isLikedBilan = !isLikedBilan;
      likesBilanCount += isLikedBilan ? 1 : -1;
      render();
    };
    window.doCheckIn = function() {
      isCheckedIn = true;
      alert("✅ Présence validée pour le Culte !");
      render();
    };
    window.setRatingScore = function(secId, score) {
      if (secId === 'cadrage') {
        alert("🔒 Action Interdite : Vous ne pouvez pas noter votre propre section !");
        return;
      }
      ratings[secId].score = score;
      render();
    };
    window.publishBilanFeed24h = function() {
      alert("🚀 Bilan de Culte Validé et Publié sur le Feed Instagram (24h) !\n\n🏆 Section Vedette attribuée : Cadrage 🎥 (4.88 / 5.0)");
      activeTab = 'home';
      render();
    };

    function tabStyle(active) {
      return 'background:none; border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; padding:8px 16px; opacity:' + (active ? 1 : 0.5) + '; position:relative;';
    }

    // RENDU DES 5 ÉCRANS INSTAGRAM / THREADS
    function renderScreen() {
      if (activeTab === 'home') {
        return `
          <!-- 1. HEADER INSTAGRAM TOP -->
          <header style="padding:14px 18px; background:#FFF; border-bottom:1px solid #F2F2F7; display:flex; justify-content:space-between; align-items:center; sticky:top; top:0; z-index:100;">
            <div>
              <p style="font-size:10px; font-weight:800; color:#007AFF; text-transform:uppercase; letter-spacing:1.2px; margin:0 0 1px;">ÉGLISE VASE D'HONNEUR</p>
              <h1 style="font-size:22px; font-weight:900; color:#1C1C1E; margin:0; letter-spacing:-0.6px;">Kun COM 📸</h1>
            </div>
            <div style="display:flex; gap:12px; align-items:center;">
              <div style="width:36px; height:36px; border-radius:18px; background:#F8F9FA; display:flex; align-items:center; justify-content:center; cursor:pointer;">➕</div>
              <div style="width:36px; height:36px; border-radius:18px; background:#F8F9FA; display:flex; align-items:center; justify-content:center; cursor:pointer; position:relative;">
                💬<span style="position:absolute; top:6px; right:6px; width:7px; height:7px; border-radius:4px; background:#FF2D55;"></span>
              </div>
            </div>
          </header>

          <!-- 2. CARROUSEL STORIES EN BULLES CIRCULAIRES -->
          <div style="padding:12px 0; border-bottom:1px solid #F2F2F7; background:#FFF; overflow-x:auto; white-space:nowrap; -webkit-overflow-scrolling:touch;">
            <div style="display:flex; gap:14px; padding:0 14px;">
              ${[
                { id: 'cadrage', nom: 'Cadrage', icon: '🎥', active: true },
                { id: 'regie', nom: 'Régie', icon: '🎛️', active: true },
                { id: 'web', nom: 'Web', icon: '🌐', active: false },
                { id: 'proj', nom: 'Projection', icon: '🖥️', active: false },
                { id: 'prod', nom: 'Prod', icon: '🎬', active: false },
                { id: 'photo', nom: 'Photo', icon: '📸', active: false },
                { id: 'vente', nom: 'Vente', icon: '🛒', active: false }
              ].map(function(story) {
                var isSel = activeStory === story.id;
                return `
                  <div onclick="window.setStory('${story.id}')" style="display:inline-flex; flex-direction:column; align-items:center; cursor:pointer; width:66px;">
                    <div style="width:62px; height:62px; border-radius:31px; padding:2px; border:2px solid ${isSel || story.active ? '#D4AF37' : '#E5E5EA'}; display:flex; align-items:center; justify-content:center; background:#FFF;">
                      <div style="width:100%; height:100%; border-radius:27px; background:#E5F1FF; display:flex; align-items:center; justify-content:center; font-size:24px;">
                        ${story.icon}
                      </div>
                    </div>
                    <span style="font-size:11px; font-weight:${isSel ? '800' : '600'}; color:${isSel ? '#1C1C1E' : '#8E8E93'}; margin-top:4px; text-align:center;">
                      ${story.nom}
                    </span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- 3. POST INSTAGRAM : CARTE BILAN DE CULTE -->
          <article style="background:#FFF; border-bottom:8px solid #F8F9FA;">
            <!-- En-tête Post -->
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:38px; height:38px; border-radius:19px; background:#007AFF; color:#FFF; font-size:18px; display:flex; align-items:center; justify-content:center;">🎥</div>
                <div>
                  <h3 style="font-size:14px; font-weight:800; margin:0; color:#1C1C1E;">Section Cadrage</h3>
                  <span style="font-size:11px; color:#8E8E93;">Dimanche 02 Août 2026 • Culte n°1</span>
                </div>
              </div>
              <div style="background:#FFFDF0; border:1px solid #E6CA65; padding:5px 10px; border-radius:12px; font-size:10.5px; font-weight:800; color:#B8860B; display:flex; align-items:center; gap:4px;">
                🏆 SECTION VEDETTE
              </div>
            </div>

            <!-- Zone Visuelle Coulisses + Overlay Score Glassmorphism -->
            <div style="width:100%; height:280px; background:linear-gradient(135deg, #1C1C1E 0%, #2C2C2E 100%); position:relative; display:flex; flex-direction:column; justify-content:center; align-items:center;">
              <span style="font-size:52px; margin-bottom:8px;">🎬 🎥 ✨</span>
              <span style="color:rgba(255,255,255,0.7); font-size:12px; font-weight:600;">Coulisses & Captation Directe du Culte</span>

              <!-- Overlay Score Glassmorphism -->
              <div style="position:absolute; bottom:14px; right:14px; background:rgba(255,255,255,0.9); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); padding:6px 12px; border-radius:16px; border:1px solid rgba(255,255,255,0.8); display:flex; align-items:center; gap:5px; box-shadow:0 4px 12px rgba(0,0,0,0.15);">
                <span style="color:#D4AF37; font-size:14px;">★</span>
                <strong style="font-size:14px; color:#1C1C1E;">4.88 / 5.0</strong>
              </div>
            </div>

            <!-- Barre d'interactions Sociales -->
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px;">
              <div style="display:flex; align-items:center; gap:16px;">
                <button onclick="window.toggleBilanLike()" style="background:none; border:none; padding:0; display:flex; align-items:center; gap:6px; cursor:pointer;">
                  <span style="font-size:20px;">${isLikedBilan ? '❤️' : '🤍'}</span>
                  <strong style="font-size:13px; color:#1C1C1E;">${likesBilanCount}</strong>
                </button>

                <button style="background:none; border:none; padding:0; display:flex; align-items:center; gap:6px; cursor:pointer;">
                  <span style="font-size:20px;">💬</span>
                  <strong style="font-size:13px; color:#1C1C1E;">7</strong>
                </button>

                <button style="background:none; border:none; padding:0; cursor:pointer;">
                  <span style="font-size:20px;">↗️</span>
                </button>
              </div>

              <span style="font-size:18px; cursor:pointer;">🔖</span>
            </div>

            <!-- Légende & Story Text -->
            <div style="padding:0 16px 14px;">
              <div style="font-size:13px; font-weight:800; color:#1C1C1E; margin-bottom:4px;">
                Aimé par Sarah Yao et ${likesBilanCount - 1} autres membres
              </div>
              <p style="font-size:13.5px; line-height:1.45; color:#1C1C1E; margin:0;">
                <strong>Section Cadrage</strong> Bravo à toute l'équipe Cadrage pour la couverture dynamique du 1er culte ! Les cadrages serrés et la synchronisation avec la chorale étaient parfaits. 🎬✨
              </p>
              <span style="font-size:12px; color:#8E8E93; display:block; margin-top:6px; cursor:pointer;">
                Voir les 7 débriefings et remarques des responsables...
              </span>
            </div>
          </article>

          <!-- 4. POST INSTAGRAM CLASSIQUE -->
          <article style="background:#FFF; border-bottom:8px solid #F8F9FA;">
            <div style="display:flex; align-items:center; gap:10px; padding:12px 16px;">
              <div style="width:38px; height:38px; border-radius:19px; background:#5856D6; color:#FFF; font-size:18px; display:flex; align-items:center; justify-content:center;">📸</div>
              <div>
                <h3 style="font-size:14px; font-weight:800; margin:0; color:#1C1C1E;">Sarah Yao (Photo)</h3>
                <span style="font-size:11px; color:#8E8E93;">Il y a 3 heures</span>
              </div>
            </div>

            <div style="width:100%; height:220px; background:#2C2C2E; display:flex; align-items:center; justify-content:center; color:#FFF; font-size:42px;">
              📸 📸 📸
            </div>

            <div style="padding:12px 16px;">
              <div style="display:flex; gap:16px; margin-bottom:8px;">
                <span style="font-size:20px; cursor:pointer;">❤️ 29</span>
                <span style="font-size:20px; cursor:pointer;">💬 4</span>
              </div>
              <p style="font-size:13.5px; margin:0; line-height:1.4;">
                <strong>Sarah Yao</strong> Les 150 clichés HD du Culte n°1 sont prêts et importés sur le serveur cloud du Département ! 🚀
              </p>
            </div>
          </article>
        `;
      }

      if (activeTab === 'planning') {
        return `
          <header style="padding:16px 20px; background:#FFF; border-bottom:1px solid #F2F2F7;">
            <p style="font-size:11px; font-weight:800; color:#5856D6; text-transform:uppercase; letter-spacing:1.2px; margin:0 0 2px;">Dimanche 02 Août 2026</p>
            <h1 style="font-size:24px; font-weight:900; color:#1C1C1E; margin:0;">Planning Cultes 📅</h1>
          </header>

          <div style="padding:16px;">
            <div style="background:#FFF4E5; border-radius:20px; padding:16px; margin-bottom:16px; border:1.5px solid #FF9500;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <strong style="color:#FF9500; font-size:15px;">⏳ Transition Culte 1 ➜ Culte 2</strong>
                <span style="background:#FF9500; color:#FFF; padding:4px 9px; border-radius:10px; font-size:13px; font-weight:800;">15:00 min</span>
              </div>
              <p style="font-size:12px; color:#1C1C1E; margin-bottom:12px;">Pause technique de 15 minutes (09h00 à 09h15).</p>
              
              <div style="background:#FFF; padding:12px; border-radius:14px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <strong style="font-size:13px; display:block;">📍 Check-in Rapide</strong>
                  <span style="font-size:11px; color:#8E8E93;">Validez votre arrivée pour Culte 2</span>
                </div>
                <button onclick="window.doCheckIn()" style="background:${isCheckedIn ? '#34C759' : '#007AFF'}; color:#FFF; border:none; padding:8px 14px; border-radius:12px; font-size:12px; font-weight:800; cursor:pointer;">
                  ${isCheckedIn ? '✓ Présent' : 'Valider'}
                </button>
              </div>
            </div>

            <div style="background:#FFF; border-radius:18px; padding:16px; margin-bottom:12px; border:1px solid #E5E5EA;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div><h3 style="font-size:16px; margin:0;">Culte 1</h3><span style="font-size:12px; color:#8E8E93;">07h00 - 09h00</span></div>
                <span style="background:#E5E5EA; color:#8E8E93; padding:4px 8px; border-radius:8px; font-size:11px; font-weight:800;">✓ CLÔTURÉ</span>
              </div>
            </div>

            <div style="background:#FFF; border-radius:18px; padding:16px; margin-bottom:12px; border:1.5px solid #007AFF;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div><h3 style="font-size:16px; margin:0;">Culte 2</h3><span style="font-size:12px; color:#8E8E93;">09h15 - 11h15</span></div>
                <span style="background:#FFF4E5; color:#FF9500; padding:4px 8px; border-radius:8px; font-size:11px; font-weight:800;">⏳ EN TRANSITION</span>
              </div>
            </div>

            <div style="background:#FFF; border-radius:18px; padding:16px; margin-bottom:12px; border:1px solid #E5E5EA;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div><h3 style="font-size:16px; margin:0;">Culte 3</h3><span style="font-size:12px; color:#8E8E93;">11h30 - 13h30</span></div>
                <span style="background:#E5F1FF; color:#007AFF; padding:4px 8px; border-radius:8px; font-size:11px; font-weight:800;">À VENIR</span>
              </div>
            </div>
          </div>
        `;
      }

      if (activeTab === 'debrief') {
        return `
          <header style="padding:16px 20px; background:#FFF; border-bottom:1px solid #F2F2F7;">
            <p style="font-size:11px; font-weight:800; color:#007AFF; text-transform:uppercase; letter-spacing:1.2px; margin:0 0 2px;">Culte du Dimanche 02 Août</p>
            <h1 style="font-size:24px; font-weight:900; color:#1C1C1E; margin:0;">Notation & Débrief 📝</h1>
          </header>

          <div style="padding:16px;">
            <h3 style="font-size:15px; font-weight:800; margin-bottom:8px;">1. Notation Inter-Sections</h3>

            <!-- CADRAGE BLOQUÉ -->
            <div style="background:#F8F8FA; border-radius:16px; padding:14px; margin-bottom:10px; border:1px solid #E1E1E6;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="font-size:14px;">🎥 Section Cadrage</strong>
                <span style="background:#FFEBEA; color:#FF3B30; padding:4px 8px; border-radius:8px; font-size:11px; font-weight:800;">🔒 Auto-notation interdite</span>
              </div>
            </div>

            <!-- AUTRES SECTIONS -->
            ${[
              { id: 'web', nom: 'Web', icon: '🌐' },
              { id: 'proj', nom: 'Projection', icon: '🖥️' },
              { id: 'prod', nom: 'Prod', icon: '🎬' },
              { id: 'regie', nom: 'Régie', icon: '🎛️' },
              { id: 'photo', nom: 'Photo', icon: '📸' },
              { id: 'vente', nom: 'Vente', icon: '🛒' }
            ].map(function(sec) {
              var r = ratings[sec.id] || { score: 4, comment: '' };
              return `
                <div style="background:#FFF; border-radius:16px; padding:14px; margin-bottom:10px; border:1px solid #E5E5EA;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <strong style="font-size:14px;">${sec.icon} Section ${sec.nom}</strong>
                    <div style="display:flex; gap:4px;">
                      ${[1,2,3,4,5].map(function(star) {
                        return `<span onclick="window.setRatingScore('${sec.id}', ${star})" style="font-size:18px; cursor:pointer; color:${star <= r.score ? '#FFD700' : '#D1D1D6'};">★</span>`;
                      }).join('')}
                    </div>
                  </div>
                  <input type="text" value="${r.comment}" placeholder="Ajouter une remarque..." style="width:100%; padding:8px; border-radius:8px; border:1px solid #E5E5EA; font-size:12px; box-sizing:border-box;">
                </div>
              `;
            }).join('')}

            <div style="background:#FFFDF0; border-radius:20px; padding:18px; margin-top:16px; border:1.5px solid #E6CA65;">
              <h3 style="color:#B8860B; margin:0 0 4px; font-size:16px;">👑 Synthèse & Validation</h3>
              <p style="font-size:11px; color:#666; margin-bottom:12px;">Validez et publiez le Bilan 24h sur le Feed Instagram.</p>
              <button onclick="window.publishBilanFeed24h()" style="width:100%; background:#34C759; color:#FFF; border:none; padding:14px; border-radius:14px; font-size:14px; font-weight:900; cursor:pointer;">
                🚀 Valider et Publier le Bilan sur le Feed (24h)
              </button>
            </div>
          </div>
        `;
      }

      if (activeTab === 'halloffame') {
        return `
          <header style="padding:16px 20px; background:#FFF; border-bottom:1px solid #F2F2F7;">
            <p style="font-size:11px; font-weight:800; color:#B8860B; text-transform:uppercase; letter-spacing:1.2px; margin:0 0 2px;">Archives Permanentes</p>
            <h1 style="font-size:24px; font-weight:900; color:#1C1C1E; margin:0;">Espace Vedettes 🌟</h1>
          </header>

          <div style="padding:16px;">
            <div style="background:#FFF; border-radius:18px; padding:16px; margin-bottom:14px; border:1px solid #E5E5EA;">
              <span style="font-size:11px; font-weight:700; color:#8E8E93;">DIMANCHE 02 AOÛT 2026</span>
              <h3 style="font-size:16px; margin:4px 0 10px;">Culte n°1 — Section Vedette</h3>
              <div style="background:#FFFDF0; padding:10px; border-radius:12px; display:flex; justify-content:space-between; align-items:center; border:1px solid #E6CA65;">
                <span>🎥 <strong>Section Cadrage</strong></span>
                <strong style="color:#B8860B;">★ 4.88 / 5.0</strong>
              </div>
            </div>

            <div style="background:#1C1C1E; color:#FFF; border-radius:22px; padding:22px; text-align:center; margin-top:16px;">
              <span style="font-size:46px; display:block; margin-bottom:6px;">🏆</span>
              <span style="font-size:11px; font-weight:800; color:#FFD700; text-transform:uppercase; letter-spacing:1.5px;">TROPHÉE ANNUEL 2025-2026</span>
              <h2 style="font-size:22px; margin:6px 0;">🎛️ Section Régie Technique</h2>
              <p style="font-size:12px; color:rgba(255,255,255,0.75);">Meilleure section de l'année (4.96/5.0 de moyenne).</p>
            </div>
          </div>
        `;
      }

      if (activeTab === 'profile') {
        return `
          <header style="padding:16px 20px; background:#FFF; border-bottom:1px solid #F2F2F7;">
            <p style="font-size:11px; font-weight:800; color:#007AFF; text-transform:uppercase; letter-spacing:1.2px; margin:0 0 2px;">Département Communication</p>
            <h1 style="font-size:24px; font-weight:900; color:#1C1C1E; margin:0;">Mon Profil 👤</h1>
          </header>

          <div style="padding:16px;">
            <div style="background:#FFF; border-radius:22px; padding:20px; text-align:center; margin-bottom:16px; border:1px solid #E5E5EA;">
              <div style="width:72px; height:72px; border-radius:36px; background:#E5F1FF; color:#007AFF; font-size:30px; font-weight:800; display:flex; align-items:center; justify-content:center; margin:0 auto 10px; border:3px solid #007AFF;">É</div>
              <h2 style="font-size:20px; margin:0;">Éric Kouamé</h2>
              <p style="font-size:13px; color:#8E8E93; margin-top:2px;">RESP_SECTION • Section Cadrage</p>
            </div>

            <div style="background:#FFF; border-radius:22px; padding:20px; margin-bottom:16px; border:1px solid #E5E5EA;">
              <h3 style="font-size:12px; font-weight:800; color:#8E8E93; text-transform:uppercase; text-align:center; margin-bottom:14px; letter-spacing:0.8px;">Indice de Confiance (Trust Score)</h3>
              
              <div style="display:flex; justify-content:space-around; align-items:center;">
                <div style="width:90px; height:90px; border-radius:45px; border:6px solid #34C759; background:#E8F9ED; display:flex; flex-direction:column; align-items:center; justify-content:center;">
                  <strong style="font-size:22px; color:#34C759;">98.5%</strong>
                  <span style="font-size:9px; color:#34C759; font-weight:800;">Fiabilité</span>
                </div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                  <div style="background:#F2F2F7; padding:8px 12px; border-radius:10px; font-size:13px;">
                    <strong>45 Services</strong> <span style="font-size:11px; color:#8E8E93;">effectués</span>
                  </div>
                  <div style="background:#F2F2F7; padding:8px 12px; border-radius:10px; font-size:13px;">
                    <strong>4.88 / 5.0 ★</strong> <span style="font-size:11px; color:#8E8E93;">note moyenne</span>
                  </div>
                </div>
              </div>
            </div>

            <button onclick="alert('📅 Agenda du téléphone synchronisé avec les 3 prochains cultes !')" style="width:100%; background:#007AFF; color:#FFF; border:none; padding:14px; border-radius:14px; font-size:13.5px; font-weight:800; cursor:pointer;">
              📅 Synchroniser avec l'agenda du téléphone
            </button>
          </div>
        `;
      }

      return '<div>Rendu de l\'écran...</div>';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
