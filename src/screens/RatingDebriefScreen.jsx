import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  StatusBar,
  Alert
} from 'react-native';
import { styles, COLORS } from './ratingDebriefStyles';

// 1. LES 7 SECTIONS DU DÉPARTEMENT COMMUNICATION
const SECTIONS_LIST = [
  { id: 'web', nom: 'Web', icon: '🌐' },
  { id: 'proj', nom: 'Projection', icon: '🖥️' },
  { id: 'prod', nom: 'Prod', icon: '🎬' },
  { id: 'regie', nom: 'Régie', icon: '🎛️' },
  { id: 'cadrage', nom: 'Cadrage', icon: '🎥' },
  { id: 'photo', nom: 'Photo', icon: '📸' },
  { id: 'vente', nom: 'Vente', icon: '🛒' },
];

export default function RatingDebriefScreen() {
  // Profil de l'utilisateur connecté (Par défaut : Éric K., Resp Cadrage)
  const [currentUser, setCurrentUser] = useState({
    id: 'usr-102',
    nom: 'Éric Kouamé',
    role: 'GRAND_RESPONSABLE', // 'GRAND_RESPONSABLE', 'RESP_SECTION', 'MEMBRE'
    sectionId: 'cadrage', // SA SECTION
    sectionNom: 'Cadrage'
  });

  // État des notes saisies par section { [sectionId]: { score: 1-5, comment: '' } }
  const [ratings, setRatings] = useState({
    web: { score: 5, comment: 'Direct streaming sans coupures' },
    proj: { score: 4, comment: 'Transparents affichés dans les temps' },
    prod: { score: 4, comment: 'Bons effets de transition' },
    regie: { score: 5, comment: 'Son très propre' },
    photo: { score: 4, comment: 'Photos d\'accueil bien cadrées' },
    vente: { score: 4, comment: 'Support d\'écoute prêts' }
  });

  // Formulaire Débriefing Technique
  const [debriefForm, setDebriefForm] = useState({
    pointsForts: 'Superbe réactivité de l\'équipe Cadrage sur le prêche. Son régie impeccable.',
    pointsAmelioration: 'Prévoir un câble HDMI de secours pour la console projection 2.'
  });

  const [activeTab, setActiveTab] = useState('notes');

  // Mise à jour du score pour une section
  const handleRatingChange = (sectionId, score) => {
    if (sectionId === currentUser.sectionId) {
      Alert.alert("Action Interdite", "Vous ne pouvez pas noter votre propre section !");
      return;
    }
    setRatings(prev => ({
      ...prev,
      [sectionId]: { ...prev[sectionId], score }
    }));
  };

  // Mise à jour du commentaire pour une section
  const handleCommentChange = (sectionId, comment) => {
    setRatings(prev => ({
      ...prev,
      [sectionId]: { ...prev[sectionId], comment }
    }));
  };

  // Basculement de rôle pour Démo (MEMBRE vs RESP_SECTION vs GRAND_RESPONSABLE)
  const cycleUserRole = () => {
    const roles = ['GRAND_RESPONSABLE', 'RESP_SECTION', 'MEMBRE'];
    const nextIndex = (roles.indexOf(currentUser.role) + 1) % roles.length;
    setCurrentUser(prev => ({ ...prev, role: roles[nextIndex] }));
  };

  // ACTION GRAND_RESPONSABLE : Valider et Publier le Bilan 24h sur le Feed
  const handlePublishBilan24h = () => {
    // Calcul de la section vedette (meilleure moyenne)
    let bestSection = SECTIONS_LIST[0];
    let maxScore = 0;

    SECTIONS_LIST.forEach(sec => {
      const score = ratings[sec.id]?.score || 0;
      if (score > maxScore) {
        maxScore = score;
        bestSection = sec;
      }
    });

    const now = new Date();
    const expirationDate = new Date(now.getTime() + 24 * 3600 * 1000); // +24h

    Alert.alert(
      "Confirmation de Publication",
      `Êtes-vous sûr de valider le Bilan et de publier la carte 24h sur le Feed ?\n\n🏆 Section Vedette : ${bestSection.nom} (${maxScore}/5)\n⏰ Expiration : Demain à ${expirationDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Publier sur le Feed",
          onPress: () => {
            Alert.alert(
              "🚀 Publication Validée !",
              `Le Bilan de Culte a été publié avec succès sur le Fil d'Actualité principal.\n\nIl restera visible pendant exactement 24h avant d'être archivé dans le Hall of Fame.`
            );
          }
        }
      ]
    );
  };

  const isGrandResponsable = currentUser.role === 'GRAND_RESPONSABLE';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* 1. HEADER FIXE */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>Culte du Dimanche 02 Août</Text>
          <Text style={styles.headerTitle}>Notation & Débrief</Text>
        </View>

        {/* Badge Profil Utilisateur & Switcher de Rôle pour Démo */}
        <TouchableOpacity style={styles.userProfileBadge} onPress={cycleUserRole}>
          <Text style={styles.userProfileText}>
            👤 {currentUser.nom.split(' ')[0]} ({currentUser.role})
          </Text>
        </TouchableOpacity>
      </View>

      {/* CONTENU PRINCIPAL SCROLLABLE */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 2. SYSTÈME DE NOTATION INTER-SECTIONS */}
        <Text style={styles.sectionTitle}>1. Notation Inter-Sections</Text>
        <Text style={styles.sectionSubtitle}>
          Évaluez la prestation des autres sections lors du culte. Votre propre section est verrouillée.
        </Text>

        {SECTIONS_LIST.map((section) => {
          const isOwnSection = section.id === currentUser.sectionId;
          const currentRating = ratings[section.id] || { score: 0, comment: '' };

          return (
            <View
              key={section.id}
              style={[styles.ratingCard, isOwnSection && styles.ratingCardDisabled]}
            >
              <View style={styles.ratingCardHeader}>
                <View style={styles.sectionTag}>
                  <Text style={styles.sectionIcon}>{section.icon}</Text>
                  <Text style={styles.sectionName}>Section {section.nom}</Text>
                </View>

                {/* RÈGLE BLOQUANTE: Mentions si propre section */}
                {isOwnSection && (
                  <View style={styles.selfRatingBlockedBadge}>
                    <Text style={styles.selfRatingBlockedText}>
                      🔒 Auto-notation interdite
                    </Text>
                  </View>
                )}
              </View>

              {/* Rendu des Étoiles (Actives si section != propre section) */}
              <View style={styles.starsSelectorRow}>
                <View style={styles.starsGroup}>
                  {[1, 2, 3, 4, 5].map((starIndex) => {
                    const isSelected = starIndex <= currentRating.score;
                    return (
                      <TouchableOpacity
                        key={starIndex}
                        disabled={isOwnSection}
                        style={styles.starTouchable}
                        onPress={() => handleRatingChange(section.id, starIndex)}
                      >
                        <Text style={[styles.starIcon, isSelected && !isOwnSection && styles.starIconActive]}>
                          ★
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.scoreDisplay}>
                  {isOwnSection ? 'N/A' : `${currentRating.score} / 5`}
                </Text>
              </View>

              {/* Champ Commentaire Optionnel */}
              {!isOwnSection && (
                <TextInput
                  style={styles.commentInput}
                  placeholder="Ajouter une remarque / félicitation (optionnel)..."
                  placeholderTextColor={COLORS.disabledText}
                  value={currentRating.comment}
                  onChangeText={(text) => handleCommentChange(section.id, text)}
                />
              )}
            </View>
          );
        })}

        {/* 3. SECTION DÉBRIEFING TECHNIQUE */}
        <Text style={[styles.sectionTitle, { marginTop: 14 }]}>2. Débriefing Technique</Text>
        <Text style={styles.sectionSubtitle}>
          Renseignez les retours d'expérience pour mémoire et amélioration continue.
        </Text>

        <View style={styles.debriefContainer}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>🟢 Ce qui a bien fonctionné aujourd'hui (Points forts)</Text>
            <TextInput
              style={styles.textInputMulti}
              multiline
              numberOfLines={3}
              placeholder="Ex: Excellente synchronisation des caméras, retours son fluides..."
              placeholderTextColor={COLORS.disabledText}
              value={debriefForm.pointsForts}
              onChangeText={(text) => setDebriefForm(prev => ({ ...prev, pointsForts: text }))}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>🟠 Ce qui est à améliorer pour le prochain culte</Text>
            <TextInput
              style={styles.textInputMulti}
              multiline
              numberOfLines={3}
              placeholder="Ex: Câblage à vérifier en régie 15 min avant le début..."
              placeholderTextColor={COLORS.disabledText}
              value={debriefForm.pointsAmelioration}
              onChangeText={(text) => setDebriefForm(prev => ({ ...prev, pointsAmelioration: text }))}
            />
          </View>
        </View>

        {/* 4. VUE DE VALIDATION ET PUBLICATION (Réservée au GRAND_RESPONSABLE) */}
        {isGrandResponsable ? (
          <View style={styles.adminPublicationCard}>
            <View style={styles.adminCardHeader}>
              <Text style={{ fontSize: 24 }}>👑</Text>
              <Text style={styles.adminTitle}>Synthèse & Validation (Grand Responsable)</Text>
            </View>

            <Text style={[styles.sectionSubtitle, { color: '#B8860B', marginBottom: 12 }]}>
              Moyennes calculées avec coefficients de pondération (Poids 5 Grand Resp, Poids 3 Resp, Poids 1 Membre).
            </Text>

            {/* Tableau des Moyennes par Section */}
            <View style={styles.summaryGrid}>
              {SECTIONS_LIST.map((sec) => {
                const score = ratings[sec.id]?.score || 4.5;
                return (
                  <View key={sec.id} style={styles.summaryRow}>
                    <Text style={styles.summarySectionName}>{sec.icon} Section {sec.nom}</Text>
                    <Text style={styles.summaryScore}>{score.toFixed(1)} / 5.0 ★</Text>
                  </View>
                );
              })}
            </View>

            {/* Bouton d'Action Principal de Publication 24h */}
            <TouchableOpacity
              style={styles.btnPublish24h}
              onPress={handlePublishBilan24h}
            >
              <Text style={styles.btnPublish24hText}>
                🚀 Valider et Publier le Bilan sur le Feed (24h)
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.adminPublicationCard, { backgroundColor: COLORS.disabledBg, borderColor: COLORS.borderLight }]}>
            <Text style={[styles.sectionSubtitle, { textAlign: 'center', marginVertical: 4 }]}>
              🔒 La validation et publication finale du Bilan 24h sont réservées au Grand Responsable.
            </Text>
          </View>
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
