// Bundle Executable Frontend App - Kun COM VH
(function() {
  console.log("🚀 Lancement du Bundle App Web & PWA (Kun COM VH)...");

  // Variables d'état global
  var activeTab = 'home';
  var userRole = 'RESP_SECTION'; // 'GRAND_RESPONSABLE', 'RESP_SECTION', 'MEMBRE'
  var isCheckedIn = false;

  function initApp() {
    var root = document.getElementById('root');
    if (!root) {
      console.error("❌ Élément #root introuvable");
      return;
    }

    render();

    function render() {
      root.innerHTML = `
        <div style="display:flex; flex-direction:column; height:100%; width:100%; position:relative; background-color:#F2F2F7; font-family:-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;">
          
          <!-- ÉCRAN ACTIF SCROLLABLE -->
          <div style="flex:1; overflow-y:auto; padding-bottom:80px; -webkit-overflow-scrolling:touch;">
            ${getScreenHTML()}
          </div>

          <!-- BOTTOM TAB BAR iOS (5 ONGLETS) -->
          <nav style="position:absolute; bottom:0; left:0; right:0; height:75px; background:rgba(255,255,255,0.96); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); border-top:1px solid #E5E5EA; display:flex; justify-content:space-around; align-items:center; z-index:99999;">
            <button onclick="window.navTab('home')" style="${tabStyle(activeTab === 'home')}">
              <span style="font-size:20px;">🏠</span>
              <span style="${textStyle(activeTab === 'home')}">Accueil</span>
            </button>

            <button onclick="window.navTab('planning')" style="${tabStyle(activeTab === 'planning')}">
              <span style="font-size:20px;">📅</span>
              <span style="${textStyle(activeTab === 'planning')}">Planning</span>
            </button>

            <!-- BOUTON CENTRAL SURÉLEVÉ -->
            <button onclick="window.navTab('debrief')" style="width:52px; height:52px; border-radius:26px; background-color:#007AFF; color:#FFF; border:none; font-size:26px; display:flex; align-items:center; justify-content:center; margin-top:-24px; box-shadow:0 6px 16px rgba(0,122,255,0.4); cursor:pointer;">
              +
            </button>

            <button onclick="window.navTab('halloffame')" style="${tabStyle(activeTab === 'halloffame')}">
              <span style="font-size:20px;">🌟</span>
              <span style="${textStyle(activeTab === 'halloffame')}">Vedettes</span>
            </button>

            <button onclick="window.navTab('profile')" style="${tabStyle(activeTab === 'profile')}">
              <span style="font-size:20px;">👤</span>
              <span style="${textStyle(activeTab === 'profile')}">Profil</span>
            </button>
          </nav>
        </div>
      `;
    }

    // Handlers d'interaction globaux sur window
    window.navTab = function(t) {
      activeTab = t;
      render();
    };

    window.switchRole = function() {
      if (userRole === 'RESP_SECTION') userRole = 'MEMBRE';
      else if (userRole === 'MEMBRE') userRole = 'GRAND_RESPONSABLE';
      else userRole = 'RESP_SECTION';
      render();
    };

    window.doCheckInNow = function() {
      isCheckedIn = true;
      alert("✅ Présence validée pour le Culte 2 !");
      render();
    };

    window.publishBilanFeed = function() {
      alert("🚀 Bilan de Culte Validé et Publié sur le Feed (24h) !\n\nSection Vedette du Jour : Cadrage 🎥 (4.88 / 5.0)");
      activeTab = 'home';
      render();
    };

    function tabStyle(active) {
      return 'background:none; border:none; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; padding:4px 8px; opacity:' + (active ? 1 : 0.6) + ';';
    }
    function textStyle(active) {
      return 'font-size:11px; font-weight:' + (active ? '800' : '600') + '; color:' + (active ? '#007AFF' : '#8E8E93') + '; margin-top:2px;';
    }

    function getScreenHTML() {
      if (activeTab === 'home') {
        return `
          <header style="padding:45px 20px 15px; background:#FFF; border-bottom:1px solid #E5E5EA; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <p style="font-size:11px; font-weight:700; color:#007AFF; text-transform:uppercase; margin:0 0 2px;">Département Communication</p>
              <h1 style="font-size:26px; font-weight:800; color:#1C1C1E; margin:0;">Accueil</h1>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <button onclick="window.switchRole()" style="background:#E5F1FF; border:1px solid rgba(0,122,255,0.3); padding:6px 10px; border-radius:12px; font-size:11px; font-weight:700; color:#007AFF; cursor:pointer;">
                👤 ${userRole}
              </button>
              <div style="width:36px; height:36px; border-radius:18px; background:#F2F2F7; display:flex; align-items:center; justify-content:center; position:relative;">
                🔔<span style="position:absolute; top:6px; right:6px; width:8px; height:8px; border-radius:4px; background:#FF3B30;"></span>
              </div>
            </div>
          </header>

          <div style="padding:16px;">
            <!-- CARTE BILAN 24H -->
            <div style="background:#FFF; border-radius:20px; padding:18px; margin-bottom:16px; border:1px solid rgba(255,215,0,0.6); box-shadow:0 4px 14px rgba(212,175,55,0.15);">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                <div>
                  <span style="font-size:11px; font-weight:700; color:#8E8E93; text-transform:uppercase;">DIMANCHE 02 AOÛT 2026</span>
                  <h2 style="font-size:19px; font-weight:800; margin:2px 0 0;">Bilan Culte n°1</h2>
                </div>
                <div style="background:#FFF9E6; border:1px solid #FFC107; padding:5px 10px; border-radius:12px; font-size:11px; font-weight:800; color:#B8860B;">
                  🏆 CADRAGE VEDETTE
                </div>
              </div>

              <div style="background:rgba(0,122,255,0.08); padding:8px 12px; border-radius:12px; font-size:11px; color:#007AFF; font-weight:600; margin-bottom:12px;">
                🔒 Vue Rôle : <strong>${userRole}</strong> ${userRole === 'MEMBRE' ? '(Notes confidentielles masquées)' : '(Accès complet responsable)'}
              </div>

              <div style="display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #F2F2F7; font-size:13px;">
                  <span><strong>Sarah Yao</strong> <small style="color:#8E8E93;">(MEMBRE)</small></span>
                  <span><strong style="color:#FFD700;">★</strong> 4.5 / 5.0 <small style="color:#34C759;">Public</small></span>
                </div>
                <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #F2F2F7; font-size:13px;">
                  <span><strong>Éric Kouamé</strong> <small style="color:#8E8E93;">(RESP_SECTION)</small></span>
                  <span>${userRole === 'MEMBRE' ? '<em style="color:#8E8E93; font-size:11px;">🔒 Confidentiel</em>' : '<strong style="color:#FFD700;">★</strong> 4.8 / 5.0 <small style="color:#007AFF;">Poids 3</small>'}</span>
                </div>
              </div>

              <div style="margin-top:12px; padding-top:10px; border-top:1px solid #E5E5EA; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:12px; font-weight:700; color:#8E8E93;">Moyenne Pondérée Active</span>
                <strong style="font-size:16px; font-weight:900;">4.88 / 5.0 ★</strong>
              </div>
            </div>

            <!-- FEED CLASSIQUE -->
            <h3 style="font-size:17px; font-weight:800; margin-bottom:10px;">Publications & Débriefs</h3>
            <div style="background:#FFF; border-radius:18px; padding:16px; border:1px solid #E5E5EA;">
              <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                <div style="width:34px; height:34px; border-radius:17px; background:#007AFF; color:#FFF; font-weight:800; display:flex; align-items:center; justify-content:center;">É</div>
                <div>
                  <h4 style="font-size:13px; margin:0;">Éric Kouamé (Resp Cadrage)</h4>
                  <span style="font-size:11px; color:#8E8E93;">Il y a 2h • Cadrage</span>
                </div>
              </div>
              <p style="font-size:13px; line-height:1.4; color:#1C1C1E; margin-bottom:10px;">
                Bravo à toute l'équipe Cadrage pour la captation directe du 1er culte ! Les plans serrés sur la chorale étaient parfaitement synchronisés.
              </p>
              <div style="display:flex; justify-content:space-between; border-top:1px solid #F2F2F7; padding-top:8px; font-size:12px; color:#8E8E93;">
                <span>❤️ 14 Likes</span>
                <span>💬 3 Comm.</span>
                <span>↗️ Partager</span>
              </div>
            </div>
          </div>
        `;
      }

      if (activeTab === 'planning') {
        return `
          <header style="padding:45px 20px 15px; background:#FFF; border-bottom:1px solid #E5E5EA;">
            <p style="font-size:11px; font-weight:700; color:#5856D6; text-transform:uppercase; margin:0 0 2px;">Dimanche 02 Août 2026</p>
            <h1 style="font-size:26px; font-weight:800; color:#1C1C1E; margin:0;">Planning Cultes</h1>
          </header>

          <div style="padding:16px;">
            <!-- TRANSITION 15 MIN -->
            <div style="background:#FFF4E5; border-radius:18px; padding:14px; margin-bottom:16px; border:1px solid #FF9500;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <strong style="color:#FF9500; font-size:14px;">⏳ Transition Culte 1 ➜ Culte 2</strong>
                <span style="background:#FF9500; color:#FFF; padding:3px 8px; border-radius:8px; font-size:12px; font-weight:800;">15:00 min</span>
              </div>
              <p style="font-size:12px; color:#1C1C1E; margin-bottom:10px;">Pause technique de 15 minutes (09h00 à 09h15).</p>
              
              <div style="background:#FFF; padding:10px; border-radius:12px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <strong style="font-size:12px; display:block;">📍 Check-in Rapide</strong>
                  <span style="font-size:10px; color:#8E8E93;">Validez votre arrivée Culte 2</span>
                </div>
                <button onclick="window.doCheckInNow()" style="background:${isCheckedIn ? '#34C759' : '#007AFF'}; color:#FFF; border:none; padding:7px 12px; border-radius:10px; font-size:11px; font-weight:800; cursor:pointer;">
                  ${isCheckedIn ? '✓ Présent' : 'Valider'}
                </button>
              </div>
            </div>

            <!-- CULTES -->
            <div style="background:#FFF; border-radius:16px; padding:14px; margin-bottom:10px; border:1px solid #E5E5EA;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div><strong>Culte 1</strong> <span style="font-size:12px; color:#8E8E93;">(07h00 - 09h00)</span></div>
                <span style="background:#E5E5EA; color:#8E8E93; padding:3px 8px; border-radius:6px; font-size:10px; font-weight:800;">✓ CLÔTURÉ</span>
              </div>
            </div>

            <div style="background:#FFF; border-radius:16px; padding:14px; margin-bottom:10px; border:1px solid #007AFF;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div><strong>Culte 2</strong> <span style="font-size:12px; color:#8E8E93;">(09h15 - 11h15)</span></div>
                <span style="background:#FFF4E5; color:#FF9500; padding:3px 8px; border-radius:6px; font-size:10px; font-weight:800;">⏳ EN TRANSITION</span>
              </div>
            </div>

            <div style="background:#FFF; border-radius:16px; padding:14px; margin-bottom:10px; border:1px solid #E5E5EA;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div><strong>Culte 3</strong> <span style="font-size:12px; color:#8E8E93;">(11h30 - 13h30)</span></div>
                <span style="background:#E5F1FF; color:#007AFF; padding:3px 8px; border-radius:6px; font-size:10px; font-weight:800;">À VENIR</span>
              </div>
            </div>
          </div>
        `;
      }

      if (activeTab === 'debrief') {
        return `
          <header style="padding:45px 20px 15px; background:#FFF; border-bottom:1px solid #E5E5EA;">
            <p style="font-size:11px; font-weight:700; color:#007AFF; text-transform:uppercase; margin:0 0 2px;">Culte du Dimanche 02 Août</p>
            <h1 style="font-size:26px; font-weight:800; color:#1C1C1E; margin:0;">Notation & Débrief</h1>
          </header>

          <div style="padding:16px;">
            <h3 style="font-size:15px; font-weight:800; margin-bottom:8px;">1. Notation Inter-Sections</h3>
            
            <div style="background:#F8F8FA; border-radius:14px; padding:12px; margin-bottom:10px; border:1px solid #E1E1E6;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong>🎥 Section Cadrage</strong>
                <span style="background:#FFEBEA; color:#FF3B30; padding:3px 8px; border-radius:6px; font-size:10px; font-weight:800;">🔒 Auto-notation interdite</span>
              </div>
            </div>

            <div style="background:#FFF; border-radius:14px; padding:12px; margin-bottom:10px; border:1px solid #E5E5EA;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <strong>🎛️ Section Régie</strong>
                <span style="color:#FFD700;">★★★★★ 5.0</span>
              </div>
              <input type="text" value="Son propre et bien dosé" style="width:100%; padding:6px; border-radius:6px; border:1px solid #E5E5EA; font-size:12px; box-sizing:border-box;">
            </div>

            <div style="background:#FFF9E6; border-radius:18px; padding:16px; margin-top:16px; border:1.5px solid #FFC107;">
              <h3 style="color:#B8860B; margin:0 0 4px; font-size:16px;">👑 Validation Grand Responsable</h3>
              <p style="font-size:11px; color:#666; margin-bottom:12px;">Validez et publiez le Bilan 24h sur le Feed principal.</p>
              <button onclick="window.publishBilanFeed()" style="width:100%; background:#34C759; color:#FFF; border:none; padding:12px; border-radius:12px; font-size:13px; font-weight:900; cursor:pointer;">
                🚀 Valider et Publier le Bilan sur le Feed (24h)
              </button>
            </div>
          </div>
        `;
      }

      if (activeTab === 'halloffame') {
        return `
          <header style="padding:45px 20px 15px; background:#FFF; border-bottom:1px solid #E5E5EA;">
            <p style="font-size:11px; font-weight:700; color:#B8860B; text-transform:uppercase; margin:0 0 2px;">Archives Permanentes (Post-24h)</p>
            <h1 style="font-size:26px; font-weight:800; color:#1C1C1E; margin:0;">Espace Vedettes 🌟</h1>
          </header>

          <div style="padding:16px;">
            <div style="background:#FFF; border-radius:16px; padding:14px; margin-bottom:12px; border:1px solid #E5E5EA;">
              <span style="font-size:10px; font-weight:700; color:#8E8E93;">DIMANCHE 02 AOÛT 2026</span>
              <h3 style="font-size:16px; margin:2px 0 8px;">Culte n°1 — Section Vedette</h3>
              <div style="background:#FFF9E6; padding:8px; border-radius:10px; display:flex; justify-content:space-between; align-items:center; border:1px solid #FFC107;">
                <span>🎥 <strong>Section Cadrage</strong></span>
                <strong style="color:#B8860B;">★ 4.88 / 5.0</strong>
              </div>
            </div>

            <div style="background:#1C1C1E; color:#FFF; border-radius:18px; padding:18px; text-align:center; margin-top:16px;">
              <span style="font-size:36px; display:block; margin-bottom:4px;">🏆</span>
              <span style="font-size:10px; font-weight:800; color:#FFD700; text-transform:uppercase;">TROPHÉE ANNUEL 2025-2026</span>
              <h2 style="font-size:22px; margin:4px 0;">🎛️ Section Régie Technique</h2>
              <p style="font-size:11px; color:rgba(255,255,255,0.7);">Meilleure section de l'année (4.96/5.0 de moyenne).</p>
            </div>
          </div>
        `;
      }

      if (activeTab === 'profile') {
        return `
          <header style="padding:45px 20px 15px; background:#FFF; border-bottom:1px solid #E5E5EA;">
            <p style="font-size:11px; font-weight:700; color:#007AFF; text-transform:uppercase; margin:0 0 2px;">Département Communication</p>
            <h1 style="font-size:26px; font-weight:800; color:#1C1C1E; margin:0;">Mon Profil</h1>
          </header>

          <div style="padding:16px;">
            <div style="background:#FFF; border-radius:18px; padding:18px; text-align:center; margin-bottom:14px; border:1px solid #E5E5EA;">
              <div style="width:64px; height:64px; border-radius:32px; background:#E5F1FF; color:#007AFF; font-size:26px; font-weight:800; display:flex; align-items:center; justify-content:center; margin:0 auto 8px;">É</div>
              <h2 style="font-size:18px; margin:0;">Éric Kouamé</h2>
              <p style="font-size:12px; color:#8E8E93; margin-top:2px;">RESP_SECTION • Section Cadrage</p>
            </div>

            <div style="background:#FFF; border-radius:18px; padding:16px; margin-bottom:14px; border:1px solid #E5E5EA;">
              <h3 style="font-size:12px; font-weight:800; color:#8E8E93; text-transform:uppercase; text-align:center; margin-bottom:12px;">Indice de Confiance (Trust Score)</h3>
              <div style="display:flex; justify-content:space-around; align-items:center;">
                <div style="width:80px; height:80px; border-radius:40px; border:5px solid #34C759; background:#E8F9ED; display:flex; flex-direction:column; align-items:center; justify-content:center;">
                  <strong style="font-size:18px; color:#34C759;">98.5%</strong>
                  <span style="font-size:8px; color:#34C759; font-weight:700;">Fiabilité</span>
                </div>
                <div>
                  <div style="background:#F2F2F7; padding:6px 10px; border-radius:8px; margin-bottom:4px; font-size:12px;">
                    <strong>45 Services</strong> <small style="color:#8E8E93;">effectués</small>
                  </div>
                  <div style="background:#F2F2F7; padding:6px 10px; border-radius:8px; font-size:12px;">
                    <strong>4.88 / 5.0 ★</strong> <small style="color:#8E8E93;">moyenne</small>
                  </div>
                </div>
              </div>
            </div>

            <button onclick="alert('📅 Agenda du téléphone synchronisé !')" style="width:100%; background:#007AFF; color:#FFF; border:none; padding:12px; border-radius:12px; font-size:12px; font-weight:800; cursor:pointer;">
              📅 Synchroniser avec l'agenda du téléphone
            </button>
          </div>
        `;
      }

      return '<div>Rendu de l\'écran...</div>';
    }
  }

  // Lancement garanti au chargement
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
