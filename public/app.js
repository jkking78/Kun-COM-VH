// ==============================================================================
// APPLICATION WEB PURE PWA - DÉPARTEMENT COMMUNICATION (KUN COM VH)
// Framework React Web Autonome & Responsive iOS Container
// ==============================================================================

(function() {
  console.log("🚀 Lancement de l'application Web Pure Kun COM VH...");

  // ETAT GLOBAL
  var activeTab = 'home';
  var userRole = 'RESP_SECTION'; // 'GRAND_RESPONSABLE', 'RESP_SECTION', 'MEMBRE'
  var userSectionId = 'cadrage'; // Section de l'utilisateur connecté (Cadrage)
  var selectedSectionFilter = 'all';
  var isCheckedIn = false;
  
  // Scores de notation inter-sections
  var ratings = {
    web: { score: 5, comment: 'Direct streaming HD fluide' },
    proj: { score: 4, comment: 'Textes affichés dans les temps' },
    prod: { score: 4, comment: 'Transitions vidéo soignées' },
    regie: { score: 5, comment: 'Mixage acoustique excellent' },
    photo: { score: 4, comment: 'Tri rapide des photos' },
    vente: { score: 4, comment: 'Support CD/USB prêts' }
  };

  // Initialisation au chargement du DOM
  function initApp() {
    var root = document.getElementById('root');
    if (!root) return;

    render();

    function render() {
      root.innerHTML = `
        <div style="display:flex; flex-direction:column; height:100%; width:100%; position:relative; background-color:#F2F2F7; font-family:-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif;">
          
          <!-- ÉCRAN ACTIF SCROLLABLE -->
          <div style="flex:1; overflow-y:auto; padding-bottom:85px; -webkit-overflow-scrolling:touch;">
            ${renderScreen()}
          </div>

          <!-- BOTTOM TAB BAR iOS (5 ONGLETS) -->
          <nav style="position:absolute; bottom:0; left:0; right:0; height:75px; background:rgba(255,255,255,0.95); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); border-top:1px solid #E5E5EA; display:flex; justify-style:space-around; justify-content:space-around; align-items:center; z-index:99999;">
            <button onclick="window.setTab('home')" style="${tabBtnStyle(activeTab === 'home')}">
              <span style="font-size:20px;">🏠</span>
              <span style="${tabLabelStyle(activeTab === 'home')}">Accueil</span>
            </button>

            <button onclick="window.setTab('planning')" style="${tabBtnStyle(activeTab === 'planning')}">
              <span style="font-size:20px;">📅</span>
              <span style="${tabLabelStyle(activeTab === 'planning')}">Planning</span>
            </button>

            <!-- BOUTON CENTRAL + SURÉLEVÉ -->
            <button onclick="window.setTab('debrief')" style="width:52px; height:52px; border-radius:26px; background-color:#007AFF; color:#FFF; border:none; font-size:26px; display:flex; align-items:center; justify-content:center; margin-top:-24px; box-shadow:0 6px 16px rgba(0,122,255,0.4); cursor:pointer;">
              +
            </button>

            <button onclick="window.setTab('halloffame')" style="${tabBtnStyle(activeTab === 'halloffame')}">
              <span style="font-size:20px;">🌟</span>
              <span style="${tabLabelStyle(activeTab === 'halloffame')}">Vedettes</span>
            </button>

            <button onclick="window.setTab('profile')" style="${tabBtnStyle(activeTab === 'profile')}">
              <span style="font-size:20px;">👤</span>
              <span style="${tabLabelStyle(activeTab === 'profile')}">Profil</span>
            </button>
          </nav>
        </div>
      `;
    }

    // Handlers Globaux
    window.setTab = function(t) { activeTab = t; render(); };
    window.setRole = function(r) { userRole = r; render(); };
    window.toggleRoleCycle = function() {
      if (userRole === 'RESP_SECTION') userRole = 'MEMBRE';
      else if (userRole === 'MEMBRE') userRole = 'GRAND_RESPONSABLE';
      else userRole = 'RESP_SECTION';
      render();
    };
    window.setFilter = function(f) { selectedSectionFilter = f; render(); };
    window.doCheckIn = function() {
      isCheckedIn = true;
      alert("✅ Présence validée pour le Culte !");
      render();
    };
    window.setRatingScore = function(secId, score) {
      if (secId === userSectionId) {
        alert("🔒 Action Interdite : Vous ne pouvez pas noter votre propre section !");
        return;
      }
      ratings[secId].score = score;
      render();
    };
    window.publishBilanFeed24h = function() {
      alert("🚀 Bilan de Culte Validé et Publié sur le Feed (24h) !\n\n🏆 Section Vedette attribuée : Cadrage 🎥 (4.88 / 5.0)\n⏰ Expiration : Demain à la même heure.");
      activeTab = 'home';
      render();
    };

    function tabBtnStyle(active) {
      return 'background:none; border:none; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; padding:4px 8px; opacity:' + (active ? 1 : 0.6) + '; transition:opacity 0.2s ease;';
    }
    function tabLabelStyle(active) {
      return 'font-size:11px; font-weight:' + (active ? '800' : '600') + '; color:' + (active ? '#007AFF' : '#8E8E93') + '; margin-top:2px;';
    }

    // RENDU DES 5 ÉCRANS
    function renderScreen() {
      // ÉCRAN 1: ACCUEIL & FEED 24H
      if (activeTab === 'home') {
        var isManager = (userRole === 'GRAND_RESPONSABLE' || userRole === 'RESP_SECTION');
        
        return `
          <header style="padding:48px 20px 14px; background:#FFF; border-bottom:1px solid #E5E5EA; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <p style="font-size:11px; font-weight:700; color:#007AFF; text-transform:uppercase; letter-spacing:1.2px; margin:0 0 2px;">Département Communication</p>
              <h1 style="font-size:28px; font-weight:800; color:#1C1C1E; margin:0;">Accueil</h1>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <button onclick="window.toggleRoleCycle()" style="background:#E5F1FF; border:1px solid rgba(0,122,255,0.3); padding:6px 10px; border-radius:12px; font-size:11px; font-weight:700; color:#007AFF; cursor:pointer;">
                👤 ${userRole}
              </button>
              <div style="width:38px; height:38px; border-radius:19px; background:#F2F2F7; display:flex; align-items:center; justify-content:center; position:relative;">
                🔔<span style="position:absolute; top:7px; right:7px; width:8px; height:8px; border-radius:4px; background:#FF3B30;"></span>
              </div>
            </div>
          </header>

          <!-- FILTRE SECTIONS CARROUSEL -->
          <div style="background:#FFF; padding:10px 16px; border-bottom:1px solid #E5E5EA; overflow-x:auto; display:flex; gap:8px; white-space:nowrap;">
            ${['Toutes', 'Web', 'Projection', 'Prod', 'Régie', 'Cadrage', 'Photo', 'Vente'].map(function(sec) {
              var secId = sec.toLowerCase();
              var active = selectedSectionFilter === secId || (sec === 'Toutes' && selectedSectionFilter === 'all');
              return `<button onclick="window.setFilter('${sec === 'Toutes' ? 'all' : secId}')" style="padding:7px 14px; border-radius:16px; font-size:12px; font-weight:${active ? '800' : '600'}; border:none; background:${active ? '#007AFF' : '#F2F2F7'}; color:${active ? '#FFF' : '#8E8E93'}; cursor:pointer;">${sec}</button>`;
            }).join('')}
          </div>

          <div style="padding:16px;">
            <!-- CARTE BILAN DE CULTE (24H ÉPHÉMÈRE) -->
            <div style="background:#FFF; border-radius:20px; padding:18px; margin-bottom:18px; border:1.5px solid rgba(255,215,0,0.6); box-shadow:0 6px 16px rgba(212,175,55,0.15);">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                <div>
                  <span style="font-size:11px; font-weight:700; color:#8E8E93; text-transform:uppercase;">DIMANCHE 02 AOÛT 2026</span>
                  <h2 style="font-size:20px; font-weight:800; margin:2px 0 0;">Bilan Culte n°1</h2>
                </div>
                <div style="background:#FFF9E6; border:1px solid #FFC107; padding:5px 10px; border-radius:12px; font-size:11px; font-weight:800; color:#B8860B; display:flex; align-items:center; gap:4px;">
                  🏆 CADRAGE VEDETTE
                </div>
              </div>

              <!-- BANDEAU SÉCURITÉ MASQUAGE DYNAMIQUE -->
              <div style="background:rgba(0,122,255,0.08); padding:8px 12px; border-radius:12px; font-size:11px; color:#007AFF; font-weight:600; margin-bottom:12px;">
                🔒 Rôle actif : <strong>${userRole}</strong> ${isManager ? '— Mode Responsable (Accès complet)' : '— Masquage des notes confidentielles actif'}
              </div>

              <!-- LISTE DES NOTES AVEC CONFIDENTIALITÉ -->
              <div style="display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #F2F2F7; font-size:13px;">
                  <div><strong>Sarah Yao</strong> <small style="color:#8E8E93;">(MEMBRE)</small></div>
                  <div><strong style="color:#FFD700;">★</strong> 4.5 / 5.0 <small style="color:#34C759; font-weight:700; margin-left:4px;">Public</small></div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #F2F2F7; font-size:13px;">
                  <div><strong>Éric Kouamé</strong> <small style="color:#8E8E93;">(RESP_SECTION)</small></div>
                  <div>
                    ${isManager 
                      ? '<strong style="color:#FFD700;">★</strong> 4.8 / 5.0 <small style="color:#007AFF; font-weight:700; margin-left:4px;">Poids 3 (Confidentiel)</small>' 
                      : '<span style="color:#8E8E93; font-size:11px; font-style:italic;">🔒 Note confidentielle responsable</span>'}
                  </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #F2F2F7; font-size:13px;">
                  <div><strong>Pasteur Daniel</strong> <small style="color:#8E8E93;">(GRAND_RESPONSABLE)</small></div>
                  <div>
                    ${isManager 
                      ? '<strong style="color:#FFD700;">★</strong> 5.0 / 5.0 <small style="color:#007AFF; font-weight:700; margin-left:4px;">Poids 5 (Confidentiel)</small>' 
                      : '<span style="color:#8E8E93; font-size:11px; font-style:italic;">🔒 Note confidentielle responsable</span>'}
                  </div>
                </div>
              </div>

              <div style="margin-top:12px; padding-top:10px; border-top:1px solid #E5E5EA; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:12px; font-weight:700; color:#8E8E93;">Moyenne Pondérée Active</span>
                <strong style="font-size:16px; font-weight:900; color:#1C1C1E;">4.88 / 5.0 ★</strong>
              </div>
            </div>

            <!-- PUBLICATIONS CLASSIQUES -->
            <h3 style="font-size:18px; font-weight:800; margin-bottom:12px;">Publications & Débriefs</h3>

            <div style="background:#FFF; border-radius:18px; padding:16px; margin-bottom:16px; border:1px solid #E5E5EA; box-shadow:0 4px 10px rgba(0,0,0,0.04);">
              <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                <div style="width:36px; height:36px; border-radius:18px; background:#007AFF; color:#FFF; font-weight:800; display:flex; align-items:center; justify-content:center;">É</div>
                <div>
                  <h4 style="font-size:14px; margin:0;">Éric Kouamé (Resp Cadrage)</h4>
                  <span style="font-size:11px; color:#8E8E93;">Il y a 2 heures • Section Cadrage</span>
                </div>
              </div>
              <p style="font-size:13.5px; line-height:1.45; color:#1C1C1E; margin-bottom:12px;">
                Bravo à toute l'équipe Cadrage pour la captation directe du 1er culte ! Les plans serrés sur la chorale étaient parfaitement synchronisés.
              </p>
              <div style="display:flex; justify-content:space-between; border-top:1px solid #F2F2F7; padding-top:10px; font-size:12.5px; color:#8E8E93;">
                <span>❤️ 14 Likes</span>
                <span>💬 3 Commentaires</span>
                <span>↗️ Partager</span>
              </div>
            </div>
          </div>
        `;
      }

      // ÉCRAN 2: PLANNING CULTES (07h-09h, 09h15-11h15, 11h30-13h30 & 15 MIN TRANSITION)
      if (activeTab === 'planning') {
        return `
          <header style="padding:48px 20px 14px; background:#FFF; border-bottom:1px solid #E5E5EA;">
            <p style="font-size:11px; font-weight:700; color:#5856D6; text-transform:uppercase; letter-spacing:1.2px; margin:0 0 2px;">Dimanche 02 Août 2026</p>
            <h1 style="font-size:28px; font-weight:800; color:#1C1C1E; margin:0;">Planning Cultes</h1>
          </header>

          <div style="padding:16px;">
            <!-- MODE TRANSITION 15 MINUTES -->
            <div style="background:#FFF4E5; border-radius:18px; padding:16px; margin-bottom:18px; border:1.5px solid #FF9500; box-shadow:0 4px 12px rgba(255,149,0,0.12);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <strong style="color:#FF9500; font-size:15px;">⏳ Transition Culte 1 ➜ Culte 2</strong>
                <span style="background:#FF9500; color:#FFF; padding:4px 9px; border-radius:10px; font-size:13px; font-weight:800;">14:45 min</span>
              </div>
              <p style="font-size:12px; color:#1C1C1E; margin-bottom:12px;">Pause technique de 15 minutes entre le 1er et le 2nd service (09h00 à 09h15).</p>
              
              <div style="background:#FFF; padding:12px; border-radius:14px; display:flex; justify-content:space-between; align-items:center; border:1px solid rgba(255,149,0,0.3);">
                <div>
                  <strong style="font-size:13px; display:block;">📍 Check-in Rapide Presence</strong>
                  <span style="font-size:11px; color:#8E8E93;">Validez votre arrivée pour Culte 2</span>
                </div>
                <button onclick="window.doCheckIn()" style="background:${isCheckedIn ? '#34C759' : '#007AFF'}; color:#FFF; border:none; padding:8px 14px; border-radius:12px; font-size:12px; font-weight:800; cursor:pointer;">
                  ${isCheckedIn ? '✓ Présent' : 'Valider'}
                </button>
              </div>
            </div>

            <!-- CARTES DES 3 CULTES AUX HORAIRES RÉELS -->
            <div style="background:#FFF; border-radius:18px; padding:16px; margin-bottom:14px; border:1px solid #E5E5EA;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div>
                  <h3 style="font-size:18px; font-weight:800; margin:0;">Culte 1 — Premier Service</h3>
                  <span style="font-size:12px; color:#8E8E93;">Horaires : 07h00 - 09h00</span>
                </div>
                <span style="background:#E5E5EA; color:#8E8E93; padding:4px 8px; border-radius:8px; font-size:11px; font-weight:800;">✓ CLÔTURÉ</span>
              </div>
              <div style="background:#F2F2F7; padding:8px 12px; border-radius:10px; font-size:12px; color:#1C1C1E;">
                🎥 Cadrage: Éric K. (Resp), Marc T. • 🎛️ Régie: Jean-Luc P.
              </div>
            </div>

            <div style="background:#FFF; border-radius:18px; padding:16px; margin-bottom:14px; border:1.5px solid #007AFF;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div>
                  <h3 style="font-size:18px; font-weight:800; margin:0;">Culte 2 — Second Service</h3>
                  <span style="font-size:12px; color:#8E8E93;">Horaires : 09h15 - 11h15</span>
                </div>
                <span style="background:#FFF4E5; color:#FF9500; padding:4px 8px; border-radius:8px; font-size:11px; font-weight:800;">⏳ EN TRANSITION</span>
              </div>
              <div style="background:#F2F2F7; padding:8px 12px; border-radius:10px; font-size:12px; color:#1C1C1E;">
                🎥 Cadrage: Marc T., Alain B. • 📸 Photo: Sarah Y.
              </div>
            </div>

            <div style="background:#FFF; border-radius:18px; padding:16px; margin-bottom:14px; border:1px solid #E5E5EA;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div>
                  <h3 style="font-size:18px; font-weight:800; margin:0;">Culte 3 — Célébration</h3>
                  <span style="font-size:12px; color:#8E8E93;">Horaires : 11h30 - 13h30</span>
                </div>
                <span style="background:#E5F1FF; color:#007AFF; padding:4px 8px; border-radius:8px; font-size:11px; font-weight:800;">À VENIR</span>
              </div>
              <div style="background:#F2F2F7; padding:8px 12px; border-radius:10px; font-size:12px; color:#1C1C1E;">
                🎬 Prod: Michel N. • 🎛️ Régie: Yves K.
              </div>
            </div>
          </div>
        `;
      }

      // ÉCRAN 3: NOTATION & DÉBRIEFING (RÈGLE BLOQUANTE AUTO-NOTATION)
      if (activeTab === 'debrief') {
        var isGrandResp = (userRole === 'GRAND_RESPONSABLE');

        return `
          <header style="padding:48px 20px 14px; background:#FFF; border-bottom:1px solid #E5E5EA;">
            <p style="font-size:11px; font-weight:700; color:#007AFF; text-transform:uppercase; letter-spacing:1.2px; margin:0 0 2px;">Culte du Dimanche 02 Août</p>
            <h1 style="font-size:28px; font-weight:800; color:#1C1C1E; margin:0;">Notation & Débrief</h1>
          </header>

          <div style="padding:16px;">
            <h3 style="font-size:16px; font-weight:800; margin-bottom:4px;">1. Notation Inter-Sections</h3>
            <p style="font-size:12px; color:#8E8E93; margin-bottom:14px;">Évaluez la prestation des autres sections. Votre propre section est verrouillée.</p>

            <!-- SECTION CADRAGE (PROPRE SECTION BLOQUÉE) -->
            <div style="background:#F8F8FA; border-radius:16px; padding:14px; margin-bottom:12px; border:1px solid #E1E1E6; opacity:0.85;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="font-size:15px;">🎥 Section Cadrage</strong>
                <span style="background:#FFEBEA; color:#FF3B30; padding:4px 8px; border-radius:8px; font-size:11px; font-weight:800; border:1px solid rgba(255,59,48,0.2);">🔒 Auto-notation interdite</span>
              </div>
            </div>

            <!-- LES AUTRES SECTIONS ÉVALUABLES -->
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
                <div style="background:#FFF; border-radius:16px; padding:14px; margin-bottom:12px; border:1px solid #E5E5EA;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <strong style="font-size:15px;">${sec.icon} Section ${sec.nom}</strong>
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

            <!-- FORMULAIRE DÉBRIEFING -->
            <h3 style="font-size:16px; font-weight:800; margin:16px 0 6px;">2. Débriefing Technique</h3>
            <div style="background:#FFF; border-radius:18px; padding:16px; margin-bottom:18px; border:1px solid #E5E5EA;">
              <label style="font-size:12px; font-weight:700; display:block; margin-bottom:6px;">🟢 Ce qui a bien fonctionné aujourd'hui (Points forts)</label>
              <textarea style="width:100%; padding:10px; border-radius:10px; border:1px solid #E5E5EA; font-size:12px; min-height:60px; box-sizing:border-box; margin-bottom:12px;">Superbe réactivité de l'équipe Cadrage sur le prêche. Son régie propre.</textarea>

              <label style="font-size:12px; font-weight:700; display:block; margin-bottom:6px;">🟠 Ce qui est à améliorer pour le prochain culte</label>
              <textarea style="width:100%; padding:10px; border-radius:10px; border:1px solid #E5E5EA; font-size:12px; min-height:60px; box-sizing:border-box;">Prévoir un câble HDMI de secours en régie 15 min avant le début.</textarea>
            </div>

            <!-- SYNTHÈSE ET PUBLICATION 24H (GRAND_RESPONSABLE) -->
            ${isGrandResp ? `
              <div style="background:#FFF9E6; border-radius:20px; padding:18px; border:1.5px solid #FFC107; box-shadow:0 6px 16px rgba(212,175,55,0.15);">
                <h3 style="color:#B8860B; margin:0 0 4px; font-size:17px;">👑 Synthèse & Validation (Grand Responsable)</h3>
                <p style="font-size:11px; color:#666; margin-bottom:14px;">Moyennes pondérées calculées (Poids 5 Grand Resp, Poids 3 Resp, Poids 1 Membre).</p>

                <button onclick="window.publishBilanFeed24h()" style="width:100%; background:#34C759; color:#FFF; border:none; padding:14px; border-radius:14px; font-size:14px; font-weight:900; cursor:pointer;">
                  🚀 Valider et Publier le Bilan sur le Feed (24h)
                </button>
              </div>
            ` : `
              <div style="background:#F8F8FA; border-radius:16px; padding:14px; text-align:center; color:#8E8E93; font-size:12px; border:1px solid #E1E1E6;">
                🔒 La publication du Bilan 24h sur le Feed est réservée au Grand Responsable.
              </div>
            `}
          </div>
        `;
      }

      // ÉCRAN 4: ESPACE VEDETTES (ARCHIVES PERMANENTES 24H+)
      if (activeTab === 'halloffame') {
        return `
          <header style="padding:48px 20px 14px; background:#FFF; border-bottom:1px solid #E5E5EA;">
            <p style="font-size:11px; font-weight:700; color:#B8860B; text-transform:uppercase; letter-spacing:1.2px; margin:0 0 2px;">Archives Permanentes (Post-24h)</p>
            <h1 style="font-size:28px; font-weight:800; color:#1C1C1E; margin:0;">Espace Vedettes 🌟</h1>
          </header>

          <div style="padding:16px;">
            <div style="background:#FFF; border-radius:18px; padding:16px; margin-bottom:14px; border:1px solid #E5E5EA;">
              <span style="font-size:11px; font-weight:700; color:#8E8E93;">DIMANCHE 02 AOÛT 2026</span>
              <h3 style="font-size:17px; margin:4px 0 10px;">Culte n°1 — Section Vedette</h3>
              <div style="background:#FFF9E6; padding:10px; border-radius:12px; display:flex; justify-content:space-between; align-items:center; border:1px solid #FFC107;">
                <span>🎥 <strong>Section Cadrage</strong></span>
                <strong style="color:#B8860B;">★ 4.88 / 5.0</strong>
              </div>
            </div>

            <div style="background:#FFF; border-radius:18px; padding:16px; margin-bottom:14px; border:1px solid #E5E5EA;">
              <span style="font-size:11px; font-weight:700; color:#8E8E93;">DIMANCHE 26 JUILLET 2026</span>
              <h3 style="font-size:17px; margin:4px 0 10px;">Culte n°2 — Section Vedette</h3>
              <div style="background:#FFF9E6; padding:10px; border-radius:12px; display:flex; justify-content:space-between; align-items:center; border:1px solid #FFC107;">
                <span>🎛️ <strong>Section Régie Technique</strong></span>
                <strong style="color:#B8860B;">★ 4.95 / 5.0</strong>
              </div>
            </div>

            <div style="background:#1C1C1E; color:#FFF; border-radius:22px; padding:22px; text-align:center; margin-top:20px; box-shadow:0 8px 20px rgba(0,0,0,0.3);">
              <span style="font-size:48px; display:block; margin-bottom:6px;">🏆</span>
              <span style="font-size:11px; font-weight:800; color:#FFD700; text-transform:uppercase; letter-spacing:1.5px;">TROPHÉE ANNUEL 2025-2026</span>
              <h2 style="font-size:24px; margin:6px 0;">🎛️ Section Régie Technique</h2>
              <p style="font-size:12px; color:rgba(255,255,255,0.75);">Meilleure section de l'année (4.96/5.0 de moyenne cumulée).</p>
            </div>
          </div>
        `;
      }

      // ÉCRAN 5: PROFIL & TRUST SCORE
      if (activeTab === 'profile') {
        return `
          <header style="padding:48px 20px 14px; background:#FFF; border-bottom:1px solid #E5E5EA;">
            <p style="font-size:11px; font-weight:700; color:#007AFF; text-transform:uppercase; letter-spacing:1.2px; margin:0 0 2px;">Département Communication</p>
            <h1 style="font-size:28px; font-weight:800; color:#1C1C1E; margin:0;">Mon Profil</h1>
          </header>

          <div style="padding:16px;">
            <div style="background:#FFF; border-radius:20px; padding:20px; text-align:center; margin-bottom:16px; border:1px solid #E5E5EA;">
              <div style="width:72px; height:72px; border-radius:36px; background:#E5F1FF; color:#007AFF; font-size:30px; font-weight:800; display:flex; align-items:center; justify-content:center; margin:0 auto 10px; border:3px solid #007AFF;">É</div>
              <h2 style="font-size:20px; margin:0;">Éric Kouamé</h2>
              <p style="font-size:13px; color:#8E8E93; margin-top:2px;">RESP_SECTION • Section Cadrage</p>
            </div>

            <!-- JAUGE CIRCULAIRE TRUST SCORE -->
            <div style="background:#FFF; border-radius:20px; padding:18px; margin-bottom:16px; border:1px solid #E5E5EA;">
              <h3 style="font-size:12px; font-weight:800; color:#8E8E93; text-transform:uppercase; text-align:center; margin-bottom:14px; letter-spacing:0.8px;">Indice de Confiance (Trust Score)</h3>
              
              <div style="display:flex; justify-style:space-around; justify-content:space-around; align-items:center;">
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

            <button onclick="alert('📅 Vos 3 prochains services cultes de Dimanche ont été ajoutés à l\'agenda de votre téléphone !')" style="width:100%; background:#007AFF; color:#FFF; border:none; padding:14px; border-radius:14px; font-size:13.5px; font-weight:800; margin-bottom:10px; cursor:pointer;">
              📅 Synchroniser avec l'agenda du téléphone
            </button>

            <button onclick="alert('⚙️ Disponibilités configurées : DISPONIBLE TOUS LES DIMANCHE AUST.')" style="width:100%; background:#F0EFFF; color:#5856D6; border:1px solid rgba(88,86,214,0.3); padding:14px; border-radius:14px; font-size:13.5px; font-weight:800; cursor:pointer;">
              ⚙️ Gérer mes disponibilités de culte
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
