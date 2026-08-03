import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Modal,
  StatusBar
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { styles, COLORS } from './homeScreenStyles';
import Toast from '../components/Toast';

// ICÔNES SVG VECTORIELLES FIL DE FER
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

// STORIES DES SECTIONS
const STORIES_SECTIONS = [
  { id: 'all', nom: 'Tous', emoji: '✨' },
  { id: 'cadrage', nom: 'Cadrage', emoji: '🎥' },
  { id: 'regie', nom: 'Régie', emoji: '🎛️' },
  { id: 'web', nom: 'Web', emoji: '🌐' },
  { id: 'proj', nom: 'Projection', emoji: '🖥️' },
  { id: 'prod', nom: 'Prod', emoji: '🎬' },
  { id: 'photo', nom: 'Photo', emoji: '📸' },
  { id: 'vente', nom: 'Vente', emoji: '🛒' },
];

export default function HomeScreen({ currentUser = { prenom: 'Éric', nom: 'Kouamé', sectionId: 'cadrage', sectionNom: 'Cadrage' }, onLogout }) {
  const [selectedStory, setSelectedStory] = useState('all');
  const [activeTab, setActiveTab] = useState('home');

  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
  };

  const [posts, setPosts] = useState([
    {
      id: 'post-1',
      author: 'Section Cadrage',
      authorAvatar: 'C',
      sectionId: 'cadrage',
      dateText: 'Dimanche 02 Août 2026 • Culte n°1',
      isVedette: true,
      title: 'Captation Directe Culte n°1',
      sub: 'Coulisses & Couverture Technique',
      scoreText: '4.88 / 5.0',
      caption: 'Bravo à toute l\'équipe Cadrage pour la couverture dynamique du 1er culte. Les cadrages serrés et la synchronisation avec la chorale étaient parfaits.',
      likes: 43,
      isLiked: true,
      comments: [
        { id: 'c1', author: 'Sarah Y.', text: 'Superbe réactivité sur les plans chorale !' },
        { id: 'c2', author: 'Marc T.', text: 'Merci Pasteurs pour les retours positifs.' }
      ]
    },
    {
      id: 'post-2',
      author: 'Sarah Yao (Photo)',
      authorAvatar: 'P',
      sectionId: 'photo',
      dateText: 'Il y a 3 heures',
      isVedette: false,
      title: 'Album Photos HD',
      sub: '150 Clichés Importés',
      caption: 'Les 150 clichés HD du Culte n°1 sont prêts et importés sur le serveur du Département.',
      likes: 29,
      isLiked: false,
      comments: [
        { id: 'c3', author: 'Yves K.', text: 'Magnifiques photos du prêche !' }
      ]
    }
  ]);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPostText, setNewPostText] = useState('');
  const [newPostSection, setNewPostSection] = useState(currentUser.sectionId || 'cadrage');

  const [activeCommentPost, setActiveCommentPost] = useState(null);
  const [newCommentText, setNewCommentText] = useState('');

  const handleToggleLike = (postId) => {
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          isLiked: !p.isLiked,
          likes: p.isLiked ? p.likes - 1 : p.likes + 1
        };
      }
      return p;
    }));
  };

  const handleCreatePostSubmit = () => {
    if (!newPostText.trim()) {
      showToast("Veuillez saisir le texte de votre publication.", "error");
      return;
    }

    const secNames = { cadrage: 'Cadrage', regie: 'Régie', web: 'Web', proj: 'Projection', prod: 'Prod', photo: 'Photo', vente: 'Vente' };

    const newPostObj = {
      id: `post-${Date.now()}`,
      author: `${currentUser.prenom} ${currentUser.nom} (${secNames[newPostSection] || 'COM'})`,
      authorAvatar: currentUser.prenom.charAt(0),
      sectionId: newPostSection,
      dateText: 'À l\'instant',
      isVedette: false,
      title: `Publication ${secNames[newPostSection] || 'COM'}`,
      sub: 'Contenu Partagé',
      caption: newPostText,
      likes: 1,
      isLiked: true,
      comments: []
    };

    setPosts([newPostObj, ...posts]);
    setNewPostText('');
    setIsCreateModalOpen(false);
    showToast("Publication partagée avec succès !");
  };

  const handleAddCommentSubmit = () => {
    if (!newCommentText.trim() || !activeCommentPost) return;

    const newC = {
      id: `c-${Date.now()}`,
      author: `${currentUser.prenom} ${currentUser.nom.charAt(0)}.`,
      text: newCommentText
    };

    setPosts(prev => prev.map(p => {
      if (p.id === activeCommentPost.id) {
        return { ...p, comments: [...p.comments, newC] };
      }
      return p;
    }));

    setActiveCommentPost(prev => ({ ...prev, comments: [...prev.comments, newC] }));
    setNewCommentText('');
    showToast("Commentaire ajouté !");
  };

  const handleSharePost = (post) => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: post.title,
        text: post.caption,
        url: window.location.href,
      }).catch(() => {});
    } else {
      showToast("Lien de la publication copié !");
    }
  };

  const filteredPosts = posts.filter(p => {
    if (selectedStory === 'all') return true;
    return p.sectionId === selectedStory;
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast({ ...toast, visible: false })} />

      {/* HEADER INSTAGRAM CLEAN */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>ÉGLISE VASE D'HONNEUR</Text>
          <Text style={styles.headerLogo}>Kun COM</Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setIsCreateModalOpen(true)}>
            <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M12 5v14M5 12h14" />
            </Svg>
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconBtn} onPress={onLogout}>
            <View style={{width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.appleBlueLight, justifyContent: 'center', alignItems: 'center'}}>
              <Text style={{fontWeight: '800', color: COLORS.appleBlue, fontSize: 13}}>{currentUser.prenom ? currentUser.prenom.charAt(0) : 'U'}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.feedScroll}>
        <View style={styles.storiesContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.storiesScroll}
          >
            {STORIES_SECTIONS.map(story => {
              const isSelected = selectedStory === story.id;
              return (
                <TouchableOpacity
                  key={story.id}
                  style={styles.storyItem}
                  onPress={() => setSelectedStory(story.id)}
                >
                  <View style={[styles.storyRing, isSelected && styles.storyRingActive]}>
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

        {filteredPosts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <CheckIcon color="#007AFF" size={32} />
            </View>
            <Text style={styles.emptyTitle}>Aucune publication récente</Text>
            <Text style={styles.emptySub}>
              Aucun contenu publié pour cette section aujourd'hui. Soyez le premier à partager une publication !
            </Text>
            <TouchableOpacity style={[styles.publishBtn, {marginTop: 20, paddingHorizontal: 20, width: 'auto'}]} onPress={() => setIsCreateModalOpen(true)}>
              <Text style={styles.publishBtnText}>Créer une publication</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredPosts.map(post => (
            <View key={post.id} style={styles.postCard}>
              <View style={styles.postHeader}>
                <View style={styles.postHeaderLeft}>
                  <View style={styles.postAvatar}>
                    <Text style={styles.postAvatarText}>{post.authorAvatar}</Text>
                  </View>
                  <View>
                    <Text style={styles.postAuthorTitle}>{post.author}</Text>
                    <Text style={styles.postAuthorSub}>{post.dateText}</Text>
                  </View>
                </View>

                {post.isVedette && (
                  <View style={styles.goldTrophyBadge}>
                    <Text style={styles.goldTrophyText}>SECTION VEDETTE</Text>
                  </View>
                )}
              </View>

              <View style={styles.postImageContainer}>
                <View style={styles.postImagePlaceholder}>
                  <Text style={styles.postImageTitle}>{post.title}</Text>
                  <Text style={styles.postImageSub}>{post.sub}</Text>
                </View>

                {post.scoreText && (
                  <View style={styles.scoreOverlayBadge}>
                    <Text style={styles.scoreOverlayText}>{post.scoreText}</Text>
                  </View>
                )}
              </View>

              <View style={styles.postActionsBar}>
                <View style={styles.postActionsLeft}>
                  <TouchableOpacity style={styles.socialIconBtn} onPress={() => handleToggleLike(post.id)}>
                    <HeartIcon filled={post.isLiked} size={22} />
                    <Text style={styles.socialCountText}>{post.likes}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.socialIconBtn} onPress={() => setActiveCommentPost(post)}>
                    <CommentIcon size={22} />
                    <Text style={styles.socialCountText}>{post.comments.length}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.socialIconBtn} onPress={() => handleSharePost(post)}>
                    <ShareIcon size={22} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity>
                  <BookmarkIcon size={22} />
                </TouchableOpacity>
              </View>

              <View style={styles.postCaptionBox}>
                <Text style={styles.postLikesText}>Aimé par {post.likes} membres</Text>
                <Text style={styles.postCaptionText}>
                  <Text style={{fontWeight: '800'}}>{post.author} </Text>
                  {post.caption}
                </Text>
                {post.comments.length > 0 && (
                  <TouchableOpacity onPress={() => setActiveCommentPost(post)}>
                    <Text style={styles.postCommentsLink}>Afficher les {post.comments.length} commentaires...</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}

        <View style={styles.allCaughtUpContainer}>
          <View style={styles.checkCircle}>
            <CheckIcon color="#007AFF" size={24} />
          </View>
          <Text style={styles.allCaughtUpTitle}>Vous êtes à jour</Text>
          <Text style={styles.allCaughtUpSub}>Vous avez vu toutes les nouvelles publications du Département Communication.</Text>
        </View>
      </ScrollView>

      {/* MODAL DE CRÉATION DE POST */}
      <Modal visible={isCreateModalOpen} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Créer une publication</Text>
              <TouchableOpacity onPress={() => setIsCreateModalOpen(false)}>
                <Text style={styles.modalCloseText}>Fermer</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.textInput}
              multiline
              placeholder="Rédigez votre message pour le département..."
              value={newPostText}
              onChangeText={setNewPostText}
            />

            <TouchableOpacity style={styles.publishBtn} onPress={handleCreatePostSubmit}>
              <Text style={styles.publishBtnText}>Publier sur le Feed</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL TIROIR COMMENTAIRES */}
      <Modal visible={activeCommentPost !== null} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Commentaires</Text>
              <TouchableOpacity onPress={() => setActiveCommentPost(null)}>
                <Text style={styles.modalCloseText}>Fermer</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{maxHeight: 250, marginBottom: 14}}>
              {activeCommentPost && activeCommentPost.comments.length > 0 ? (
                activeCommentPost.comments.map(c => (
                  <View key={c.id} style={{paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EFEFEF'}}>
                    <strong style={{fontSize: 13}}>{c.author}</strong>
                    <Text style={{fontSize: 13, color: '#333', marginTop: 2}}>{c.text}</Text>
                  </View>
                ))
              ) : (
                <Text style={{color: '#8E8E93', fontSize: 13, textAlign: 'center', marginVertical: 20}}>Aucun commentaire pour le moment. Soyez le premier !</Text>
              )}
            </ScrollView>

            <View style={{flexDirection: 'row', gap: 10}}>
              <TextInput
                style={[styles.textInput, {flex: 1, minHeight: 44, marginBottom: 0}]}
                placeholder="Ajouter un commentaire..."
                value={newCommentText}
                onChangeText={setNewCommentText}
              />
              <TouchableOpacity style={[styles.publishBtn, {width: 80, height: 44}]} onPress={handleAddCommentSubmit}>
                <Text style={styles.publishBtnText}>Envoyer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* TAB BAR FIXE INSTAGRAM CLEAN */}
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

        <TouchableOpacity style={styles.centerPlusBtn} onPress={() => setIsCreateModalOpen(true)}>
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
