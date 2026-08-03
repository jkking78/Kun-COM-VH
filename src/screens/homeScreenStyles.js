import { StyleSheet, Dimensions, Platform } from 'react-native';

const { width } = Dimensions.get('window');

export const COLORS = {
  background: '#F2F2F7',
  cardBg: '#FFFFFF',
  textPrimary: '#1C1C1E',
  textSecondary: '#8E8E93',
  appleBlue: '#007AFF',
  appleBlueLight: '#E5F1FF',
  goldBadge: '#D4AF37',
  goldBadgeBg: '#FFFDF0',
  goldBorder: '#E6CA65',
  greenSuccess: '#34C759',
  redBadge: '#FF3B30',
  borderLight: 'rgba(0,0,0,0.06)',
  inactiveTab: '#8E8E93',
  shadowColor: '#000000'
};

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  
  // 1. HEADER APPLE LARGE TITLE
  header: {
    paddingTop: Platform.OS === 'ios' ? 52 : 24,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: COLORS.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    zIndex: 10,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.appleBlue,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileAvatarBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.appleBlueLight,
    borderWidth: 1.5,
    borderColor: 'rgba(0,122,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.appleBlue,
  },
  notificationButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.redBadge,
  },

  // 2. PILULES DE SECTIONS (Filtres)
  sectionsContainer: {
    backgroundColor: COLORS.cardBg,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  sectionsScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  sectionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sectionChipActive: {
    backgroundColor: COLORS.appleBlue,
    shadowColor: COLORS.appleBlue,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  sectionIcon: {
    marginRight: 6,
    fontSize: 14,
  },
  sectionText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  sectionTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // SCROLL CONTENT AREA
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110,
  },

  // 3. CARTE BILAN DE CULTE PREMIUM
  bilanCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
  },
  bilanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  culteDateText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  culteTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 2,
    letterSpacing: -0.4,
  },
  
  // Badge Métallique Raffiné
  goldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.goldBadgeBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    shadowColor: COLORS.goldBadge,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  goldBadgeIcon: {
    marginRight: 5,
    fontSize: 13,
  },
  goldBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B8860B',
    letterSpacing: 0.6,
  },

  // Liste Membres Épurée
  membersList: {
    gap: 12,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.appleBlueLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.appleBlue,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  // Étoiles Dorées Fines
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  starIcon: {
    fontSize: 14,
    color: COLORS.goldBadge,
  },
  ratingValueText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginLeft: 4,
  },

  // Badge Circulaire Moyenne Globale
  globalAverageBox: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  globalAverageLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  globalAveragePill: {
    backgroundColor: COLORS.goldBadgeBg,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
  },
  globalAverageValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#B8860B',
  },

  // 4. FEED CLASSIQUE
  feedCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 22,
    padding: 18,
    marginBottom: 20,
    shadowColor: COLORS.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  feedAuthorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  feedTime: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  feedTextContent: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 21,
    marginBottom: 12,
  },
  
  // Actions Feed
  feedActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },

  // 5. BOTTOM TAB BAR FLOTTANTE GLASSMORPHISM
  bottomTabBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    height: 66,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 33,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: COLORS.shadowColor,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.inactiveTab,
  },
  tabLabelActive: {
    color: COLORS.appleBlue,
    fontWeight: '700',
  },
  
  // Bouton Central Surélevé
  publishButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.appleBlue,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -28,
    shadowColor: COLORS.appleBlue,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  publishButtonText: {
    fontSize: 26,
    color: '#FFFFFF',
    fontWeight: '400',
    marginTop: -2,
  }
});
