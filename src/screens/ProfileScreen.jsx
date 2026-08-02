import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert
} from 'react-native';
import { styles, COLORS } from './profileStyles';

export default function ProfileScreen() {
  // Profil Utilisateur
  const [user, setUser] = useState({
    nom: 'Éric Kouamé',
    email: 'eric.cadrage@eglise.org',
    role: 'RESP_SECTION', // 'RESP_SECTION' ou 'STAGIAIRE'
    sectionNom: 'Cadrage',
    isStagiaireBadge: false, // Conditionné au rôle STAGIAIRE
    trustScore: 98.5, // Float 0-100%
    servicesCompleted: 45,
    averageRating: 4.88,
  });

  const [activeBottomTab, setActiveBottomTab] = useState('profile');

  // Basculer en mode Stagiaire pour démo visuelle du Badge
  const toggleStagiaireRole = () => {
    setUser(prev => {
      const isStag = prev.role !== 'STAGIAIRE';
      return {
        ...prev,
        role: isStag ? 'STAGIAIRE' : 'RESP_SECTION',
        isStagiaireBadge: isStag,
        trustScore: isStag ? 92.0 : 98.5
      };
    });
  };

  // Synchronisation avec l'agenda du téléphone
  const handleSyncCalendar = () => {
    Alert.alert(
      "Synchronisation Agenda",
      "Vos 3 prochains services cultes de Dimanche ont été ajoutés à l'agenda de votre téléphone avec des rappels 2h avant le début.",
      [{ text: "Super !", style: "default" }]
    );
  };

  // Gestion des disponibilités
  const handleManageAvailability = () => {
    Alert.alert(
      "Gestion des Disponibilités",
      "Vos disponibilités pour les cultes du mois d'Août sont actuellement configurées sur : TOUS LES DIMANCHES.\n\nSouhaitez-vous déclarer une indisponibilité ?",
      [
        { text: "Déclarer une absence", style: "destructive", onPress: () => Alert.alert("Information", "Absence transmise au Chef de Département.") },
        { text: "Conserver disponible", style: "cancel" }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* 1. HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>Département Communication</Text>
          <Text style={styles.headerTitle}>Mon Profil</Text>
        </View>

        {/* Bouton démo bascule rôle */}
        <TouchableOpacity
          style={{ backgroundColor: COLORS.appleBlueLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 }}
          onPress={toggleStagiaireRole}
        >
          <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.appleBlue }}>
            🔄 Rôle: {user.role}
          </Text>
        </TouchableOpacity>
      </View>

      {/* CONTENU SCROLLABLE */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >

        {/* 2. CARTE PROFIL & BADGE STAGIAIRE CONDITIONNEL */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{user.nom.charAt(0)}</Text>
          </View>

          <Text style={styles.userName}>{user.nom}</Text>
          <Text style={styles.userRole}>
            {user.role} • Section {user.sectionNom}
          </Text>

          {/* BADGE STAGIAIRE CONDITIONNEL (si is_stagiaire_badge == true) */}
          {user.isStagiaireBadge && (
            <View style={styles.stagiaireBadge}>
              <Text style={{ fontSize: 13 }}>🐣</Text>
              <Text style={styles.stagiaireBadgeText}>Badge Stagiaire en Formation</Text>
            </View>
          )}
        </View>

        {/* 3. JAUGE D'INDICE DE CONFIANCE (TRUST SCORE) */}
        <View style={styles.trustCard}>
          <Text style={styles.trustCardTitle}>Indice de Confiance (Trust Score)</Text>

          <View style={styles.gaugeRow}>
            {/* Jauge Circulaire Visuelle */}
            <View style={styles.circleGauge}>
              <Text style={styles.gaugeScoreText}>{user.trustScore}%</Text>
              <Text style={styles.gaugeLabelText}>Fiabilité</Text>
            </View>

            {/* Statistiques en Colonne */}
            <View style={styles.statsColumn}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{user.servicesCompleted} Services</Text>
                <Text style={styles.statLabel}>Effectués au culte</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statValue}>{user.averageRating.toFixed(2)} / 5.0 ★</Text>
                <Text style={styles.statLabel}>Note moyenne reçue</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 4. SECTION BADGES ET COMPÉTENCES */}
        <Text style={styles.sectionTitle}>Badges & Compétences Accréditées</Text>

        <View style={styles.badgesGrid}>
          <View style={styles.badgeItem}>
            <Text style={styles.badgeIcon}>🎥</Text>
            <Text style={styles.badgeText}>Expert Caméra Live</Text>
          </View>

          <View style={styles.badgeItem}>
            <Text style={styles.badgeIcon}>🎓</Text>
            <Text style={styles.badgeText}>Formateur Cadrage</Text>
          </View>

          <View style={styles.badgeItem}>
            <Text style={styles.badgeIcon}>🎛️</Text>
            <Text style={styles.badgeText}>Régie Technique</Text>
          </View>

          <View style={styles.badgeItem}>
            <Text style={styles.badgeIcon}>⏰</Text>
            <Text style={styles.badgeText}>Ponctualité Or (100%)</Text>
          </View>
        </View>

        {/* 5. BOUTONS D'ACTION ET CONFIGURATION */}
        <Text style={styles.sectionTitle}>Actions & Réglages</Text>

        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.btnActionPrimary} onPress={handleSyncCalendar}>
            <Text style={{ fontSize: 18 }}>📅</Text>
            <Text style={styles.btnActionPrimaryText}>
              Synchroniser avec l'agenda du téléphone
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnActionSecondary} onPress={handleManageAvailability}>
            <Text style={{ fontSize: 18 }}>⚙️</Text>
            <Text style={styles.btnActionSecondaryText}>
              Gérer mes disponibilités de culte
            </Text>
          </TouchableOpacity>
        </View>

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
