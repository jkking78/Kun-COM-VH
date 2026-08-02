import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert
} from 'react-native';
import { styles, COLORS } from './planningScreenStyles';

// 1. DONNÉES DE SIMULATION - CALENDRIER SEMAINE (Dimanche 02 Août 2026 en avant)
const WEEK_DAYS = [
  { id: '1', day: 'JEU', date: '30', isSunday: false },
  { id: '2', day: 'VEN', date: '31', isSunday: false },
  { id: '3', day: 'SAM', date: '01', isSunday: false },
  { id: '4', day: 'DIM', date: '02', isSunday: true }, // Dimanche actif
  { id: '5', day: 'LUN', date: '03', isSunday: false },
  { id: '6', day: 'MAR', date: '04', isSunday: false },
  { id: '7', day: 'MER', date: '05', isSunday: false },
];

// 2. DONNÉES DE SIMULATION - LES 3 CULTES DU DIMANCHE
const INITIAL_CULTES = [
  {
    id: 1,
    title: 'Culte 1 - Premier Service',
    hours: '07h00 - 09h00',
    statut: 'EN_COURS', // 'EN_COURS', 'EN_TRANSITION', 'CLOTURE', 'A_VENIR'
    assignments: [
      { section: 'Cadrage', icon: '🎥', members: 'Éric K. (Resp), Marc T.' },
      { section: 'Régie', icon: '🎛️', members: 'Jean-Luc P.' },
      { section: 'Web & Direct', icon: '🌐', members: 'Daniel K.' },
      { section: 'Photo', icon: '📸', members: 'Sarah Y.' },
      { section: 'Projection', icon: '🖥️', members: 'Kevin B. (Stagiaire)' },
    ]
  },
  {
    id: 2,
    title: 'Culte 2 - Second Service',
    hours: '09h15 - 11h15',
    statut: 'A_VENIR',
    assignments: [
      { section: 'Cadrage', icon: '🎥', members: 'Marc T., Alain B.' },
      { section: 'Régie', icon: '🎛️', members: 'Jean-Luc P., Yves K.' },
      { section: 'Web & Direct', icon: '🌐', members: 'Daniel K.' },
      { section: 'Photo', icon: '📸', members: 'Sarah Y.' },
      { section: 'Vente', icon: '🛒', members: 'Marthe D.' },
    ]
  },
  {
    id: 3,
    title: 'Culte 3 - Culte de Célébration',
    hours: '11h30 - 13h30',
    statut: 'A_VENIR',
    assignments: [
      { section: 'Cadrage', icon: '🎥', members: 'Éric K., Alain B.' },
      { section: 'Prod & Visuels', icon: '🎬', members: 'Michel N.' },
      { section: 'Régie', icon: '🎛️', members: 'Yves K.' },
      { section: 'Photo', icon: '📸', members: 'Sarah Y.' },
    ]
  }
];

