import { StyleSheet, Dimensions, Platform } from 'react-native';

const { width } = Dimensions.get('window');

export const COLORS = {
  background: '#F2F2F7',
  cardBg: '#FFFFFF',
  textPrimary: '#1C1C1E',
  textSecondary: '#8E8E93',
  appleBlue: '#007AFF',
  appleBlueLight: '#E5F1FF',
  goldBadge: '#FFD700',
  goldBadgeBg: '#FFF9E6',
  goldBorder: '#FFC107',
  greenSuccess: '#34C759',
  redBadge: '#FF3B30',
  borderLight: '#E5E5EA',
  inactiveTab: '#999999',
  darkOverlay: 'rgba(0, 0, 0, 0.4)',
  shadowColor: '#000000'
};

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  
  // 1. HEADER
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: COLORS.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 3,
    zIndex: 10,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.appleBlue,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  roleToggleButton: {
    backgroundColor: COLORS.appleBlueLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.2)',
  },
  roleToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.appleBlue,
  },
  notificationButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.redBadge,
    borderWidth: 2,
    borderColor: COLORS.cardBg,
  },

  // 2. SECTIONS CAROUSEL (Filtres)
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
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sectionChipActive: {
    backgroundColor: COLORS.appleBlue,
    shadowColor: COLORS.appleBlue,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
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
    paddingBottom: 100, // Espace pour la Bottom Bar
  },

  // 3. CARTE BILAN DE CULTE (24h Ephemeral)
  bilanCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.4)',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 5,
  },
  bilanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  culteDateText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  culteTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  goldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.goldBadgeBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
  },
  goldBadgeIcon: {
    marginRight: 4,
    fontSize: 13,
  },
  goldBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B8860B',
    letterSpacing: 0.5,
  },

  // Info Banner Confidentialité
  securityBanner: {
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  securityBannerText: {
    fontSize: 11,
    color: COLORS.appleBlue,
    fontWeight: '600',
    flex: 1,
  },

  // Liste Membres de Service
  membersList: {
    gap: 12,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  memberRoleBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },

  // Section Rating & Stars
  ratingContainer: {
    alignItems: 'flex-end',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  starIcon: {
    fontSize: 12,
    color: COLORS.goldBadge,
  },
  ratingValueText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginLeft: 4,
  },
  confidentialTag: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.appleBlue,
    backgroundColor: 'rgba(0,122,255,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  maskedTag: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
  },

  // Global Average Box
  globalAverageBox: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  globalAverageLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  globalAverageValue: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },

  // 4. FEED CLASSIQUE
  feedCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    shadowColor: COLORS.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  feedAuthorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  authorAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
    lineHeight: 20,
    marginBottom: 12,
  },
  feedImagePlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    backgroundColor: '#E1E9F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  feedImageText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  
  // Feed Actions
  feedActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  actionTextActive: {
    color: COLORS.redBadge,
    fontWeight: '700',
  },

  // 5. BOTTOM TAB BAR iOS
  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 84 : 65,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 20 : 5,
    shadowColor: COLORS.shadowColor,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
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
  
  // Bouton Central Publier [+] Surélevé
  publishButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.appleBlue,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -24,
    shadowColor: COLORS.appleBlue,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  publishButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '400',
    marginTop: -2,
  }
});
