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

// 1. LES 7 STORIES DES SECTIONS
const STORIES_SECTIONS = [
  { id: 'cadrage', nom: 'Cadrage', icon: '🎥', active: true },
  { id: 'regie', nom: 'Régie', icon: '🎛️', active: true },
  { id: 'web', nom: 'Web', icon: '🌐', active: false },
  { id: 'proj', nom: 'Projection', icon: '🖥️', active: false },
  { id: 'prod', nom: 'Prod', icon: '🎬', active: false },
  { id: 'photo', nom: 'Photo', icon: '📸', active: false },
  { id: 'vente', nom: 'Vente', icon: '🛒', active: false },
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

      {/* 1. HEADER INSTAGRAM / THREADS */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>ÉGLISE VASE D'HONNEUR</Text>
          <Text style={styles.headerLogo}>Kun COM 📸</Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn}>
            <Text style={{fontSize: 16}}>➕</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <Text style={{fontSize: 16}}>💬</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.feedScroll}>
        {/* 2. STORIES CARROUSEL EN HAUT */}
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
                      <Text style={styles.storyIcon}>{story.icon}</Text>
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

        {/* 3. POST INSTAGRAM : CARTE BILAN CULTE N°1 (SECTION VEDETTE) */}
        <View style={styles.postCard}>
          {/* En-tête Post */}
          <View style={styles.postHeader}>
            <View style={styles.postHeaderLeft}>
              <View style={styles.postAvatar}>
                <Text style={styles.postAvatarText}>🎥</Text>
              </View>
              <View>
                <Text style={styles.postAuthorTitle}>Section Cadrage</Text>
                <Text style={styles.postAuthorSub}>Dimanche 02 Août 2026 • Culte n°1</Text>
              </View>
            </View>

            {/* Badge Vedette Trophée Doré */}
            <View style={styles.goldTrophyBadge}>
              <Text style={{fontSize: 12}}>🏆</Text>
              <Text style={styles.goldTrophyText}>SECTION VEDETTE</Text>
            </View>
          </View>

          {/* Zone Visuelle avec Overlay Score Glassmorphism */}
          <View style={styles.postImageContainer}>
            <View style={styles.postImagePlaceholder}>
              <Text style={styles.postImageText}>🎬 🎥 ✨</Text>
              <Text style={{color: '#8E8E93', fontSize: 12, marginTop: 8}}>Coulisses & Captation Directe</Text>
            </div>

            {/* Score Overlaid Glassmorphism */}
            <View style={styles.scoreOverlayBadge}>
              <Text style={{fontSize: 14, color: '#D4AF37'}}>★</Text>
              <Text style={styles.scoreOverlayText}>4.88 / 5.0</Text>
            </View>
          </View>

          {/* Barre d'interactions Sociales */}
          <View style={styles.postActionsBar}>
            <View style={styles.postActionsLeft}>
              <TouchableOpacity style={styles.socialIconBtn} onPress={() => toggleLike('post-bilan')}>
                <Text style={styles.socialIconText}>{likedPosts['post-bilan'] ? '❤️' : '🤍'}</Text>
                <Text style={styles.socialCountText}>{likedPosts['post-bilan'] ? '43' : '42'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.socialIconBtn}>
                <Text style={styles.socialIconText}>💬</Text>
                <Text style={styles.socialCountText}>7</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.socialIconBtn}>
                <Text style={styles.socialIconText}>↗️</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity>
              <Text style={{fontSize: 18}}>🔖</Text>
            </TouchableOpacity>
          </View>

          {/* Légende & Description */}
          <View style={styles.postCaptionBox}>
            <Text style={styles.postLikesText}>Aimé par Sarah Yao et 42 autres membres</Text>
            <Text style={styles.postCaptionText}>
              <Text style={{fontWeight: '800'}}>Section Cadrage </Text>
              Bravo à toute l'équipe Cadrage pour la couverture dynamique du 1er culte ! Les cadrages serrés et la synchronisation avec la chorale étaient parfaits. 🎬✨
            </Text>
            <Text style={styles.postCommentsLink}>Voir les 7 débriefings et remarques...</Text>
          </View>
        </View>

        {/* 4. POST INSTAGRAM CLASSIQUE */}
        <View style={styles.postCard}>
          <View style={styles.postHeader}>
            <View style={styles.postHeaderLeft}>
              <View style={[styles.postAvatar, {backgroundColor: '#5856D6'}]}>
                <Text style={styles.postAvatarText}>📸</Text>
              </View>
              <View>
                <Text style={styles.postAuthorTitle}>Sarah Yao (Photo)</Text>
                <Text style={styles.postAuthorSub}>Il y a 3 heures</Text>
              </View>
            </View>
          </View>

          <View style={[styles.postImageContainer, {height: 220, backgroundColor: '#2C2C2E'}]}>
            <Text style={{fontSize: 42}}>📸 📸 📸</Text>
          </View>

          <View style={styles.postActionsBar}>
            <View style={styles.postActionsLeft}>
              <TouchableOpacity style={styles.socialIconBtn} onPress={() => toggleLike('post-photo')}>
                <Text style={styles.socialIconText}>{likedPosts['post-photo'] ? '❤️' : '🤍'}</Text>
                <Text style={styles.socialCountText}>{likedPosts['post-photo'] ? '29' : '28'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.socialIconBtn}>
                <Text style={styles.socialIconText}>💬</Text>
                <Text style={styles.socialCountText}>4</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.postCaptionBox}>
            <Text style={styles.postCaptionText}>
              <Text style={{fontWeight: '800'}}>Sarah Yao </Text>
              Les 150 clichés HD du Culte n°1 sont prêts et importés sur le serveur cloud du Département ! 🚀
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* 5. TAB BAR FIXE STYLE INSTAGRAM GLASSMORPHISM */}
      <View style={styles.fixedTabBar}>
        <TouchableOpacity style={styles.tabBtn} onPress={() => setActiveTab('home')}>
          <Text style={styles.tabIcon}>🏠</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabBtn} onPress={() => setActiveTab('planning')}>
          <Text style={styles.tabIcon}>📅</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.centerPlusBtn} onPress={() => setActiveTab('debrief')}>
          <Text style={styles.centerPlusText}>+</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabBtn} onPress={() => setActiveTab('halloffame')}>
          <Text style={styles.tabIcon}>🌟</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabBtn} onPress={() => setActiveTab('profile')}>
          <Text style={styles.tabIcon}>👤</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
