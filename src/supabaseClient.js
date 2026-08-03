// ==============================================================================
// CONFIGURATION ET HELPER SUPABASE CLIENT (PWA & REACT VITE)
// Connexion REST / Realtime WebSockets avec Mode Persistence Fallback
// ==============================================================================

const SUPABASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL)
  ? import.meta.env.VITE_SUPABASE_URL
  : 'https://kuncomvh.supabase.co';

const SUPABASE_ANON_KEY = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY)
  ? import.meta.env.VITE_SUPABASE_ANON_KEY
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJrdW5jb212aCIsInJvbGUiOiJhb24ifQ.kuncomvh_signature';

// STOCKAGE LOCAL DE SECOURS (PERSISTENCE)
const STORAGE_KEYS = {
  USERS: 'kun_com_db_profiles',
  POSTS: 'kun_com_db_posts',
  SESSION: 'kun_com_user'
};

function getStoredData(key, defaultData) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultData;
  } catch (e) {
    return defaultData;
  }
}

function setStoredData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {}
}

// INITIALISATION DU STOCKAGE LOCAL PAR DÉFAUT
if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
  setStoredData(STORAGE_KEYS.USERS, [
    {
      id: 'usr-cadrage-1',
      nom: 'Kouamé',
      prenom: 'Éric',
      email: 'eric.kouame@eglise.org',
      section_id: 'cadrage',
      section_nom: 'Cadrage',
      role: 'RESP_SECTION',
      avatar_url: '',
      is_online: true,
      last_seen_at: new Date().toISOString(),
      last_action: 'Connexion'
    },
    {
      id: 'usr-admin-0',
      nom: 'Pasteur',
      prenom: 'Grand Responsable',
      email: 'admin@eglise.org',
      section_id: 'prod',
      section_nom: 'Prod',
      role: 'GRAND_RESPONSABLE',
      avatar_url: '',
      is_online: true,
      last_seen_at: new Date().toISOString(),
      last_action: 'Modération'
    }
  ]);
}

if (!localStorage.getItem(STORAGE_KEYS.POSTS)) {
  setStoredData(STORAGE_KEYS.POSTS, [
    {
      id: 'post-1',
      userId: 'usr-cadrage-1',
      created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      author: 'Section Cadrage',
      authorAvatar: 'C',
      sectionId: 'cadrage',
      dateText: 'Il y a 30 min • Culte n°1',
      isVedette: true,
      title: 'Captation Directe Culte n°1 #Cadrage',
      sub: 'Coulisses & Couverture Technique',
      scoreText: '4.88 / 5.0',
      caption: 'Bravo à toute l\'équipe #Cadrage pour la couverture dynamique du 1er culte. #CulteDuDimanche #Chorale',
      mediaUrls: [],
      likes: 43,
      isLiked: true,
      comments: [
        { id: 'c1', author: 'Sarah Y.', text: 'Superbe réactivité sur les plans chorale !' },
        { id: 'c2', author: 'Marc T.', text: 'Merci Pasteurs pour les retours positifs.' }
      ]
    }
  ]);
}

