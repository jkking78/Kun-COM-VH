import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { styles } from './hallOfFameStyles';

// DONNÉES ARCHIVÉES (POST-24H)
const MOCK_SERVICE_VEDETTES = [
  {
    id: 'ved-1',
    date: 'Dimanche 02 Août 2026',
    culte: 'Culte n°1',
    sectionVedette: 'Cadrage',
    icon: '🎥',
    score: 4.88,
    noteDetail: 'Plans dynamiques fluides & excellente gestion du cadrage live.'
  },
  {
    id: 'ved-2',
    date: 'Dimanche 26 Juillet 2026',
    culte: 'Culte n°2',
    sectionVedette: 'Régie',
    icon: '🎛️',
    score: 4.95,
    noteDetail: 'Qualité acoustique irréprochable et retours scène parfaits.'
  },
  {
    id: 'ved-3',
    date: 'Dimanche 19 Juillet 2026',
    culte: 'Culte n°1',
    sectionVedette: 'Web & Direct',
    icon: '🌐',
    score: 4.80,
    noteDetail: 'Zéro coupure réseau, stream 4K HD fluide.'
  }
];

const MOCK_MONTH_WINNER = {
  month: 'Août 2026',
  sectionVedette: 'Cadrage',
  icon: '🎥',
  score: 4.92,
  servicesCount: 8,
  description: 'Équipe la plus constante et la mieux notée du mois.'
};

const MOCK_YEAR_WINNER = {
  year: 'Saison 2025 - 2026',
  sectionVedette: 'Régie Technique',
  icon: '🎛️',
  score: 4.96,
  description: 'Trophée annuel de l\'Excellence du Département Communication'
};

export default function HallOfFameScreen() {
  const [activeTabNav, setActiveTabNav] = useState('service'); // 'service', 'month', 'year'
  const [activeBottomTab, setActiveBottomTab] = useState('home');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* 1. HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>Archives Permanentes (Post-24h)</Text>
          <Text style={styles.headerTitle}>Espace Vedettes 🌟</Text>
        </View>
      </View>

      {/* 2. NAVIGATION PAR 3 ONGLETS */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTabNav === 'service' && styles.tabBtnActive]}
          onPress={() => setActiveTabNav('service')}
        >
          <Text style={[styles.tabBtnText, activeTabNav === 'service' && styles.tabBtnTextActive]}>
            Par Service
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTabNav === 'month' && styles.tabBtnActive]}
          onPress={() => setActiveTabNav('month')}
        >
          <Text style={[styles.tabBtnText, activeTabNav === 'month' && styles.tabBtnTextActive]}>
            Du Mois
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTabNav === 'year' && styles.tabBtnActive]}
          onPress={() => setActiveTabNav('year')}
        >
          <Text style={[styles.tabBtnText, activeTabNav === 'year' && styles.tabBtnTextActive]}>
            De l'Année
          </Text>
        </TouchableOpacity>
      </View>

      {/* CONTENU SCROLLABLE */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ONGLET 1: PAR SERVICE */}
        {activeTabNav === 'service' && (
          <View>
            {MOCK_SERVICE_VEDETTES.map(item => (
              <View key={item.id} style={styles.serviceCard}>
                <View style={styles.serviceCardHeader}>
                  <View>
                    <Text style={styles.serviceDate}>{item.date}</Text>
                    <Text style={styles.serviceTitle}>{item.culte}</Text>
                  </View>
                  <View style={styles.goldPill}>
                    <Text style={styles.goldPillText}>★ {item.score.toFixed(2)}</Text>
                  </View>
                </View>

                <View style={styles.winnerBox}>
                  <View style={styles.winnerTextGroup}>
                    <Text style={styles.winnerIcon}>{item.icon}</Text>
                    <Text style={styles.winnerSectionName}>Section Vedette : {item.sectionVedette}</Text>
                  </View>
                  <Text style={styles.winnerScore}>🏆 N°1</Text>
                </View>

                <Text style={{ fontSize: 13, color: '#666', marginTop: 10, fontStyle: 'italic' }}>
                  "{item.noteDetail}"
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ONGLET 2: DU MOIS */}
        {activeTabNav === 'month' && (
          <View style={styles.monthCard}>
            <Text style={styles.trophyIconLarge}>🥇</Text>
            <Text style={styles.monthTitle}>Section N°1 du Mois de {MOCK_MONTH_WINNER.month}</Text>
            <Text style={styles.monthSectionName}>{MOCK_MONTH_WINNER.icon} {MOCK_MONTH_WINNER.sectionVedette}</Text>
            <Text style={styles.monthScoreText}>
              Note Moyenne Cumulée : {MOCK_MONTH_WINNER.score} / 5.0 ★
            </Text>

            <View style={styles.teamPhotoPlaceholder}>
              <Text style={{ fontSize: 40 }}>👥📸</Text>
              <Text style={styles.teamPhotoText}>Photo Officielle de l'Équipe {MOCK_MONTH_WINNER.sectionVedette}</Text>
            </View>
          </View>
        )}

        {/* ONGLET 3: DE L'ANNÉE */}
        {activeTabNav === 'year' && (
          <View style={styles.yearCard}>
            <Text style={styles.yearTrophyIcon}>🏆</Text>
            <Text style={styles.yearLabel}>{MOCK_YEAR_WINNER.year}</Text>
            <Text style={styles.yearWinnerSection}>{MOCK_YEAR_WINNER.icon} {MOCK_YEAR_WINNER.sectionVedette}</Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 10, gap: 6 }}>
              <Text style={{ fontSize: 18, color: '#FFD700' }}>★★★★★</Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFFFFF' }}>{MOCK_YEAR_WINNER.score} / 5.0</Text>
            </View>

            <Text style={styles.yearSubtitle}>
              {MOCK_YEAR_WINNER.description}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* BOTTOM TAB BAR iOS (5 Onglets) */}
      <View style={styles.bottomTabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveBottomTab('home')}>
          <Text style={styles.tabIcon}>🏠</Text>
          <Text style={[styles.tabLabel, activeBottomTab === 'home' && styles.tabLabelActive]}>Accueil</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveBottomTab('planning')}>
          <Text style={styles.tabIcon}>📅</Text>
          <Text style={[styles.tabLabel, activeBottomTab === 'planning' && styles.tabLabelActive]}>Planning</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.publishButton} onPress={() => setActiveBottomTab('publish')}>
          <Text style={styles.publishButtonText}>+</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveBottomTab('notes')}>
          <Text style={styles.tabIcon}>📝</Text>
          <Text style={[styles.tabLabel, activeBottomTab === 'notes' && styles.tabLabelActive]}>Débrief</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveBottomTab('profile')}>
          <Text style={styles.tabIcon}>👤</Text>
          <Text style={[styles.tabLabel, activeBottomTab === 'profile' && styles.tabLabelActive]}>Profil</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