export default function PlanningScreen() {
  const [selectedDate, setSelectedDate] = useState('4'); // ID du Dimanche 02
  const [currentUserRole, setCurrentUserRole] = useState('RESP_SECTION'); // 'RESP_SECTION' ou 'MEMBRE'
  const [cultes, setCultes] = useState(INITIAL_CULTES);
  
  // État Mode Transition (Pause 15 min = 900 sec)
  const [transitionState, setTransitionState] = useState({
    active: false,
    fromCulteId: null,
    toCulteId: null,
    secondsLeft: 900, // 15 min = 900 sec
  });

  // État du Check-in rapide du membre
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('planning');

  // Décompte de la transition de 15 minutes
  useEffect(() => {
    let interval = null;
    if (transitionState.active && transitionState.secondsLeft > 0) {
      interval = setInterval(() => {
        setTransitionState(prev => ({
          ...prev,
          secondsLeft: prev.secondsLeft - 1
        }));
      }, 1000);
    } else if (transitionState.secondsLeft === 0 && transitionState.active) {
      // Transition terminée -> Lancer le culte suivant
      startNextCulte(transitionState.toCulteId);
    }
    return () => clearInterval(interval);
  }, [transitionState.active, transitionState.secondsLeft]);

  // Formatage du Timer (mm:ss)
  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ACTION RESPONSABLE: Terminer un Culte X & Déclencher la Transition de 15 min
  const handleFinishCulte = (culteId) => {
    setCultes(prev => prev.map(c => {
      if (c.id === culteId) {
        return { ...c, statut: 'CLOTURE' };
      }
      return c;
    }));

    const nextCulteId = culteId + 1;
    if (nextCulteId <= 3) {
      // Déclencher le mode transition vers le culte suivant
      setTransitionState({
        active: true,
        fromCulteId: culteId,
        toCulteId: nextCulteId,
        secondsLeft: 900, // Reset 15 min
      });

      // Mettre à jour le statut du culte suivant en EN_TRANSITION
      setCultes(prev => prev.map(c => {
        if (c.id === nextCulteId) {
          return { ...c, statut: 'EN_TRANSITION' };
        }
        return c;
      }));
    }
  };

  // Démarrer le Culte suivant après la transition
  const startNextCulte = (nextCulteId) => {
    setTransitionState(prev => ({ ...prev, active: false }));
    setCultes(prev => prev.map(c => {
      if (c.id === nextCulteId) {
        return { ...c, statut: 'EN_COURS' };
      }
      return c;
    }));
  };

  // ACTION RESPONSABLE: Clôturer la Journée du Dimanche
  const handleCloseSundayDay = () => {
    Alert.alert(
      "Clôture du Dimanche",
      "Êtes-vous sûr de vouloir clôturer la journée ? Le Bilan Global sera généré et transmis pour validation des notes.",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Clôturer la Journée", 
          onPress: () => {
            setCultes(prev => prev.map(c => ({ ...c, statut: 'CLOTURE' })));
            setTransitionState(prev => ({ ...prev, active: false }));
            Alert.alert("Succès", "Journée clôturée avec succès ! Le Bilan 24h a été soumis aux administrateurs.");
          }
        }
      ]
    );
  };

  // Toggle Rôle pour Démo
  const toggleUserRole = () => {
    setCurrentUserRole(prev => (prev === 'RESP_SECTION' ? 'MEMBRE' : 'RESP_SECTION'));
  };

  // Validation du Check-in rapide
  const handleCheckIn = () => {
    setIsCheckedIn(true);
  };

  const isManager = ['RESP_SECTION', 'GRAND_RESPONSABLE'].includes(currentUserRole);
  const allCultesClosed = cultes.every(c => c.statut === 'CLOTURE');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* 1. HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>Église • Dept Communication</Text>
          <Text style={styles.headerTitle}>Planning Cultes</Text>
        </View>

        {/* Bouton de bascule de rôle pour démo */}
        <TouchableOpacity style={styles.roleToggleButton} onPress={toggleUserRole}>
          <Text style={styles.roleToggleText}>
            👤 {currentUserRole === 'RESP_SECTION' ? 'Vue: Responsable' : 'Vue: Membre'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 2. CALENDRIER HORIZONTAL */}
      <View style={styles.calendarContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.calendarScrollContent}
        >
          {WEEK_DAYS.map(item => {
            const isActive = selectedDate === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.dateItem, isActive && styles.dateItemActive]}
                onPress={() => setSelectedDate(item.id)}
              >
                <Text style={[styles.dateDayText, isActive && styles.dateDayTextActive]}>
                  {item.day}
                </Text>
                <Text style={[styles.dateNumberText, isActive && styles.dateNumberTextActive]}>
                  {item.date}
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

        {/* 3. MODE TRANSITION (PAUSE DE 30 MINUTES) */}
        {transitionState.active && (
          <View style={styles.transitionBanner}>
            <View style={styles.transitionHeader}>
              <Text style={styles.transitionTitle}>
                ⏳ Transition Culte {transitionState.fromCulteId} ➜ Culte {transitionState.toCulteId}
              </Text>
              <View style={styles.timerBadge}>
                <Text style={styles.timerText}>{formatTimer(transitionState.secondsLeft)}</Text>
              </View>
            </View>

            <Text style={styles.transitionSubtitle}>
              Pause technique de 15 minutes : mise en place du matériel, débrief express et préparation des équipes.
            </Text>

            {/* Mini Carte Check-in Rapide */}
            <View style={styles.checkInCard}>
              <View style={styles.checkInLeft}>
                <Text style={styles.checkInIcon}>📍</Text>
                <View>
                  <Text style={styles.checkInTitle}>Check-in Rapide Presence</Text>
                  <Text style={styles.checkInSub}>Validez votre arrivée pour le Culte {transitionState.toCulteId}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.checkInBtn, isCheckedIn && styles.checkInBtnDone]}
                onPress={handleCheckIn}
                disabled={isCheckedIn}
              >
                <Text style={styles.checkInBtnText}>
                  {isCheckedIn ? '✓ Présent' : 'Valider'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 4. LES 3 CULTES DU DIMANCHE */}
        {cultes.map((culte) => {
          let badgeStyle = styles.statusBadgeAVenir;
          let badgeTextStyle = styles.statusBadgeTextAVenir;
          let statusLabel = 'À VENIR';

          if (culte.statut === 'EN_COURS') {
            badgeStyle = styles.statusBadgeEnCours;
            badgeTextStyle = styles.statusBadgeTextEnCours;
            statusLabel = '● EN COURS';
          } else if (culte.statut === 'EN_TRANSITION') {
            badgeStyle = styles.statusBadgeTransition;
            badgeTextStyle = styles.statusBadgeTextTransition;
            statusLabel = '⏳ EN TRANSITION';
          } else if (culte.statut === 'CLOTURE') {
            badgeStyle = styles.statusBadgeCloture;
            badgeTextStyle = styles.statusBadgeTextCloture;
            statusLabel = '✓ CLÔTURÉ';
          }

          return (
            <View key={culte.id} style={styles.culteCard}>
              <View style={styles.culteCardHeader}>
                <View>
                  <Text style={styles.culteName}>{culte.title}</Text>
                  <Text style={styles.culteHours}>Horaires : {culte.hours}</Text>
                </View>

                {/* Badge de Statut */}
                <View style={[styles.statusBadge, badgeStyle]}>
                  <Text style={badgeTextStyle}>{statusLabel}</Text>
                </View>
              </View>

              {/* Affectations par Section */}
              <Text style={styles.sectionsAssignmentTitle}>Affectations des Équipes</Text>
              <View style={styles.assignmentsGrid}>
                {culte.assignments.map((ass, idx) => (
                  <View key={idx} style={styles.assignmentRow}>
                    <View style={styles.sectionBadgeTag}>
                      <Text style={styles.sectionBadgeIcon}>{ass.icon}</Text>
                      <Text style={styles.sectionBadgeName}>{ass.section}</Text>
                    </View>
                    <Text style={styles.membersAssignedText}>{ass.members}</Text>
                  </View>
                ))}
              </View>

              {/* 5. BOUTONS D'ACTION DU RESPONSABLE */}
              {isManager && culte.statut === 'EN_COURS' && (
                <View style={styles.managerActionContainer}>
                  <TouchableOpacity
                    style={styles.actionBtnFinish}
                    onPress={() => handleFinishCulte(culte.id)}
                  >
                    <Text style={styles.actionBtnFinishText}>
                      🏁 Terminer le Culte {culte.id} & Lancer la Transition (15 min)
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        {/* Bouton de Clôture Générale du Dimanche (Disponible quand Culte 3 est fermé) */}
        {isManager && (
          <TouchableOpacity
            style={styles.actionBtnCloseDay}
            onPress={handleCloseSundayDay}
          >
            <Text style={styles.actionBtnCloseDayText}>
              👑 Clôturer la Journée du Dimanche & Générer Bilan Global
            </Text>
          </TouchableOpacity>
        )}

      </ScrollView>

      {/* BOTTOM TAB BAR iOS (5 Onglets) */}
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
