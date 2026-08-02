import { StyleSheet, Dimensions, Platform } from 'react-native';

const { width } = Dimensions.get('window');

export const COLORS = {
  background: '#F2F2F7',
  cardBg: '#FFFFFF',
  textPrimary: '#1C1C1E',
  textSecondary: '#8E8E93',
  appleBlue: '#007AFF',
  appleBlueLight: '#E5F1FF',
  greenSuccess: '#34C759',
  greenBg: '#E8F9ED',
  goldBadge: '#FFD700',
  goldBadgeBg: '#FFF9E6',
  goldBorder: '#FFC107',
  purpleAction: '#5856D6',
  purpleBg: '#F0EFFF',
  redBadge: '#FF3B30',
  redBg: '#FFEBEA',
  borderLight: '#E5E5EA',
  inactiveTab: '#999999',
  disabledBg: '#F8F8FA',
  disabledText: '#A1A1A6',
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
    elevation: 3,
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
  userProfileBadge: {
    backgroundColor: COLORS.appleBlueLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.2)',
  },
  userProfileText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.appleBlue,
  },

  // SCROLL CONTENT
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },

  // TITRES DE SECTION
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 14,
  },

  // 2. BLOC NOTATION INTER-SECTIONS
  ratingCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: COLORS.shadowColor,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  ratingCardDisabled: {
    backgroundColor: COLORS.disabledBg,
    borderColor: '#E1E1E6',
    opacity: 0.75,
  },
  ratingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  sectionName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  // Badge Auto-Notation Bloquée
  selfRatingBlockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.redBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.2)',
  },
  selfRatingBlockedText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.redBadge,
  },

  // Composant Étoiles
  starsSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginBottom: 8,
  },
  starsGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  starTouchable: {
    padding: 2,
  },
  starIcon: {
    fontSize: 26,
    color: '#D1D1D6',
  },
  starIconActive: {
    color: COLORS.goldBadge,
  },
  scoreDisplay: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },

  // Champ Commentaire Optionnel
  commentInput: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginTop: 4,
  },

  // 3. BLOC DÉBRIEFING TECHNIQUE
  debriefContainer: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 18,
    marginTop: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: COLORS.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  textInputMulti: {
    backgroundColor: COLORS.background,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    minHeight: 70,
    textAlignVertical: 'top',
  },

  // 4. BLOC VALIDATION & PUBLICATION (GRAND_RESPONSABLE)
  adminPublicationCard: {
    backgroundColor: COLORS.goldBadgeBg,
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: COLORS.goldBorder,
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  adminCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  adminTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#B8860B',
    marginLeft: 8,
  },
  summaryGrid: {
    gap: 8,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  summarySectionName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  summaryScore: {
    fontSize: 13,
    fontWeight: '800',
    color: '#B8860B',
  },
  btnPublish24h: {
    backgroundColor: COLORS.greenSuccess,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.greenSuccess,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  btnPublish24hText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  // BOTTOM TAB BAR iOS
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
