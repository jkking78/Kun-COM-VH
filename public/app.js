// ==============================================================================
// APPLICATION WEB PURE PWA - DÉPARTEMENT COMMUNICATION (KUN COM VH)
// Authentification Sociale (Login / Signup, Persistance & Sécurité Invisible)
// ==============================================================================

(function() {
  console.log("🚀 Lancement de l'application Web avec Authentification Complète...");

  // ETAT GLOBAL DE L'APPLICATION
  var authView = 'login'; // 'login', 'signup', 'app'
  var currentUser = null; // Utilisateur connecté

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

  // ICONES SVG FIL DE FER
  var heartSvg = function(filled) {
    return '<svg width="22" height="22" viewBox="0 0 24 24" fill="' + (filled ? '#FF2D55' : 'none') + '" stroke="' + (filled ? '#FF2D55' : '#000000') + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
  };
  var commentSvg = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
  var shareSvg = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/></svg>';
  var bookmarkSvg = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
  var checkSvg = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#007AFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>';

  // RESTAURATION DE LA SESSION UTILISATEUR
  try {
    var savedUser = sessionStorage.getItem('kun_com_user');
    if (savedUser) {
      currentUser = JSON.parse(savedUser);
      authView = 'app';
    }
  } catch(e) {}

  function initApp() {
    var root = document.getElementById('root');
    if (!root) return;

    render();

    function render() {
      if (authView === 'login') {
        root.innerHTML = renderLogin();
      } else if (authView === 'signup') {
        root.innerHTML = renderSignup();
      } else {
        root.innerHTML = renderMainApp();
      }
    }

    // HANDLERS AUTHENTIFICATION
    window.handleLoginSubmit = function(e) {
      if (e) e.preventDefault();
      var email = document.getElementById('loginEmail') ? document.getElementById('loginEmail').value : 'eric.kouame@eglise.org';
      
      currentUser = {
        id: 'usr-cadrage-1',
        nom: 'Kouamé',
        prenom: 'Éric',
        email: email || 'eric.kouame@eglise.org',
        sectionId: 'cadrage',
        sectionNom: 'Cadrage',
        role: 'RESP_SECTION',
        trustScore: 98.5
      };

      sessionStorage.setItem('kun_com_user', JSON.stringify(currentUser));
      authView = 'app';
      render();
    };

    window.handleSignupSubmit = function(e) {
      if (e) e.preventDefault();
      var prenom = document.getElementById('signupPrenom') ? document.getElementById('signupPrenom').value : 'Jean';
      var nom = document.getElementById('signupNom') ? document.getElementById('signupNom').value : 'Dupont';
      var email = document.getElementById('signupEmail') ? document.getElementById('signupEmail').value : 'jean.dupont@eglise.org';
      var secSelect = document.getElementById('signupSection') ? document.getElementById('signupSection').value : 'cadrage';

      var secNames = { web: 'Web', proj: 'Projection', prod: 'Prod', regie: 'Régie', cadrage: 'Cadrage', photo: 'Photo', vente: 'Vente' };

      currentUser = {
        id: 'usr-' + Date.now(),
        nom: nom || 'Dupont',
        prenom: prenom || 'Jean',
        email: email || 'jean.dupont@eglise.org',
        sectionId: secSelect || 'cadrage',
        sectionNom: secNames[secSelect] || 'Cadrage',
        role: 'MEMBRE', // Rôle par défaut
        trustScore: 100.0
      };

      sessionStorage.setItem('kun_com_user', JSON.stringify(currentUser));
      alert('Compte créé avec succès ! Bienvenue ' + currentUser.prenom + ' dans la section ' + currentUser.sectionNom + ' (Rôle MEMBRE).');
      authView = 'app';
      render();
    };

    window.navAuthView = function(view) {
      authView = view;
      render();
    };

    window.handleLogout = function() {
      sessionStorage.removeItem('kun_com_user');
      currentUser = null;
      authView = 'login';
      render();
    };

    // HANDLERS APP PRINCIPALE
    window.setTab = function(t) { activeTab = t; render(); };
    window.setStory = function(s) { activeStory = s; render(); };
    window.toggleBilanLike = function() {
      isLikedBilan = !isLikedBilan;
      likesBilanCount += isLikedBilan ? 1 : -1;
      render();
    };
    window.doCheckIn = function() {
      isCheckedIn = true;
      alert("Présence validée pour le Culte.");
      render();
    };
    window.setRatingScore = function(secId, score) {
      var userSec = (currentUser && currentUser.sectionId) ? currentUser.sectionId : 'cadrage';
      if (secId === userSec) {
        alert("Action Interdite : Vous ne pouvez pas noter votre propre section !");
        return;
      }
      ratings[secId].score = score;
      render();
    };
    window.publishBilanFeed24h = function() {
      alert("Bilan de Culte Validé et Publié sur le Feed (24h).\n\nSection Vedette attribuée : Cadrage (4.88 / 5.0)");
      activeTab = 'home';
      render();
    };

    function tabStyle(active) {
      return 'background:none; border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; padding:8px 16px; opacity:' + (active ? 1 : 0.5) + ';';
    }

    // ÉCRAN DE CONNEXION (LOGIN)
    function renderLogin() {
      return `
        <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; min-height:100vh; padding:24px; box-sizing:border-box; background:#FFF;">
          <div style="width:100%; max-width:380px; text-align:center;">
            <p style="font-size:11px; font-weight:800; color:#007AFF; text-transform:uppercase; letter-spacing:1.4px; margin:0 0 4px;">ÉGLISE VASE D'HONNEUR</p>
            <h1 style="font-size:32px; font-weight:900; color:#000; margin:0 0 32px; letter-spacing:-0.8px;">Kun COM</h1>

            <form onsubmit="window.handleLoginSubmit(event)" style="display:flex; flex-direction:column; gap:14px; text-align:left;">
              <div>
                <label style="font-size:12px; font-weight:700; color:#000; display:block; margin-bottom:6px;">Adresse E-mail</label>
                <input id="loginEmail" type="email" value="eric.kouame@eglise.org" required style="width:100%; height:48px; border-radius:12px; border:1px solid #EFEFEF; background:#FAFAFA; padding:0 14px; font-size:14px; box-sizing:border-box;">
              </div>

              <div>
                <label style="font-size:12px; font-weight:700; color:#000; display:block; margin-bottom:6px;">Mot de passe</label>
                <input type="password" value="password123" required style="width:100%; height:48px; border-radius:12px; border:1px solid #EFEFEF; background:#FAFAFA; padding:0 14px; font-size:14px; box-sizing:border-box;">
              </div>

              <button type="submit" style="width:100%; height:50px; background:#007AFF; color:#FFF; border:none; border-radius:14px; font-size:15px; font-weight:800; cursor:pointer; margin-top:10px; box-shadow:0 4px 12px rgba(0,122,255,0.25);">
                Se connecter
              </button>
            </form>

            <div style="margin-top:24px; font-size:13px; color:#8E8E93;">
              Vous n'avez pas de compte ? <span onclick="window.navAuthView('signup')" style="color:#007AFF; font-weight:800; cursor:pointer;">S'inscrire</span>
            </div>
          </div>
        </div>
      `;
    }

    // ÉCRAN D'INSCRIPTION (SIGNUP)
    function renderSignup() {
      return `
        <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; min-height:100vh; padding:24px; box-sizing:border-box; background:#FFF;">
          <div style="width:100%; max-width:380px; text-align:center;">
            <p style="font-size:11px; font-weight:800; color:#007AFF; text-transform:uppercase; letter-spacing:1.4px; margin:0 0 4px;">INSCRIPTION COMPTE</p>
            <h1 style="font-size:28px; font-weight:900; color:#000; margin:0 0 24px; letter-spacing:-0.8px;">Rejoindre Kun COM</h1>

            <form onsubmit="window.handleSignupSubmit(event)" style="display:flex; flex-direction:column; gap:12px; text-align:left;">
              <div>
                <label style="font-size:12px; font-weight:700; color:#000; display:block; margin-bottom:4px;">Prénom</label>
                <input id="signupPrenom" type="text" placeholder="ex: Jean" required style="width:100%; height:46px; border-radius:12px; border:1px solid #EFEFEF; background:#FAFAFA; padding:0 14px; font-size:14px; box-sizing:border-box;">
              </div>

              <div>
                <label style="font-size:12px; font-weight:700; color:#000; display:block; margin-bottom:4px;">Nom</label>
                <input id="signupNom" type="text" placeholder="ex: Dupont" required style="width:100%; height:46px; border-radius:12px; border:1px solid #EFEFEF; background:#FAFAFA; padding:0 14px; font-size:14px; box-sizing:border-box;">
              </div>

              <div>
                <label style="font-size:12px; font-weight:700; color:#000; display:block; margin-bottom:4px;">Adresse E-mail</label>
                <input id="signupEmail" type="email" placeholder="ex: jean.dupont@eglise.org" required style="width:100%; height:46px; border-radius:12px; border:1px solid #EFEFEF; background:#FAFAFA; padding:0 14px; font-size:14px; box-sizing:border-box;">
              </div>

              <div>
                <label style="font-size:12px; font-weight:700; color:#000; display:block; margin-bottom:4px;">Section d'appartenance</label>
                <select id="signupSection" style="width:100%; height:46px; border-radius:12px; border:1px solid #EFEFEF; background:#FAFAFA; padding:0 14px; font-size:14px; box-sizing:border-box;">
                  <option value="cadrage">Cadrage</option>
                  <option value="regie">Régie</option>
                  <option value="web">Web</option>
                  <option value="proj">Projection</option>
                  <option value="prod">Prod</option>
                  <option value="photo">Photo</option>
                  <option value="vente">Vente</option>
                </select>
              </div>

              <button type="submit" style="width:100%; height:50px; background:#007AFF; color:#FFF; border:none; border-radius:14px; font-size:15px; font-weight:800; cursor:pointer; margin-top:8px; box-shadow:0 4px 12px rgba(0,122,255,0.25);">
                Créer mon compte (MEMBRE)
              </button>
            </form>

            <div style="margin-top:20px; font-size:13px; color:#8E8E93;">
              Vous avez déjà un compte ? <span onclick="window.navAuthView('login')" style="color:#007AFF; font-weight:800; cursor:pointer;">Se connecter</span>
            </div>
          </div>
        </div>
      `;
    }

    // APPLICATION PRINCIPALE INSTAGRAM
    function renderMainApp() {
      var userSec = currentUser ? currentUser.sectionId : 'cadrage';
      var userPrenom = currentUser ? currentUser.prenom : 'Éric';
      var userInitial = userPrenom.charAt(0);

      return `
        <div style="display:flex; flex-direction:column; min-height:100vh; width:100%; position:relative; background-color:#FFFFFF; font-family:-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif;">
          
          <div style="flex:1; padding-bottom:80px;">
            ${renderScreen(userPrenom, userInitial, userSec)}
          </div>

          <nav style="position:fixed; bottom:0; left:50%; transform:translateX(-50%); width:100%; max-width:500px; height:68px; background:rgba(255,255,255,0.96); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); border-top:1px solid #EFEFEF; display:flex; justify-content:space-around; align-items:center; z-index:99999;">
            <button onclick="window.setTab('home')" style="${tabStyle(activeTab === 'home')}">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="${activeTab === 'home' ? '#000' : 'none'}" stroke="#000" stroke-width="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
            </button>

            <button onclick="window.setTab('planning')" style="${tabStyle(activeTab === 'planning')}">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.8"><path d="M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18"/></svg>
            </button>

            <button onclick="window.setTab('debrief')" style="width:44px; height:44px; border-radius:22px; background-color:#007AFF; color:#FFF; border:none; display:flex; align-items:center; justify-content:center; margin-top:-18px; box-shadow:0 4px 12px rgba(0,122,255,0.3); cursor:pointer;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>
            </button>

            <button onclick="window.setTab('halloffame')" style="${tabStyle(activeTab === 'halloffame')}">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.8"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            </button>

            <button onclick="window.setTab('profile')" style="${tabStyle(activeTab === 'profile')}">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </button>
          </nav>
        </div>
      `;
    }

    function renderScreen(userPrenom, userInitial, userSec) {
      if (activeTab === 'home') {
        return `
          <header style="padding:14px 18px; background:#FFF; border-bottom:1px solid #EFEFEF; display:flex; justify-content:space-between; align-items:center; position:sticky; top:0; z-index:100;">
            <div>
              <p style="font-size:10px; font-weight:800; color:#007AFF; text-transform:uppercase; letter-spacing:1.2px; margin:0 0 1px;">ÉGLISE VASE D'HONNEUR</p>
              <h1 style="font-size:22px; font-weight:900; color:#000000; margin:0; letter-spacing:-0.6px;">Kun COM</h1>
            </div>
            <div style="display:flex; gap:10px; align-items:center;">
              <div onclick="window.handleLogout()" title="Déconnexion" style="width:34px; height:34px; border-radius:17px; background:#F0F6FF; color:#007AFF; font-weight:800; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:14px;">
                ${userInitial}
              </div>
              <div style="cursor:pointer;">
                ${commentSvg}
              </div>
            </div>
          </header>

          <div style="padding:12px 0; border-bottom:1px solid #EFEFEF; background:#FFF; overflow-x:auto; white-space:nowrap; -webkit-overflow-scrolling:touch;">
            <div style="display:flex; gap:14px; padding:0 14px;">
              ${[
                { id: 'cadrage', nom: 'Cadrage', emoji: '🎥', active: true },
                { id: 'regie', nom: 'Régie', emoji: '🎛️', active: true },
                { id: 'web', nom: 'Web', emoji: '🌐', active: false },
                { id: 'proj', nom: 'Projection', emoji: '🖥️', active: false },
                { id: 'prod', nom: 'Prod', emoji: '🎬', active: false },
                { id: 'photo', nom: 'Photo', emoji: '📸', active: false },
                { id: 'vente', nom: 'Vente', emoji: '🛒', active: false }
              ].map(function(story) {
                var isSel = activeStory === story.id;
                return `
                  <div onclick="window.setStory('${story.id}')" style="display:inline-flex; flex-direction:column; align-items:center; cursor:pointer; width:66px;">
                    <div style="width:62px; height:62px; border-radius:31px; padding:2px; border:2px solid ${isSel || story.active ? '#D4AF37' : '#E5E5EA'}; display:flex; align-items:center; justify-content:center; background:#FFF;">
                      <div style="width:100%; height:100%; border-radius:27px; background:#F0F6FF; display:flex; align-items:center; justify-content:center; font-size:24px;">
                        ${story.emoji}
                      </div>
                    </div>
                    <span style="font-size:11px; font-weight:${isSel ? '700' : '500'}; color:${isSel ? '#000000' : '#8E8E93'}; margin-top:4px; text-align:center;">
                      ${story.nom}
                    </span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <article style="background:#FFF; border-bottom:8px solid #FAFAFA;">
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:38px; height:38px; border-radius:19px; background:#007AFF; color:#FFF; font-size:15px; font-weight:800; display:flex; align-items:center; justify-content:center;">C</div>
                <div>
                  <h3 style="font-size:14px; font-weight:700; margin:0; color:#000000;">Section Cadrage</h3>
                  <span style="font-size:11px; color:#8E8E93;">Dimanche 02 Août 2026 • Culte n°1</span>
                </div>
              </div>
              <div style="background:#FFFDF0; border:1px solid #E6CA65; padding:5px 10px; border-radius:12px; font-size:10.5px; font-weight:800; color:#B8860B;">
                SECTION VEDETTE
              </div>
            </div>

            <div style="width:100%; height:280px; background:#1C1C1E; position:relative; display:flex; flex-direction:column; justify-content:center; align-items:center; padding:20px; text-align:center;">
              <h2 style="font-size:18px; font-weight:800; color:#FFFFFF; margin:0 0 4px; letter-spacing:-0.4px;">Captation Directe Culte n°1</h2>
              <span style="color:#8E8E93; font-size:12px; font-weight:500;">Coulisses & Couverture Technique</span>

              <div style="position:absolute; bottom:14px; right:14px; background:rgba(255,255,255,0.92); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); padding:6px 12px; border-radius:16px; border:1px solid rgba(255,255,255,0.8); box-shadow:0 4px 12px rgba(0,0,0,0.12);">
                <strong style="font-size:14px; color:#1C1C1E; font-weight:900;">4.88 / 5.0</strong>
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px;">
              <div style="display:flex; align-items:center; gap:16px;">
                <button onclick="window.toggleBilanLike()" style="background:none; border:none; padding:0; display:flex; align-items:center; gap:6px; cursor:pointer;">
                  ${heartSvg(isLikedBilan)}
                  <strong style="font-size:13px; color:#000000;">${likesBilanCount}</strong>
                </button>

                <button style="background:none; border:none; padding:0; display:flex; align-items:center; gap:6px; cursor:pointer;">
                  ${commentSvg}
                  <strong style="font-size:13px; color:#000000;">7</strong>
                </button>

                <button style="background:none; border:none; padding:0; cursor:pointer;">
                  ${shareSvg}
                </button>
              </div>

              <button style="background:none; border:none; padding:0; cursor:pointer;">
                ${bookmarkSvg}
              </button>
            </div>

            <div style="padding:0 16px 14px;">
              <div style="font-size:13px; font-weight:700; color:#000000; margin-bottom:4px;">
                Aimé par ${userPrenom} et ${likesBilanCount - 1} autres membres
              </div>
              <p style="font-size:13.5px; line-height:1.45; color:#000000; margin:0;">
                <strong>Section Cadrage</strong> Bravo à toute l'équipe Cadrage pour la couverture dynamique du 1er culte. Les cadrages serrés et la synchronisation avec la chorale étaient parfaits.
              </p>
            </div>
          </article>

          <div style="padding:36px 20px; text-align:center; background:#FFF; border-top:1px solid #EFEFEF; display:flex; flex-direction:column; align-items:center;">
            <div style="width:48px; height:48px; border-radius:24px; background:#F0F6FF; display:flex; align-items:center; justify-content:center; margin-bottom:10px;">
              ${checkSvg}
            </div>
            <h3 style="font-size:16px; font-weight:800; color:#000000; margin:0;">Vous êtes à jour</h3>
            <p style="font-size:12px; color:#8E8E93; margin:4px 0 0; max-width:280px; line-height:1.4;">
              Vous avez vu toutes les nouvelles publications du Département Communication.
            </p>
          </div>
        `;
      }

      if (activeTab === 'debrief') {
        return `
          <header style="padding:16px 20px; background:#FFF; border-bottom:1px solid #EFEFEF;">
            <p style="font-size:11px; font-weight:800; color:#007AFF; text-transform:uppercase; letter-spacing:1.2px; margin:0 0 2px;">Culte du Dimanche 02 Août</p>
            <h1 style="font-size:24px; font-weight:900; color:#000000; margin:0;">Notation & Débrief</h1>
          </header>

          <div style="padding:16px;">
            <h3 style="font-size:15px; font-weight:800; margin-bottom:8px;">1. Notation Inter-Sections</h3>

            ${[
              { id: 'cadrage', nom: 'Cadrage' },
              { id: 'web', nom: 'Web' },
              { id: 'proj', nom: 'Projection' },
              { id: 'prod', nom: 'Prod' },
              { id: 'regie', nom: 'Régie' },
              { id: 'photo', nom: 'Photo' },
              { id: 'vente', nom: 'Vente' }
            ].map(function(sec) {
              var isBlocked = (sec.id === userSec);
              var r = ratings[sec.id] || { score: 4, comment: '' };

              if (isBlocked) {
                return `
                  <div style="background:#F8F8FA; border-radius:16px; padding:14px; margin-bottom:10px; border:1px solid #E1E1E6;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <strong style="font-size:14px;">Section ${sec.nom} (Votre section)</strong>
                      <span style="background:#FFEBEA; color:#FF3B30; padding:4px 8px; border-radius:8px; font-size:11px; font-weight:800;">Auto-notation interdite</span>
                    </div>
                  </div>
                `;
              }

              return `
                <div style="background:#FFF; border-radius:16px; padding:14px; margin-bottom:10px; border:1px solid #E5E5EA;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <strong style="font-size:14px;">Section ${sec.nom}</strong>
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
              <h3 style="color:#B8860B; margin:0 0 4px; font-size:16px;">Synthèse & Validation</h3>
              <p style="font-size:11px; color:#666; margin-bottom:12px;">Validez et publiez le Bilan 24h sur le Feed Instagram.</p>
              <button onclick="window.publishBilanFeed24h()" style="width:100%; background:#34C759; color:#FFF; border:none; padding:14px; border-radius:14px; font-size:14px; font-weight:900; cursor:pointer;">
                Valider et Publier le Bilan sur le Feed (24h)
              </button>
            </div>
          </div>
        `;
      }

      if (activeTab === 'profile') {
        return `
          <header style="padding:16px 20px; background:#FFF; border-bottom:1px solid #EFEFEF; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <p style="font-size:11px; font-weight:800; color:#007AFF; text-transform:uppercase; letter-spacing:1.2px; margin:0 0 2px;">Département Communication</p>
              <h1 style="font-size:24px; font-weight:900; color:#000000; margin:0;">Mon Profil</h1>
            </div>
            <button onclick="window.handleLogout()" style="background:#FFEBEA; color:#FF3B30; border:none; padding:6px 12px; border-radius:10px; font-size:12px; font-weight:800; cursor:pointer;">
              Se déconnecter
            </button>
          </header>

          <div style="padding:16px;">
            <div style="background:#FFF; border-radius:22px; padding:20px; text-align:center; margin-bottom:16px; border:1px solid #E5E5EA;">
              <div style="width:72px; height:72px; border-radius:36px; background:#F0F6FF; color:#007AFF; font-size:30px; font-weight:800; display:flex; align-items:center; justify-content:center; margin:0 auto 10px; border:3px solid #007AFF;">${userInitial}</div>
              <h2 style="font-size:20px; margin:0;">${currentUser.prenom} ${currentUser.nom}</h2>
              <p style="font-size:13px; color:#8E8E93; margin-top:2px;">Rôle : ${currentUser.role} • Section ${currentUser.sectionNom}</p>
            </div>
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
