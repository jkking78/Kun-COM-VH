import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  StatusBar,
  Image,
  Modal
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { styles, COLORS } from './homeScreenStyles';
import Toast from '../components/Toast';
import CommentsModal from '../components/CommentsModal';
import CreatePostModal from '../components/CreatePostModal';

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

const SearchIcon = ({ color = '#8E8E93', size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="11" cy="11" r="8" />
    <Path d="M21 21l-4.35-4.35" />
  </Svg>
);

const MoreOptionsIcon = ({ color = '#8E8E93', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="1" />
    <Circle cx="19" cy="12" r="1" />
    <Circle cx="5" cy="12" r="1" />
  </Svg>
);

const TrashIcon = ({ color = '#FF3B30', size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 6h18" />
    <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </Svg>
);

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

export default function HomeScreen({ currentUser = { id: 'usr-cadrage-1', prenom: 'Éric', nom: 'Kouamé', sectionId: 'cadrage', sectionNom: 'Cadrage', role: 'RESP_SECTION' }, onLogout }) {
  const [selectedStory, setSelectedStory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('home');
  const [activeImageIndexes, setActiveImageIndexes] = useState({});

  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [selectedPostOptions, setSelectedPostOptions] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
  };

  const [posts, setPosts] = useState([
    {
      id: 'post-1',
      userId: 'usr-cadrage-1',
      timestamp: Date.now() - 1000 * 60 * 30,
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
    },
    {
      id: 'post-2',
      userId: 'usr-photo-2',
      timestamp: Date.now() - 1000 * 60 * 180,
      author: 'Sarah Yao (Photo)',
      authorAvatar: 'P',
      sectionId: 'photo',
      dateText: 'Il y a 3 heures',
      isVedette: false,
      title: 'Album Photos HD #Photo',
      sub: '150 Clichés Importés',
      caption: 'Les 150 clichés HD du Culte n°1 sont prêts et importés par l\'équipe #Photo sur le serveur. #VaseDHonneur',
      mediaUrls: [],
      likes: 29,
      isLiked: false,
      comments: [
        { id: 'c3', author: 'Yves K.', text: 'Magnifiques photos du prêche !' }
      ]
    }
  ]);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeCommentPost, setActiveCommentPost] = useState(null);

  const trendingHashtags = useMemo(() => {
    const counts = {};
    posts.forEach(p => {
      const tags = (p.caption + ' ' + p.title).match(/#[\wéèêàâôûîç]+/gi) || [];
      tags.forEach(t => {
        const clean = t.trim();
        counts[clean] = (counts[clean] || 0) + 1;
      });
    });
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  }, [posts]);

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

  const handleCreatePostSubmit = (text, detectedSectionId, mediaUrls = []) => {
    const secNames = { cadrage: 'Cadrage', regie: 'Régie', web: 'Web', proj: 'Projection', prod: 'Prod', photo: 'Photo', vente: 'Vente', general: 'Général' };

    const newPostObj = {
      id: `post-${Date.now()}`,
      userId: currentUser.id || 'usr-current',
      timestamp: Date.now(),
      author: `${currentUser.prenom} ${currentUser.nom} (${secNames[detectedSectionId] || 'COM'})`,
      authorAvatar: currentUser.prenom.charAt(0),
      sectionId: detectedSectionId,
      dateText: 'À l\'instant',
      isVedette: false,
      title: `Publication ${secNames[detectedSectionId] || 'COM'}`,
      sub: 'Contenu Partagé',
      caption: text,
      mediaUrls: mediaUrls,
      likes: 1,
      isLiked: true,
      comments: []
    };

    setPosts([newPostObj, ...posts]);
    setIsCreateModalOpen(false);
    showToast("Publication partagée avec succès !");
  };

  // HANDLER DE SUPPRESSION TEMPS RÉEL (RBAC CONTROL)
  const handleDeletePost = (postId) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
    setSelectedPostOptions(null);
    showToast("Publication supprimée avec succès", "success");
  };

  const handleAddComment = (postId, text) => {
    const newC = {
      id: `c-${Date.now()}`,
      author: `${currentUser.prenom} ${currentUser.nom.charAt(0)}.`,
      text: text
    };

    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return { ...p, comments: [...p.comments, newC] };
      }
      return p;
    }));

    if (activeCommentPost && activeCommentPost.id === postId) {
      setActiveCommentPost(prev => ({ ...prev, comments: [...prev.comments, newC] }));
    }
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

  const renderFormattedCaption = (text) => {
    if (!text) return null;
    const parts = text.split(/(\s+)/);
    return parts.map((part, i) => {
      if (part.startsWith('#') && part.length > 1) {
        return (
          <Text
            key={i}
            style={{ color: '#007AFF', fontWeight: '800' }}
            onPress={() => {
              setSearchQuery(part);
              showToast(`Recherche appliquée : ${part}`);
            }}
          >
            {part}
          </Text>
        );
      }
      return part;
    });
  };

  const filteredPosts = useMemo(() => {
    let list = [...posts];
    list.sort((a, b) => b.timestamp - a.timestamp);

    if (selectedStory !== 'all') {
      list = list.filter(p => p.sectionId === selectedStory);
    }

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(p =>
        p.caption.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q)
      );
    }

    return list;
  }, [posts, selectedStory, searchQuery]);

  const handleScrollCarousel = (postId, event) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = Math.floor(event.nativeEvent.contentOffset.x / slideSize);
    setActiveImageIndexes(prev => ({ ...prev, [postId]: index }));
  };

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

      {/* BARRE DE RECHERCHE GLOBALE 🔍 */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBarInner}>
          <SearchIcon color="#8E8E93" size={18} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher des posts, des hashtags #..."
            placeholderTextColor="#8E8E93"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity style={styles.clearSearchBtn} onPress={() => setSearchQuery('')}>
              <Text style={{fontSize: 14, fontWeight: '700', color: '#8E8E93'}}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* SUJETS TENDANCES */}
      {trendingHashtags.length > 0 && (
        <View style={styles.trendingContainer}>
          <View style={styles.trendingHeaderRow}>
            <Text style={styles.trendingTitle}>Sujets tendances :</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendingScroll}>
            {trendingHashtags.map((tag, idx) => {
              const isActive = searchQuery === tag;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.trendingChip, isActive && styles.trendingChipActive]}
                  onPress={() => setSearchQuery(isActive ? '' : tag)}
                >
                  <Text style={[styles.trendingChipText, isActive && styles.trendingChipTextActive]}>{tag}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.feedScroll}>
        {/* STORIES CARROUSEL */}
        <View style={styles.storiesContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesScroll}>
            {STORIES_SECTIONS.map(story => {
              const isSelected = selectedStory === story.id;
              return (
                <TouchableOpacity key={story.id} style={styles.storyItem} onPress={() => setSelectedStory(story.id)}>
                  <View style={[styles.storyRing, isSelected && styles.storyRingActive]}>
                    <View style={styles.storyAvatar}>
                      <Text style={styles.storyEmoji}>{story.emoji}</Text>
                    </View>
                  </View>
                  <Text style={[styles.storyLabel, isSelected && styles.storyLabelActive]}>{story.nom}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* FEED OU ÉTAT À VIDE */}
        {filteredPosts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <CheckIcon color="#007AFF" size={32} />
            </View>
            <Text style={styles.emptyTitle}>Aucune publication récente</Text>
            <Text style={styles.emptySub}>
              {searchQuery ? `Aucun résultat pour "${searchQuery}".` : 'Soyez le premier à partager une publication !'}
            </Text>
            <TouchableOpacity style={[styles.publishBtn, {marginTop: 20, paddingHorizontal: 20, width: 'auto'}]} onPress={() => setIsCreateModalOpen(true)}>
              <Text style={styles.publishBtnText}>Créer une publication</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredPosts.map(post => {
            const hasMedia = post.mediaUrls && post.mediaUrls.length > 0;
            const currentImgIndex = activeImageIndexes[post.id] || 0;

            // RÈGLE DE PERMISSION DE SUPPRESSION (RBAC)
            const canDelete = (currentUser.role === 'GRAND_RESPONSABLE' || post.userId === currentUser.id);

            return (
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

                  <View style={styles.postHeaderRight}>
                    {post.isVedette && (
                      <View style={styles.goldTrophyBadge}>
                        <Text style={styles.goldTrophyText}>SECTION VEDETTE</Text>
                      </View>
                    )}

                    {/* BOUTON OPTIONS 3 POINTS (...) */}
                    <TouchableOpacity
                      style={styles.moreOptionsBtn}
                      onPress={() => setSelectedPostOptions({ post, canDelete })}
                    >
                      <MoreOptionsIcon size={20} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* ZONE MÉDIA */}
                {hasMedia ? (
                  <View style={styles.mediaContainer}>
                    {post.mediaUrls.length > 1 && (
                      <View style={styles.photoCountBadge}>
                        <Text style={styles.photoCountText}>
                          {currentImgIndex + 1}/{post.mediaUrls.length}
                        </Text>
                      </View>
                    )}

                    <ScrollView
                      horizontal
                      pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      onScroll={(e) => handleScrollCarousel(post.id, e)}
                      scrollEventThrottle={16}
                      style={styles.carouselScroll}
                    >
                      {post.mediaUrls.map((url, imgIdx) => (
                        <Image key={imgIdx} source={{ uri: url }} style={styles.carouselImage} />
                      ))}
                    </ScrollView>
                  </View>
                ) : (
                  <View style={styles.mediaContainer}>
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
                )}

                {hasMedia && post.mediaUrls.length > 1 && (
                  <View style={styles.dotsContainer}>
                    {post.mediaUrls.map((_, dotIdx) => (
                      <View key={dotIdx} style={[styles.dot, currentImgIndex === dotIdx && styles.activeDot]} />
                    ))}
                  </View>
                )}

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
                    {renderFormattedCaption(post.caption)}
                  </Text>
                  {post.comments.length > 0 && (
                    <TouchableOpacity onPress={() => setActiveCommentPost(post)}>
                      <Text style={styles.postCommentsLink}>Afficher les {post.comments.length} commentaires...</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}

        <View style={styles.allCaughtUpContainer}>
          <View style={styles.checkCircle}>
            <CheckIcon color="#007AFF" size={24} />
          </View>
          <Text style={styles.allCaughtUpTitle}>Vous êtes à jour</Text>
          <Text style={styles.allCaughtUpSub}>Vous avez vu toutes les nouvelles publications du Département Communication.</Text>
        </View>
      </ScrollView>

      {/* MODAL OPTIONS DU POST (MENU 3 POINTS CONTRÔLÉ PAR RBAC) */}
      {selectedPostOptions && (
        <Modal transparent animationType="fade" visible={true} onRequestClose={() => setSelectedPostOptions(null)}>
          <TouchableOpacity style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end'}} activeOpacity={1} onPress={() => setSelectedPostOptions(null)}>
            <TouchableOpacity activeOpacity={1} style={{backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20}}>
              <View style={{width: 44, height: 5, borderRadius: 2.5, backgroundColor: '#D1D1D6', alignSelf: 'center', marginBottom: 14}} />

              {selectedPostOptions.canDelete ? (
                <TouchableOpacity
                  style={{flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EFEFEF'}}
                  onPress={() => handleDeletePost(selectedPostOptions.post.id)}
                >
                  <TrashIcon color="#FF3B30" size={20} />
                  <Text style={{fontSize: 15, fontWeight: '800', color: '#FF3B30'}}>Supprimer la publication</Text>
                </TouchableOpacity>
              ) : (
                <View style={{paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EFEFEF'}}>
                  <Text style={{fontSize: 13, color: '#8E8E93', textAlign: 'center'}}>Vous n'avez pas l'autorisation de supprimer ce post.</Text>
                </View>
              )}

              <TouchableOpacity style={{paddingVertical: 14, alignItems: 'center'}} onPress={() => setSelectedPostOptions(null)}>
                <Text style={{fontSize: 15, fontWeight: '700', color: '#007AFF'}}>Annuler</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      {/* MODAL CRÉATION DE POST */}
      <CreatePostModal
        visible={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmitPost={handleCreatePostSubmit}
      />

      {/* COMPOSANT BOTTOM SHEET TIROIR DE COMMENTAIRES INSTAGRAM */}
      <CommentsModal
        visible={activeCommentPost !== null}
        post={activeCommentPost}
        currentUser={currentUser}
        onClose={() => setActiveCommentPost(null)}
        onAddComment={handleAddComment}
      />

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
