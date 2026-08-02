import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Animated
} from 'react-native';
import { styles, COLORS } from './homeScreenStyles';

// 1. DONNÉES DE SIMULATION - SECTIONS DU DÉPARTEMENT (7 Sections)
const SECTIONS = [
  { id: 'all', nom: 'Toutes', icon: '✨' },
  { id: 'web', nom: 'Web', icon: '🌐' },
  { id: 'proj', nom: 'Projection', icon: '🖥️' },
  { id: 'prod', nom: 'Prod', icon: '🎬' },
  { id: 'regie', nom: 'Régie', icon: '🎛️' },
  { id: 'cadrage', nom: 'Cadrage', icon: '🎥' },
  { id: 'photo', nom: 'Photo', icon: '📸' },
  { id: 'vente', nom: 'Vente', icon: '🛒' },
];

// 2. DONNÉES DE SIMULATION - BILAN DE CULTE (24h Éphémère)
const MOCK_BILAN_24H = {
  id: 'bilan-2026-08-02',
  dateService: 'Dimanche 02 Août 2026',
  numCulte: 1,
  valideParAdmin: true,
  expirationTimestamp: new Date(Date.now() + 18 * 3600 * 1000).toISOString(), // Expire dans 18h
  sectionVedette: {
    id: 'cadrage',
    nom: 'Cadrage',
    icon: '🎥',
    titre: 'Section Vedette du Culte'
  },
  // Notes de la section évaluée avec pondération et confidentialité
  evaluations: [
    {
      id: 'n1',
      notateurNom: 'Sarah Yao',
      notateurRole: 'MEMBRE',
      sectionId: 'photo',
      noteValeur: 4.5,
      poidsNote: 1,
      isConfidentiel: false, // Public
    },
    {
      id: 'n2',
      notateurNom: 'Éric Kouamé (Resp)',
      notateurRole: 'RESP_SECTION',
      sectionId: 'cadrage',
      noteValeur: 4.8,
      poidsNote: 3,
      isConfidentiel: true, // Confidentiel (Masqué pour membre)
    },
    {
      id: 'n3',
      notateurNom: 'Pasteur Daniel (Chef Dept)',
      notateurRole: 'GRAND_RESPONSABLE',
      sectionId: 'web',
      noteValeur: 5.0,
      poidsNote: 5,
      isConfidentiel: true, // Confidentiel (Masqué pour membre)
    }
  ]
};

// 3. DONNÉES DE SIMULATION - FEED CLASSIQUE
const MOCK_PUBLICATIONS = [
  {
    id: 'pub-1',
    author: 'Éric Kouamé (Resp Cadrage)',
    role: 'RESP_SECTION',
    time: 'Il y a 2 heures',
    section: 'Cadrage',
    content: 'Bravo à toute l\'équipe Cadrage pour la captation directe du 1er culte ! Les plans serrés sur la chorale étaient parfaitement synchronisés.',
    likesCount: 14,
    commentsCount: 3,
    hasImage: true,
  },
  {
    id: 'pub-2',
    author: 'Sarah Yao',
    role: 'MEMBRE',
    time: 'Il y a 5 heures',
    section: 'Photo',
    content: 'Album photo complet du culte disponible sur la plateforme. Merci aux stagiaires pour l\'aide lors du tri.',
    likesCount: 22,
    commentsCount: 8,
    hasImage: false,
  }
];

