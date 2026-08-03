import { StyleSheet, Dimensions, Platform } from 'react-native';

const { width } = Dimensions.get('window');

export const COLORS = {
  background: '#F8F9FA',
  cardBg: '#FFFFFF',
  textPrimary: '#1C1C1E',
  textSecondary: '#8E8E93',
  appleBlue: '#007AFF',
  appleBlueLight: '#E5F1FF',
  goldBadge: '#D4AF37',
  goldBadgeBg: 'rgba(255, 253, 240, 0.95)',
  goldBorder: '#E6CA65',
  redHeart: '#FF2D55',
  borderLight: '#F2F2F7',
};

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
  },

  // 1. HEADER INSTAGRAM / THREADS
  header: {
    paddingTop: Platform.OS === 'ios' ? 48 : 20,
    paddingHorizontal: 18,
    paddingBottom: 12,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  headerLogo: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: -0.6,
  },
  headerSub: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.appleBlue,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // 2. STORIES INSTAGRAM CARROUSEL
  storiesContainer: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    backgroundColor: COLORS.cardBg,
  },
  storiesScroll: {
    paddingHorizontal: 14,
    gap: 14,
  },
  storyItem: {
    alignItems: 'center',
    width: 68,
  },
  storyRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    padding: 2.5,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyRingActive: {
    borderColor: COLORS.goldBadge,
  },
  storyAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    backgroundColor: COLORS.appleBlueLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyIcon: {
    fontSize: 24,
  },
  storyLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  storyLabelActive: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },

  // SCROLL CONTENT
  feedScroll: {
    paddingBottom: 90,
  },

  // 3. CARTE POST INSTAGRAM (BILAN DE CULTE & POSTS)
  postCard: {
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 8,
    borderBottomColor: COLORS.background,
  },
  
  // En-tête Post
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  postHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  postAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.appleBlue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postAvatarText: {
    fontSize: 18,
    color: '#FFF',
  },
  postAuthorTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  postAuthorSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  
  // Badge Vedette Doré Trophée
  goldTrophyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFDF0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
  },
  goldTrophyText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#B8860B',
  },

  // Zone Visuelle (Image Coulisses)
  postImageContainer: {
    width: '100%',
    height: 280,
    backgroundColor: '#1C1C1E',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  postImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  postImageText: {
    fontSize: 50,
  },

  // Glassmorphic Score Overlay
  scoreOverlayBadge: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  scoreOverlayText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1C1C1E',
  },

  // Barre d'interactions Sociales
  postActionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  postActionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  socialIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  socialIconText: {
    fontSize: 20,
  },
  socialCountText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  // Légende & Captions
  postCaptionBox: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  postLikesText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  postCaptionText: {
    fontSize: 13.5,
    lineHeight: 19,
    color: COLORS.textPrimary,
  },
  postCommentsLink: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 6,
  },

  // 4. FIX TAB BAR INSTAGRAM GLASSMORPHISM
  fixedTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 72,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    zIndex: 99999,
  },
  tabBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  tabIcon: {
    fontSize: 22,
  },
  centerPlusBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.appleBlue,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.appleBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  centerPlusText: {
    fontSize: 24,
    color: '#FFF',
    fontWeight: '400',
  }
});
