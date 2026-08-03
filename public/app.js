// Application Frontend Runner for Vercel Web & PWA
(function() {
  console.log("🚀 Initialisation de l'application Kun COM VH (Web & PWA)...");
  
  // Attendre le chargement du DOM
  window.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('root');
    if (!root) return;

    // État actif de l'onglet (par défaut: 'home')
    let activeTab = 'home';
    let userRole = 'RESP_SECTION'; // 'GRAND_RESPONSABLE', 'RESP_SECTION', 'MEMBRE'
    let selectedSection = 'all';
    let isCheckedIn = false;
    let transitionTimer = 900; // 15 min = 900s

    // Fonction de rendu principal
    function renderApp() {
      root.innerHTML = `
        <div style="display: flex; flex-direction: column; height: 100%; width: 100%; position: relative; background-color: #F2F2F7; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;">
          
          <!-- CONTENU DES ÉCRANS -->
          <div style="flex: 1; overflow-y: auto; padding-bottom: 85px;">
            ${renderScreenContent()}
          </div>

          <!-- BOTTOM TAB BAR iOS (5 ONGLETS) -->
          <nav style="position: absolute; bottom: 0; left: 0; right: 0; height: 75px; background: rgba(255, 255, 255, 0.94); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-top: 1px solid #E5E5EA; display: flex; justify-content: space-around; align-items: center; z-index: 9999;">
            <button onclick="window.switchTab('home')" style="${tabButtonStyle(activeTab === 'home')}">
              <span style="font-size: 20px;">🏠</span>
              <span style="${tabTextStyle(activeTab === 'home')}">Accueil</span>
            </button>

            <button onclick="window.switchTab('planning')" style="${tabButtonStyle(activeTab === 'planning')}">
              <span style="font-size: 20px;">📅</span>
              <span style="${tabTextStyle(activeTab === 'planning')}">Planning</span>
            </button>

            <!-- BOUTON CENTRAL + SURÉLEVÉ -->
            <button onclick="window.switchTab('debrief')" style="width: 52px; height: 52px; border-radius: 26px; background-color: #007AFF; color: #FFF; border: none; font-size: 26px; display: flex; align-items: center; justify-content: center; margin-top: -24px; box-shadow: 0 6px 16px rgba(0, 122, 255, 0.4); cursor: pointer;">
              +
            </button>

            <button onclick="window.switchTab('halloffame')" style="${tabButtonStyle(activeTab === 'halloffame')}">
              <span style="font-size: 20px;">🌟</span>
              <span style="${tabTextStyle(activeTab === 'halloffame')}">Vedettes</span>
            </button>

            <button onclick="window.switchTab('profile')" style="${tabButtonStyle(activeTab === 'profile')}">
              <span style="font-size: 20px;">👤</span>
              <span style="${tabTextStyle(activeTab === 'profile')}">Profil</span>
            </button>
          </nav>
        </div>
      `;
    }

    // Gestion du changement d'onglet
    window.switchTab = function(tab) {
      activeTab = tab;
      renderApp();
    };

    // Basculer le rôle utilisateur pour démonstration de sécurité
    window.toggleRole = function() {
      if (userRole === 'RESP_SECTION') userRole = 'MEMBRE';
      else if (userRole === 'MEMBRE') userRole = 'GRAND_RESPONSABLE';
      else userRole = 'RESP_SECTION';
      renderApp();
    };

    // Valider le check-in rapide
    window.doCheckIn = function() {
      isCheckedIn = true;
      alert("✅ Présence enregistrée avec succès pour le Culte !");
      renderApp();
    };

    // Publication du Bilan 24h par Grand Responsable
    window.publishBilan = function() {
      alert("🚀 Bilan de Culte Validé et Publié sur le Feed (24h) avec succès !\n\nSection Vedette attribuée : Cadrage 🎥 (4.88 / 5.0)");
      activeTab = 'home';
      renderApp();
    };

    // Styles Helper
    function tabButtonStyle(isActive) {
      return `background: none; border: none; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; padding: 4px 8px; opacity: ${isActive ? 1 : 0.65}; transition: opacity 0.2s ease;`;
    }
    function tabTextStyle(isActive) {
      return `font-size: 11px; font-weight: ${isActive ? '800' : '600'}; color: ${isActive ? '#007AFF' : '#8E8E93'}; margin-top: 2px;`;
    }

    // Générateur de contenu d'écran
    function renderScreenContent() {
      switch (activeTab) {
        case 'home':
          return `
            <header style="padding: 50px 20px 15px; background: #FFF; border-bottom: 1px solid #E5E5EA; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <p style="font-size: 11px; font-weight: 700; color: #007AFF; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 2px;">Département Communication</p>
                <h1 style="font-size: 28px; font-weight: 800; color: #1C1C1E; margin: 0;">Accueil</h1>
              </div>
              <div style="display: flex; gap: 10px; align-items: center;">
                <button onclick="window.toggleRole()" style="background: #E5F1FF; border: 1px solid rgba(0,122,255,0.2); padding: 6px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; color: #007AFF; cursor: pointer;">
                  👤 Rôle: ${userRole}
                </button>
                <div style="width: 40px; height: 40px; border-radius: 20px; background: #F2F2F7; display: flex; align-items: center; justify-content: center; position: relative;">
                  🔔 <span style="position: absolute; top: 8px; right: 8px; width: 8px; height: 8px; border-radius: 4px; background: #FF3B30;"></span>
                </div>
              </div>
            </header>

            <div style="padding: 16px;">
              <!-- CARTE BILAN 24H -->
              <div style="background: #FFF; border-radius: 20px; padding: 18px; margin-bottom: 20px; border: 1px solid rgba(255,215,0,0.5); box-shadow: 0 4px 14px rgba(212,175,55,0.15);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
                  <div>
                    <span style="font-size: 11px; font-weight: 700; color: #8E8E93; text-transform: uppercase;">DIMANCHE 02 AOÛT 2026</span>
                    <h2 style="font-size: 20px; font-weight: 800; margin: 2px 0 0;">Bilan Culte n°1</h2>
                  </div>
                  <div style="background: #FFF9E6; border: 1px solid #FFC107; padding: 6px 12px; border-radius: 14px; display: flex; align-items: center; gap: 4px;">
                    <span>🏆</span> <strong style="font-size: 11px; color: #B8860B;">CADRAGE VEDETTE</strong>
                  </div>
                </div>

                <div style="background: rgba(0,122,255,0.08); padding: 8px 12px; border-radius: 12px; font-size: 11px; color: #007AFF; font-weight: 600; margin-bottom: 12px;">
                  🔒 Rôle actif : <strong>${userRole}</strong> ${userRole === 'MEMBRE' ? '(Notes confidentielles masquées)' : '(Accès complet responsable)'}
                </div>

                <div style="display: flex; flex-direction: column; gap: 10px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #F2F2F7;">
                    <div><strong>Sarah Yao</strong> <span style="font-size: 11px; color: #8E8E93;">(MEMBRE)</span></div>
                    <div style="text-align: right;"><span style="color: #FFD700;">★</span> 4.5 / 5.0 <span style="font-size: 10px; color: #34C759; display: block;">Public</span></div>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #F2F2F7;">
                    <div><strong>Éric Kouamé</strong> <span style="font-size: 11px; color: #8E8E93;">(RESP_SECTION)</span></div>
                    <div style="text-align: right;">
                      ${userRole === 'MEMBRE' ? '<span style="font-size: 11px; color: #8E8E93; font-style: italic;">🔒 Confidentiel</span>' : '<span style="color: #FFD700;">★</span> 4.8 / 5.0 <span style="font-size: 10px; color: #007AFF; display: block;">Poids 3</span>'}
                    </div>
                  </div>
                </div>

                <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid #E5E5EA; display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 12px; font-weight: 700; color: #8E8E93;">Moyenne Pondérée Active</span>
                  <strong style="font-size: 16px; font-weight: 900;">4.88 / 5.0 ★</strong>
                </div>
              </div>

              <!-- FEED CLASSIQUE -->
              <h3 style="font-size: 18px; font-weight: 800; margin-bottom: 12px;">Publications & Débriefs</h3>
              
              <div style="background: #FFF; border-radius: 20px; padding: 16px; margin-bottom: 16px; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                  <div style="width: 36px; height: 36px; border-radius: 18px; background: #007AFF; color: #FFF; font-weight: 800; display: flex; align-items: center; justify-content: center;">É</div>
                  <div>
                    <h4 style="font-size: 14px; margin: 0;">Éric Kouamé (Resp Cadrage)</h4>
                    <span style="font-size: 11px; color: #8E8E93;">Il y a 2 heures • Section Cadrage</span>
                  </div>
                </div>
                <p style="font-size: 14px; line-height: 1.4; color: #1C1C1E; margin-bottom: 12px;">
                  Bravo à toute l'équipe Cadrage pour la captation directe du 1er culte ! Les plans serrés sur la chorale étaient parfaitement synchronisés.
                </p>
                <div style="display: flex; justify-content: space-between; border-top: 1px solid #F2F2F7; padding-top: 10px; font-size: 13px; color: #8E8E93;">
                  <span>❤️ 14 Likes</span>
                  <span>💬 3 Commentaires</span>
                  <span>↗️ Partager</span>
                </div>
              </div>
            </div>
          `;

        case 'planning':
          return `
            <header style="padding: 50px 20px 15px; background: #FFF; border-bottom: 1px solid #E5E5EA; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <p style="font-size: 11px; font-weight: 700; color: #5856D6; text-transform: uppercase; letter-spacing: 1.2px;">Dimanche 02 Août 2026</p>
                <h1 style="font-size: 28px; font-weight: 800; color: #1C1C1E; margin: 0;">Planning Cultes</h1>
              </div>
            </header>

            <!-- MODE TRANSITION 15 MIN -->
            <div style="padding: 16px;">
              <div style="background: #FFF4E5; border-radius: 20px; padding: 16px; margin-bottom: 20px; border: 1px solid #FF9500;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <strong style="color: #FF9500; font-size: 15px;">⏳ Transition Culte 1 ➜ Culte 2</strong>
                  <span style="background: #FF9500; color: #FFF; padding: 4px 8px; border-radius: 10px; font-size: 13px; font-weight: 800;">14:45 min</span>
                </div>
                <p style="font-size: 12px; color: #1C1C1E; margin-bottom: 12px;">Pause technique de 15 minutes entre les cultes (09h00 à 09h15).</p>
                
                <div style="background: #FFF; padding: 10px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <strong style="font-size: 13px; display: block;">📍 Check-in Rapide</strong>
                    <span style="font-size: 11px; color: #8E8E93;">Validez votre présence pour Culte 2</span>
                  </div>
                  <button onclick="window.doCheckIn()" style="background: ${isCheckedIn ? '#34C759' : '#007AFF'}; color: #FFF; border: none; padding: 8px 14px; border-radius: 10px; font-size: 12px; font-weight: 800; cursor: pointer;">
                    ${isCheckedIn ? '✓ Présent' : 'Valider'}
                  </button>
                </div>
              </div>

              <!-- CARTES DES CULTES DU DIMANCHE -->
              <div style="background: #FFF; border-radius: 18px; padding: 16px; margin-bottom: 14px; border: 1px solid #E5E5EA;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                  <div>
                    <h3 style="font-size: 18px; margin: 0;">Culte 1 — Premier Service</h3>
                    <span style="font-size: 12px; color: #8E8E93;">Horaires : 07h00 - 09h00</span>
                  </div>
                  <span style="background: #E5E5EA; color: #8E8E93; padding: 4px 8px; border-radius: 8px; font-size: 11px; font-weight: 800;">✓ CLÔTURÉ</span>
                </div>
              </div>

              <div style="background: #FFF; border-radius: 18px; padding: 16px; margin-bottom: 14px; border: 1px solid #007AFF;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                  <div>
                    <h3 style="font-size: 18px; margin: 0;">Culte 2 — Second Service</h3>
                    <span style="font-size: 12px; color: #8E8E93;">Horaires : 09h15 - 11h15</span>
                  </div>
                  <span style="background: #FFF4E5; color: #FF9500; padding: 4px 8px; border-radius: 8px; font-size: 11px; font-weight: 800;">⏳ EN TRANSITION</span>
                </div>
              </div>

              <div style="background: #FFF; border-radius: 18px; padding: 16px; margin-bottom: 14px; border: 1px solid #E5E5EA;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                  <div>
                    <h3 style="font-size: 18px; margin: 0;">Culte 3 — Célébration</h3>
                    <span style="font-size: 12px; color: #8E8E93;">Horaires : 11h30 - 13h30</span>
                  </div>
                  <span style="background: #E5F1FF; color: #007AFF; padding: 4px 8px; border-radius: 8px; font-size: 11px; font-weight: 800;">À VENIR</span>
                </div>
              </div>
            </div>
          `;

        case 'debrief':
          return `
            <header style="padding: 50px 20px 15px; background: #FFF; border-bottom: 1px solid #E5E5EA;">
              <p style="font-size: 11px; font-weight: 700; color: #007AFF; text-transform: uppercase;">Culte du Dimanche 02 Août</p>
              <h1 style="font-size: 28px; font-weight: 800; color: #1C1C1E; margin: 0;">Notation & Débrief</h1>
            </header>

            <div style="padding: 16px;">
              <h3 style="font-size: 16px; font-weight: 800; margin-bottom: 10px;">1. Notation Inter-Sections</h3>
              
              <!-- SECTION CADRAGE (PROPRE SECTION BLOQUÉE) -->
              <div style="background: #F8F8FA; border-radius: 16px; padding: 14px; margin-bottom: 12px; border: 1px solid #E1E1E6; opacity: 0.8;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <strong>🎥 Section Cadrage</strong>
                  <span style="background: #FFEBEA; color: #FF3B30; padding: 4px 8px; border-radius: 8px; font-size: 11px; font-weight: 800;">🔒 Auto-notation interdite</span>
                </div>
              </div>

              <!-- OTHER SECTIONS -->
              <div style="background: #FFF; border-radius: 16px; padding: 14px; margin-bottom: 12px; border: 1px solid #E5E5EA;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <strong>🎛️ Section Régie</strong>
                  <span style="color: #FFD700; font-size: 18px;">★★★★★ 5.0</span>
                </div>
                <input type="text" placeholder="Ajouter une remarque..." style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #E5E5EA; font-size: 12px; box-sizing: border-box;" value="Son d'ambiance très équilibré">
              </div>

              <!-- SYNTHÈSE GRAND RESPONSABLE -->
              <div style="background: #FFF9E6; border-radius: 20px; padding: 18px; margin-top: 20px; border: 1.5px solid #FFC107;">
                <h3 style="color: #B8860B; margin-top: 0;">👑 Validation Grand Responsable</h3>
                <p style="font-size: 12px; color: #666; margin-bottom: 14px;">Validez le bilan et décernez le badge Section Vedette 24h.</p>
                <button onclick="window.publishBilan()" style="width: 100%; background: #34C759; color: #FFF; border: none; padding: 14px; border-radius: 14px; font-size: 14px; font-weight: 900; cursor: pointer;">
                  🚀 Valider et Publier le Bilan sur le Feed (24h)
                </button>
              </div>
            </div>
          `;

        case 'halloffame':
          return `
            <header style="padding: 50px 20px 15px; background: #FFF; border-bottom: 1px solid #E5E5EA;">
              <p style="font-size: 11px; font-weight: 700; color: #B8860B; text-transform: uppercase;">Archives Permanentes (Post-24h)</p>
              <h1 style="font-size: 28px; font-weight: 800; color: #1C1C1E; margin: 0;">Espace Vedettes 🌟</h1>
            </header>

            <div style="padding: 16px;">
              <div style="background: #FFF; border-radius: 18px; padding: 16px; margin-bottom: 14px; border: 1px solid #E5E5EA;">
                <span style="font-size: 11px; font-weight: 700; color: #8E8E93;">DIMANCHE 02 AOÛT 2026</span>
                <h3 style="font-size: 18px; margin: 4px 0 10px;">Culte n°1 — Section Vedette</h3>
                <div style="background: #FFF9E6; padding: 10px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #FFC107;">
                  <span>🎥 <strong>Section Cadrage</strong></span>
                  <strong style="color: #B8860B;">★ 4.88 / 5.0</strong>
                </div>
              </div>

              <div style="background: #1C1C1E; color: #FFF; border-radius: 20px; padding: 20px; text-align: center; margin-top: 20px;">
                <span style="font-size: 40px; display: block; margin-bottom: 6px;">🏆</span>
                <span style="font-size: 11px; font-weight: 800; color: #FFD700; text-transform: uppercase;">TROPHÉE ANNUEL 2025-2026</span>
                <h2 style="font-size: 24px; margin: 6px 0;">🎛️ Section Régie Technique</h2>
                <p style="font-size: 12px; color: rgba(255,255,255,0.7);">Meilleure section de l'année avec 4.96/5.0 de moyenne cumulée.</p>
              </div>
            </div>
          `;

        case 'profile':
          return `
            <header style="padding: 50px 20px 15px; background: #FFF; border-bottom: 1px solid #E5E5EA;">
              <p style="font-size: 11px; font-weight: 700; color: #007AFF; text-transform: uppercase;">Département Communication</p>
              <h1 style="font-size: 28px; font-weight: 800; color: #1C1C1E; margin: 0;">Mon Profil</h1>
            </header>

            <div style="padding: 16px;">
              <!-- CARTE PROFIL -->
              <div style="background: #FFF; border-radius: 20px; padding: 20px; text-align: center; margin-bottom: 16px; border: 1px solid #E5E5EA;">
                <div style="width: 70px; height: 70px; border-radius: 35px; background: #E5F1FF; color: #007AFF; font-size: 28px; font-weight: 800; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px;">É</div>
                <h2 style="font-size: 20px; margin: 0;">Éric Kouamé</h2>
                <p style="font-size: 13px; color: #8E8E93; margin-top: 2px;">RESP_SECTION • Section Cadrage</p>
              </div>

              <!-- JAUGE TRUST SCORE -->
              <div style="background: #FFF; border-radius: 20px; padding: 18px; margin-bottom: 16px; border: 1px solid #E5E5EA;">
                <h3 style="font-size: 13px; font-weight: 800; color: #8E8E93; text-transform: uppercase; text-align: center; margin-bottom: 14px;">Indice de Confiance (Trust Score)</h3>
                
                <div style="display: flex; justify-content: space-around; align-items: center;">
                  <div style="width: 90px; height: 90px; border-radius: 45px; border: 6px solid #34C759; background: #E8F9ED; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <strong style="font-size: 20px; color: #34C759;">98.5%</strong>
                    <span style="font-size: 9px; color: #34C759; font-weight: 700;">Fiabilité</span>
                  </div>
                  <div>
                    <div style="background: #F2F2F7; padding: 8px 12px; border-radius: 10px; margin-bottom: 6px;">
                      <strong>45 Services</strong> <span style="font-size: 11px; color: #8E8E93;">effectués</span>
                    </div>
                    <div style="background: #F2F2F7; padding: 8px 12px; border-radius: 10px;">
                      <strong>4.88 / 5.0 ★</strong> <span style="font-size: 11px; color: #8E8E93;">note moyenne</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- ACTIONS -->
              <button onclick="alert('📅 Agenda du téléphone synchronisé avec les 3 prochains cultes !')" style="width: 100%; background: #007AFF; color: #FFF; border: none; padding: 14px; border-radius: 14px; font-size: 13px; font-weight: 800; margin-bottom: 10px; cursor: pointer;">
                📅 Synchroniser avec l'agenda du téléphone
              </button>
            </div>
          `;

        default:
          return `<div>Écran en cours de chargement...</div>`;
      }
    }

    // Premier rendu
    renderApp();
  });
})();