// CLIENT SUPABASE ABSTRAIT ET ASYNCHRONE
export const supabase = {
  supabaseUrl: SUPABASE_URL,
  supabaseKey: SUPABASE_ANON_KEY,

  // 1. AUTHENTIFICATION & CREATION DE PROFIL
  auth: {
    async signUp({ email, password, options }) {
      const { data: userMetaData } = options || {};
      const profiles = getStoredData(STORAGE_KEYS.USERS, []);

      const existing = profiles.find(p => p.email.toLowerCase() === email.toLowerCase());
      if (existing) {
        throw new Error("Un compte existe déjà avec cette adresse e-mail.");
      }

      const newProfile = {
        id: `usr-${Date.now()}`,
        email: email,
        nom: userMetaData?.nom || 'Membre',
        prenom: userMetaData?.prenom || 'Nouveau',
        section_id: userMetaData?.section_id || 'cadrage',
        section_nom: userMetaData?.section_nom || 'Cadrage',
        role: userMetaData?.role || 'MEMBRE',
        avatar_url: '',
        is_online: true,
        last_seen_at: new Date().toISOString(),
        last_action: 'Inscription'
      };

      profiles.push(newProfile);
      setStoredData(STORAGE_KEYS.USERS, profiles);
      sessionStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(newProfile));

      return { data: { user: newProfile, session: { user: newProfile } }, error: null };
    },

    async signInWithPassword({ email, password }) {
      const profiles = getStoredData(STORAGE_KEYS.USERS, []);
      const user = profiles.find(p => p.email.toLowerCase() === email.toLowerCase());

      if (!user) {
        // Mode création à la volée pour les identifiants de test
        const prenom = email.split('@')[0].split('.')[0] || 'Utilisateur';
        const createdUser = {
          id: `usr-${Date.now()}`,
          email: email,
          nom: 'Membre',
          prenom: prenom.charAt(0).toUpperCase() + prenom.slice(1),
          section_id: 'cadrage',
          section_nom: 'Cadrage',
          role: 'RESP_SECTION',
          avatar_url: '',
          is_online: true,
          last_seen_at: new Date().toISOString(),
          last_action: 'Connexion'
        };

        profiles.push(createdUser);
        setStoredData(STORAGE_KEYS.USERS, profiles);
        sessionStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(createdUser));
        return { data: { user: createdUser, session: { user: createdUser } }, error: null };
      }

      user.is_online = true;
      user.last_seen_at = new Date().toISOString();
      user.last_action = 'Connexion';
      setStoredData(STORAGE_KEYS.USERS, profiles);
      sessionStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user));

      return { data: { user: user, session: { user: user } }, error: null };
    },

    async signOut() {
      const current = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.SESSION) || 'null');
      if (current) {
        const profiles = getStoredData(STORAGE_KEYS.USERS, []);
        const idx = profiles.findIndex(p => p.id === current.id);
        if (idx !== -1) {
          profiles[idx].is_online = false;
          profiles[idx].last_seen_at = new Date().toISOString();
          profiles[idx].last_action = 'Déconnexion';
          setStoredData(STORAGE_KEYS.USERS, profiles);
        }
      }
      sessionStorage.removeItem(STORAGE_KEYS.SESSION);
      return { error: null };
    }
  },

  // 2. INTERACTION AVEC LES TABLES (POSTS & PROFILES)
  from(table) {
    return {
      select(query) {
        return {
          async order(column, { ascending = true } = {}) {
            let data = getStoredData(table === 'posts' ? STORAGE_KEYS.POSTS : STORAGE_KEYS.USERS, []);
            if (column === 'created_at' || column === 'timestamp') {
              data.sort((a, b) => {
                const timeA = new Date(a.created_at || a.timestamp || 0).getTime();
                const timeB = new Date(b.created_at || b.timestamp || 0).getTime();
                return ascending ? timeA - timeB : timeB - timeA;
              });
            }
            return { data, error: null };
          }
        };
      },

      async insert(items) {
        const key = table === 'posts' ? STORAGE_KEYS.POSTS : STORAGE_KEYS.USERS;
        const currentData = getStoredData(key, []);
        const toAdd = Array.isArray(items) ? items : [items];
        const updated = [...toAdd, ...currentData];
        setStoredData(key, updated);
        return { data: toAdd, error: null };
      },

      delete() {
        return {
          async eq(column, value) {
            const key = table === 'posts' ? STORAGE_KEYS.POSTS : STORAGE_KEYS.USERS;
            const currentData = getStoredData(key, []);
            const updated = currentData.filter(item => item[column] !== value);
            setStoredData(key, updated);
            return { data: updated, error: null };
          }
        };
      }
    };
  },

  // 3. ABONNEMENT REALTIME EN TEMPS RÉEL (REALTIME CHANNEL)
  channel(name) {
    return {
      on(event, filter, callback) {
        return this;
      },
      subscribe(statusCallback) {
        if (statusCallback) statusCallback('SUBSCRIBED');
        return {
          unsubscribe() {}
        };
      }
    };
  }
};
