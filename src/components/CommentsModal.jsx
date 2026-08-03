import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  SafeAreaView
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

const HeartIcon = ({ filled = false, size = 16, color = '#8E8E93' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? '#FF2D55' : 'none'} stroke={filled ? '#FF2D55' : color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </Svg>
);

const SendIcon = ({ size = 18, color = '#007AFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M22 2L11 13" />
    <Path d="M22 2l-7 20-4-9-9-4 20-7z" />
  </Svg>
);

const QUICK_EMOJIS = ['❤️', '👏', '🔥', '🙌', '😢', '😍', '😮', '😂'];

export default function CommentsModal({ visible, post, currentUser, onClose, onAddComment }) {
  const [commentText, setCommentText] = useState('');
  const [likedComments, setLikedComments] = useState({});

  if (!post) return null;

  const handleSend = () => {
    if (!commentText.trim()) return;
    onAddComment(post.id, commentText);
    setCommentText('');
  };

  const handleEmojiClick = (emoji) => {
    setCommentText(prev => prev + emoji);
  };

  const toggleCommentLike = (commentId) => {
    setLikedComments(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.bottomSheetContainer}>
          
          {/* DRAG HANDLE & HEADER INSTAGRAM */}
          <View style={styles.dragHandleBox}>
            <View style={styles.dragHandle} />
          </View>

          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Commentaires</Text>
          </View>

          {/* LISTE DES COMMENTAIRES STYLE SOCIAL FEED */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.commentsList}>
            {post.comments && post.comments.length > 0 ? (
              post.comments.map(c => {
                const isLiked = likedComments[c.id];
                return (
                  <View key={c.id} style={styles.commentRow}>
                    {/* Avatar rond */}
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarText}>{c.author ? c.author.charAt(0) : 'U'}</Text>
                    </View>

                    {/* Corps du commentaire */}
                    <View style={styles.commentContent}>
                      <View style={styles.commentHeaderRow}>
                        <Text style={styles.authorName}>{c.author}</Text>
                        <Text style={styles.timeAgo}>• 8 h</Text>
                      </View>

                      <Text style={styles.commentBody}>{c.text}</Text>

                      <TouchableOpacity style={styles.replyBtn}>
                        <Text style={styles.replyText}>Répondre</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Icône Cœur Like à droite */}
                    <TouchableOpacity style={styles.likeBtn} onPress={() => toggleCommentLike(c.id)}>
                      <HeartIcon filled={isLiked} size={16} />
                    </TouchableOpacity>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Aucun commentaire pour le moment.</Text>
                <Text style={styles.emptySub}>Commencez la discussion !</Text>
              </View>
            )}
          </ScrollView>

          {/* BARRE INFÉRIEURE INSTAGRAM */}
          <SafeAreaView style={styles.bottomBarArea}>
            {/* Carrousel d'Émojis Rapides */}
            <View style={styles.emojiCarousel}>
              {QUICK_EMOJIS.map((e, idx) => (
                <TouchableOpacity key={idx} style={styles.emojiItem} onPress={() => handleEmojiClick(e)}>
                  <Text style={{fontSize: 22}}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Champ de Saisie Arrondi avec Avatar & Bouton Envoi Intégré */}
            <View style={styles.inputContainer}>
              <View style={styles.currentUserAvatar}>
                <Text style={styles.currentUserAvatarText}>
                  {currentUser && currentUser.prenom ? currentUser.prenom.charAt(0) : 'E'}
                </Text>
              </View>

              <View style={styles.pillInputWrapper}>
                <TextInput
                  style={styles.pillInput}
                  placeholder="Ajouter un commentaire..."
                  placeholderTextColor="#8E8E93"
                  value={commentText}
                  onChangeText={setCommentText}
                />
                
                {commentText.trim().length > 0 && (
                  <TouchableOpacity style={styles.sendIconBtn} onPress={handleSend}>
                    <SendIcon size={18} color="#007AFF" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </SafeAreaView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  bottomSheetContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '82%',
    minHeight: '55%',
    display: 'flex',
    flexDirection: 'column',
  },
  dragHandleBox: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#D1D1D6',
  },
  sheetHeader: {
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
  },
  commentsList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
    gap: 12,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F0F6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#007AFF',
  },
  commentContent: {
    flex: 1,
  },
  commentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  authorName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#000000',
  },
  timeAgo: {
    fontSize: 11.5,
    color: '#8E8E93',
  },
  commentBody: {
    fontSize: 13.5,
    lineHeight: 18,
    color: '#1C1C1E',
  },
  replyBtn: {
    marginTop: 4,
  },
  replyText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#8E8E93',
  },
  likeBtn: {
    padding: 6,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  emptySub: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  bottomBarArea: {
    borderTopWidth: 1,
    borderTopColor: '#EFEFEF',
    backgroundColor: '#FFFFFF',
  },
  emojiCarousel: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FAFAFA',
  },
  emojiItem: {
    padding: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  currentUserAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentUserAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
  },
  pillInputWrapper: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  pillInput: {
    flex: 1,
    height: '100%',
    fontSize: 13.5,
    color: '#000000',
  },
  sendIconBtn: {
    paddingLeft: 8,
  },
});