export default function HomeScreen() {
  // États de l'application
  const [selectedSection, setSelectedSection] = useState('all');
  const [activeTab, setActiveTab] = useState('home');
  const [currentUserRole, setCurrentUserRole] = useState('MEMBRE'); // 'MEMBRE' ou 'GRAND_RESPONSABLE'
  const [likedPosts, setLikedPosts] = useState({});

  // Basculer le rôle utilisateur (Démo du Masquage Sécurisé)
  const toggleUserRole = () => {
    setCurrentUserRole(prev => (prev === 'MEMBRE' ? 'GRAND_RESPONSABLE' : 'MEMBRE'));
  };

  // Gestion des likes
  const toggleLike = (pubId) => {
    setLikedPosts(prev => ({ ...prev, [pubId]: !prev[pubId] }));
  };

  // Calcul de la moyenne des notes selon le rôle connecté (Filtrage Sécurisé)
  const renderEvaluationsList = () => {
    const isManager = ['GRAND_RESPONSABLE', 'RESP_SECTION'].includes(currentUserRole);

    // Filtrage conforme à la RÈGLE 2 DE SÉCURITÉ
    const visibleNotes = MOCK_BILAN_24H.evaluations.filter(n => {
      if (isManager) return true; // Les managers voient tout
      return !n.isConfidentiel;  // Les membres ne voient que les notes non-confidentielles
    });

    // Calcul moyenne globale pondérée sur les notes accessibles
    const totalWeighted = visibleNotes.reduce((acc, n) => acc + (n.noteValeur * n.poidsNote), 0);
    const totalWeights = visibleNotes.reduce((acc, n) => acc + n.poidsNote, 0);
    const globalAverage = totalWeights > 0 ? (totalWeighted / totalWeights).toFixed(2) : '0.0';

    return (
      <View>
        {/* Bandeau d'information Sécurité */}
        <View style={styles.securityBanner}>
          <Text style={styles.securityBannerText}>
            🔒 Rôle connecté : <Text style={{fontWeight: '800'}}>{currentUserRole}</Text>
            {isManager ? ' — Mode Responsable (Accès complet)' : ' — Masquage des notes confidentielles actif'}
          </Text>
        </View>

        {/* Liste des Évaluations */}
        <View style={styles.membersList}>
          {MOCK_BILAN_24H.evaluations.map(item => {
            const isNoteHidden = !isManager && item.isConfidentiel;

            return (
              <View key={item.id} style={styles.memberRow}>
                <View style={styles.memberLeft}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{item.notateurNom.charAt(0)}</Text>
                  </View>
                  <View>
                    <Text style={styles.memberName}>{item.notateurNom}</Text>
                    <Text style={styles.memberRoleBadge}>{item.notateurRole}</Text>
                  </View>
                </View>

                <View style={styles.ratingContainer}>
                  {isNoteHidden ? (
                    // Affichage masqué pour membre simple
                    <View style={{alignItems: 'flex-end'}}>
                      <Text style={styles.starsRow}>⭐⭐⭐⭐⭐</Text>
                      <Text style={styles.maskedTag}>🔒 Note confidentielle</Text>
                    </View>
                  ) : (
                    // Affichage détaillé pour Responsables ou Note Membre Public
                    <View style={{alignItems: 'flex-end'}}>
                      <View style={styles.starsRow}>
                        <Text style={styles.starIcon}>★</Text>
                        <Text style={styles.ratingValueText}>{item.noteValeur.toFixed(1)} / 5.0</Text>
                      </View>
                      <Text style={item.isConfidentiel ? styles.confidentialTag : styles.maskedTag}>
                        Poids: {item.poidsNote} {item.isConfidentiel ? '(Confidentiel)' : '(Public)'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Moyenne Globale */}
        <View style={styles.globalAverageBox}>
          <Text style={styles.globalAverageLabel}>Moyenne Pondérée Active</Text>
          <Text style={styles.globalAverageValue}>{globalAverage} / 5.0 ★</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* 1. HEADER FIXE */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>Département Communication</Text>
          <Text style={styles.headerTitle}>Accueil</Text>
        </View>

        <View style={styles.headerRight}>
          {/* Bouton de bascule de rôle (Démo Sécurité) */}
          <TouchableOpacity style={styles.roleToggleButton} onPress={toggleUserRole}>
            <Text style={styles.roleToggleText}>
              👤 {currentUserRole === 'MEMBRE' ? 'Vue: Membre' : 'Vue: Admin'}
            </Text>
          </TouchableOpacity>

          {/* Icône Notification avec Pastille Rouge */}
          <TouchableOpacity style={styles.notificationButton}>
            <Text style={{fontSize: 20}}>🔔</Text>
            <View style={styles.notificationBadge} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. CARROUSEL FILTRE DES 7 SECTIONS */}
      <View style={styles.sectionsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sectionsScrollContent}
        >
          {SECTIONS.map(section => {
            const isActive = selectedSection === section.id;
            return (
              <TouchableOpacity
                key={section.id}
                style={[styles.sectionChip, isActive && styles.sectionChipActive]}
                onPress={() => setSelectedSection(section.id)}
              >
                <Text style={styles.sectionIcon}>{section.icon}</Text>
                <Text style={[styles.sectionText, isActive && styles.sectionTextActive]}>
                  {section.nom}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* CONTENU PRINCIPAL SCROLLABLE */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 3. CARTE BILAN DE CULTE (24h Ephemeral Card) */}
        {MOCK_BILAN_24H.valideParAdmin && (
          <View style={styles.bilanCard}>
            <View style={styles.bilanHeader}>
              <View>
                <Text style={styles.culteDateText}>{MOCK_BILAN_24H.dateService}</Text>
                <Text style={styles.culteTitle}>Bilan Culte n°{MOCK_BILAN_24H.numCulte}</Text>
              </View>

              {/* Badge Doré pour Section Vedette */}
              <View style={styles.goldBadge}>
                <Text style={styles.goldBadgeIcon}>🏆</Text>
                <Text style={styles.goldBadgeText}>
                  {MOCK_BILAN_24H.sectionVedette.nom.toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Rendu des membres & filtrage de sécurité */}
            {renderEvaluationsList()}
          </View>
        )}

        {/* 4. FEED DE PUBLICATIONS CLASSIQUE */}
        <Text style={[styles.culteTitle, {fontSize: 18, marginBottom: 12}]}>
          Publications & Débriefs
        </Text>

        {MOCK_PUBLICATIONS.map(pub => {
          const isLiked = likedPosts[pub.id];
          return (
            <View key={pub.id} style={styles.feedCard}>
              <View style={styles.feedAuthorHeader}>
                <View style={styles.authorAvatar}>
                  <Text style={{fontWeight: '700', color: '#555'}}>{pub.author.charAt(0)}</Text>
                </View>
                <View>
                  <Text style={styles.authorName}>{pub.author}</Text>
                  <Text style={styles.feedTime}>{pub.time} • {pub.section}</Text>
                </View>
              </View>

              <Text style={styles.feedTextContent}>{pub.content}</Text>

              {pub.hasImage && (
                <View style={styles.feedImagePlaceholder}>
                  <Text style={{fontSize: 32}}>📸</Text>
                  <Text style={styles.feedImageText}>Captation vidéo Cadrage Live</Text>
                </View>
              )}

              {/* Actions Interaction */}
              <View style={styles.feedActionsRow}>
                <TouchableOpacity style={styles.actionButton} onPress={() => toggleLike(pub.id)}>
                  <Text style={{fontSize: 16}}>{isLiked ? '❤️' : '🤍'}</Text>
                  <Text style={[styles.actionText, isLiked && styles.actionTextActive]}>
                    {pub.likesCount + (isLiked ? 1 : 0)} Likes
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton}>
                  <Text style={{fontSize: 16}}>💬</Text>
                  <Text style={styles.actionText}>{pub.commentsCount} Commentaires</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton}>
                  <Text style={{fontSize: 16}}>↗️</Text>
                  <Text style={styles.actionText}>Partager</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* 5. BOTTOM TAB BAR iOS (5 Onglets) */}
      <View style={styles.bottomTabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('home')}
        >
          <Text style={styles.tabIcon}>🏠</Text>
          <Text style={[styles.tabLabel, activeTab === 'home' && styles.tabLabelActive]}>
            Accueil
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('planning')}
        >
          <Text style={styles.tabIcon}>📅</Text>
          <Text style={[styles.tabLabel, activeTab === 'planning' && styles.tabLabelActive]}>
            Planning
          </Text>
        </TouchableOpacity>

        {/* Bouton Central Surélevé Publier [+] */}
        <TouchableOpacity
          style={styles.publishButton}
          onPress={() => setActiveTab('publish')}
        >
          <Text style={styles.publishButtonText}>+</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('notes')}
        >
          <Text style={styles.tabIcon}>📝</Text>
          <Text style={[styles.tabLabel, activeTab === 'notes' && styles.tabLabelActive]}>
            Débrief
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('profile')}
        >
          <Text style={styles.tabIcon}>👤</Text>
          <Text style={[styles.tabLabel, activeTab === 'profile' && styles.tabLabelActive]}>
            Profil
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
