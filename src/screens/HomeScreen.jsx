import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { styles, COLORS } from './homeScreenStyles';

// 1. LES 7 SECTIONS DU DÉPARTEMENT
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

// 2. DONNÉES DU BILAN 24H (Clean, sans libellés techniques de debug)
const MOCK_BILAN_24H = {
  id: 'bilan-2026-08-02',
  dateService: 'Dimanche 02 Août 2026',
  numCulte: 1,
  valideParAdmin: true,
  sectionVedette: {
    id: 'cadrage',
    nom: 'Cadrage',
    icon: '🎥',
  },
  evaluations: [
    { id: 'n1', notateurNom: 'Sarah Yao', noteValeur: 4.5 },
    { id: 'n2', notateurNom: 'Éric Kouamé', noteValeur: 4.8 },
    { id: 'n3', notateurNom: 'Pasteur Daniel', noteValeur: 5.0 }
  ]
};

// 3. DONNÉES DU FEED CLASSIQUE
const MOCK_PUBLICATIONS = [
  {
    id: 'pub-1',
    author: 'Éric Kouamé',
    time: 'Il y a 2h',
    section: 'Cadrage',
    content: 'Bravo à toute l\'équipe Cadrage pour la captation directe du 1er culte ! Les plans serrés sur la chorale étaient parfaitement synchronisés.',
    likesCount: 14,
    commentsCount: 3,
  },
  {
    id: 'pub-2',
    author: 'Sarah Yao',
    time: 'Il y a 5h',
    section: 'Photo',
    content: 'Album photo complet du culte disponible sur la plateforme. Merci aux membres pour le tri rapide !',
    likesCount: 22,
    commentsCount: 8,
  }
];

export default function HomeScreen() {
  const [selectedSection, setSelectedSection] = useState('all');
  const [activeTab, setActiveTab] = useState('home');
  const [likedPosts, setLikedPosts] = useState({});

  const toggleLike = (pubId) => {
    setLikedPosts(prev => ({ ...prev, [pubId]: !prev[pubId] }));
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* 1. HEADER APPLE LARGE TITLE */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>Département Communication</Text>
          <Text style={styles.headerTitle}>Accueil</Text>
        </View>

        <View style={styles.headerRight}>
          {/* Avatar Subtil */}
          <TouchableOpacity style={styles.profileAvatarBtn}>
            <Text style={styles.profileAvatarText}>É</Text>
          </TouchableOpacity>

          {/* Pastille Notification */}
          <TouchableOpacity style={styles.notificationButton}>
            <Text style={{fontSize: 18}}>🔔</Text>
            <View style={styles.notificationBadge} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. CARROUSEL FILTRES PILULES */}
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

      {/* CONTENU SCROLLABLE */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 3. CARTE BILAN DE CULTE PREMIUM */}
        {MOCK_BILAN_24H.valideParAdmin && (
          <View style={styles.bilanCard}>
            <View style={styles.bilanHeader}>
              <View>
                <Text style={styles.culteDateText}>{MOCK_BILAN_24H.dateService}</Text>
                <Text style={styles.culteTitle}>Bilan Culte n°{MOCK_BILAN_24H.numCulte}</Text>
              </View>

              {/* Badge Métallique Raffiné */}
              <View style={styles.goldBadge}>
                <Text style={styles.goldBadgeIcon}>🏆</Text>
                <Text style={styles.goldBadgeText}>
                  SECTION VEDETTE : {MOCK_BILAN_24H.sectionVedette.nom.toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Liste Membres Épurée avec Étoiles Dorées */}
            <View style={styles.membersList}>
              {MOCK_BILAN_24H.evaluations.map(item => (
                <View key={item.id} style={styles.memberRow}>
                  <View style={styles.memberLeft}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{item.notateurNom.charAt(0)}</Text>
                    </View>
                    <Text style={styles.memberName}>{item.notateurNom}</Text>
                  </View>

                  <View style={styles.starsRow}>
                    <Text style={styles.starIcon}>★</Text>
                    <Text style={styles.ratingValueText}>{item.noteValeur.toFixed(1)}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Jauge Moyenne Globale */}
            <View style={styles.globalAverageBox}>
              <Text style={styles.globalAverageLabel}>Moyenne Globale</Text>
              <View style={styles.globalAveragePill}>
                <Text style={styles.globalAverageValue}>4.88 / 5.0 ★</Text>
              </View>
            </View>
          </View>
        )}

        {/* 4. FEED CLASSIQUE */}
        <Text style={[styles.culteTitle, {fontSize: 18, marginBottom: 12}]}>
          Publications & Activités
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

              {/* Actions Feed */}
              <View style={styles.feedActionsRow}>
                <TouchableOpacity style={styles.actionButton} onPress={() => toggleLike(pub.id)}>
                  <Text style={{fontSize: 15}}>{isLiked ? '❤️' : '🤍'}</Text>
                  <Text style={[styles.actionText, isLiked && {color: COLORS.redBadge, fontWeight: '700'}]}>
                    {pub.likesCount + (isLiked ? 1 : 0)} Likes
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton}>
                  <Text style={{fontSize: 15}}>💬</Text>
                  <Text style={styles.actionText}>{pub.commentsCount} Commentaires</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton}>
                  <Text style={{fontSize: 15}}>↗️</Text>
                  <Text style={styles.actionText}>Partager</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* 5. TAB BAR FLOTTANTE GLASSMORPHISM */}
      <View style={styles.bottomTabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('home')}>
          <Text style={styles.tabIcon}>🏠</Text>
          <Text style={[styles.tabLabel, activeTab === 'home' && styles.tabLabelActive]}>Accueil</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('planning')}>
          <Text style={styles.tabIcon}>📅</Text>
          <Text style={[styles.tabLabel, activeTab === 'planning' && styles.tabLabelActive]}>Planning</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.publishButton} onPress={() => setActiveTab('publish')}>
          <Text style={styles.publishButtonText}>+</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('notes')}>
          <Text style={styles.tabIcon}>📝</Text>
          <Text style={[styles.tabLabel, activeTab === 'notes' && styles.tabLabelActive]}>Débrief</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('profile')}>
          <Text style={styles.tabIcon}>👤</Text>
          <Text style={[styles.tabLabel, activeTab === 'profile' && styles.tabLabelActive]}>Profil</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
