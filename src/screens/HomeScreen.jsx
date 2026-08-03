import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { styles, COLORS } from './homeScreenStyles';

// 1. COMPOSANTS D'ICÔNES SVG VECTORIELLES EN FIL DE FER (STROKE)
const HeartIcon = ({ filled, color = '#000000', size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? '#FF2D55' : 'none'} stroke={filled ? '#FF2D55' : color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </Svg>
);

const CommentIcon = ({ color = '#000000', size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </Svg>
);

const ShareIcon = ({ color = '#000000', size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <Path d="M16 6l-4-4-4 4" />
    <Path d="M12 2v13" />
  </Svg>
);

const BookmarkIcon = ({ color = '#000000', size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </Svg>
);

const CheckIcon = ({ color = '#007AFF', size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <Path d="M22 4L12 14.01l-3-3" />
  </Svg>
);

// 2. LES 7 STORIES DES SECTIONS (ÉMOJIS UNIQUEMENT DANS LES BULLES)
const STORIES_SECTIONS = [
  { id: 'cadrage', nom: 'Cadrage', emoji: '🎥', active: true },
  { id: 'regie', nom: 'Régie', emoji: '🎛️', active: true },
  { id: 'web', nom: 'Web', emoji: '🌐', active: false },
  { id: 'proj', nom: 'Projection', emoji: '🖥️', active: false },
  { id: 'prod', nom: 'Prod', emoji: '🎬', active: false },
  { id: 'photo', nom: 'Photo', emoji: '📸', active: false },
  { id: 'vente', nom: 'Vente', emoji: '🛒', active: false },
];

export default function HomeScreen() {
  const [activeStory, setActiveStory] = useState('cadrage');
  const [activeTab, setActiveTab] = useState('home');
  const [likedPosts, setLikedPosts] = useState({ 'post-bilan': true });

  const toggleLike = (postId) => {
    setLikedPosts(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* 1. HEADER INSTAGRAM CLEAN (SANS EMOJI) */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>ÉGLISE VASE D'HONNEUR</Text>
          <Text style={styles.headerLogo}>Kun COM</Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn}>
            <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M12 5v14M5 12h14" />
            </Svg>
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconBtn}>
            <CommentIcon color="#000" size={22} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.feedScroll}>
        {/* 2. STORIES CARROUSEL EN HAUT (ÉMOJIS DANS LES BULLES UNIQUEMENT) */}
        <View style={styles.storiesContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.storiesScroll}
          >
            {STORIES_SECTIONS.map(story => {
              const isSelected = activeStory === story.id;
              return (
                <TouchableOpacity
                  key={story.id}
                  style={styles.storyItem}
                  onPress={() => setActiveStory(story.id)}
                >
                  <View style={[styles.storyRing, (isSelected || story.active) && styles.storyRingActive]}>
                    <View style={styles.storyAvatar}>
                      <Text style={styles.storyEmoji}>{story.emoji}</Text>
                    </View>
                  </View>
                  <Text style={[styles.storyLabel, isSelected && styles.storyLabelActive]}>
                    {story.nom}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* 3. POST INSTAGRAM : CARTE BILAN CULTE N°1 (TEXTE SANS EMOJI) */}
        <View style={styles.postCard}>
          {/* En-tête Post */}
          <View style={styles.postHeader}>
            <View style={styles.postHeaderLeft}>
              <View style={styles.postAvatar}>
                <Text style={styles.postAvatarText}>C</Text>
              </View>
              <View>
                <Text style={styles.postAuthorTitle}>Section Cadrage</Text>
                <Text style={styles.postAuthorSub}>Dimanche 02 Août 2026 • Culte n°1</Text>
              </View>
            </View>

            {/* Badge Vedette Minimaliste */}
            <View style={styles.goldTrophyBadge}>
              <Text style={styles.goldTrophyText}>SECTION VEDETTE</Text>
            </View>
          </View>

          {/* Zone Visuelle avec Overlay Score Glassmorphism */}
          <View style={styles.postImageContainer}>
            <View style={styles.postImagePlaceholder}>
              <Text style={styles.postImageTitle}>Captation Directe Culte n°1</Text>
              <Text style={styles.postImageSub}>Coulisses & Couverture Technique</Text>
            </View>

            {/* Score Overlaid Glassmorphism */}
            <View style={styles.scoreOverlayBadge}>
              <Text style={styles.scoreOverlayText}>4.88 / 5.0</Text>
            </View>
          </View>

          {/* Barre d'interactions Sociales (SVG fil de fer) */}
          <View style={styles.postActionsBar}>
            <View style={styles.postActionsLeft}>
              <TouchableOpacity style={styles.socialIconBtn} onPress={() => toggleLike('post-bilan')}>
                <HeartIcon filled={likedPosts['post-bilan']} size={22} />
                <Text style={styles.socialCountText}>{likedPosts['post-bilan'] ? '43' : '42'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.socialIconBtn}>
                <CommentIcon size={22} />
                <Text style={styles.socialCountText}>7</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.socialIconBtn}>
                <ShareIcon size={22} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity>
              <BookmarkIcon size={22} />
            </TouchableOpacity>
          </View>

          {/* Légende & Description (Texte Pur sans émoji) */}
          <View style={styles.postCaptionBox}>
            <Text style={styles.postLikesText}>Aimé par Sarah Yao et 42 autres membres</Text>
            <Text style={styles.postCaptionText}>
              <Text style={{fontWeight: '800'}}>Section Cadrage </Text>
              Bravo à toute l'équipe Cadrage pour la couverture dynamique du 1er culte. Les cadrages serrés et la synchronisation avec la chorale étaient parfaits.
            </Text>
            <Text style={styles.postCommentsLink}>Voir les 7 débriefings et remarques...</Text>
          </View>
        </View>

        {/* 4. POST INSTAGRAM CLASSIQUE */}
        <View style={styles.postCard}>
          <View style={styles.postHeader}>
            <View style={styles.postHeaderLeft}>
              <View style={[styles.postAvatar, {backgroundColor: '#5856D6'}]}>
                <Text style={styles.postAvatarText}>P</Text>
              </View>
              <View>
                <Text style={styles.postAuthorTitle}>Sarah Yao (Photo)</Text>
                <Text style={styles.postAuthorSub}>Il y a 3 heures</Text>
              </View>
            </View>
          </View>

          <View style={[styles.postImageContainer, {height: 200, backgroundColor: '#2C2C2E'}]}>
            <Text style={styles.postImageTitle}>Album Photos HD</Text>
            <Text style={styles.postImageSub}>150 Clichés Importés</Text>
          </View>

          <View style={styles.postActionsBar}>
            <View style={styles.postActionsLeft}>
              <TouchableOpacity style={styles.socialIconBtn} onPress={() => toggleLike('post-photo')}>
                <HeartIcon filled={likedPosts['post-photo']} size={22} />
                <Text style={styles.socialCountText}>{likedPosts['post-photo'] ? '29' : '28'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.socialIconBtn}>
                <CommentIcon size={22} />
                <Text style={styles.socialCountText}>4</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.postCaptionBox}>
            <Text style={styles.postCaptionText}>
              <Text style={{fontWeight: '800'}}>Sarah Yao </Text>
              Les 150 clichés HD du Culte n°1 sont prêts et importés sur le serveur du Département.
            </Text>
          </View>
        </View>

        {/* 5. BLOC INSTAGRAM "VOUS ÊTES À JOUR" (SANS EMOJI) */}
        <View style={styles.allCaughtUpContainer}>
          <View style={styles.checkCircle}>
            <CheckIcon color="#007AFF" size={24} />
          </View>
          <Text style={styles.allCaughtUpTitle}>Vous êtes à jour</Text>
          <Text style={styles.allCaughtUpSub}>Vous avez vu toutes les nouvelles publications du Département Communication.</Text>
        </View>
      </ScrollView>

      {/* 6. TAB BAR FIXE INSTAGRAM CLEAN */}
      <View style={styles.fixedTabBar}>
        <TouchableOpacity style={styles.tabBtn} onPress={() => setActiveTab('home')}>
          <Svg width="22" height="22" viewBox="0 0 24 24" fill={activeTab === 'home' ? '#000' : 'none'} stroke="#000" strokeWidth="1.8">
            <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </Svg>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabBtn} onPress={() => setActiveTab('planning')}>
          <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1.8">
            <Path d="M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18" />
          </Svg>
        </TouchableOpacity>

        <TouchableOpacity style={styles.centerPlusBtn} onPress={() => setActiveTab('debrief')}>
          <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.2">
            <Path d="M12 5v14M5 12h14" />
          </Svg>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabBtn} onPress={() => setActiveTab('halloffame')}>
          <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1.8">
            <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </Svg>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabBtn} onPress={() => setActiveTab('profile')}>
          <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1.8">
            <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <Circle cx="12" cy="7" r="4" />
          </Svg>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
