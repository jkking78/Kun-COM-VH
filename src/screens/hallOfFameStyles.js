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
  purpleAction: '#5856D6',
  purpleBg: '#F0EFFF',
  borderLight: '#E5E5EA',
  inactiveTab: '#999999',
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
    color: '#B8860B',
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

  // 2. NAV TABS
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnActive: {
    backgroundColor: COLORS.goldBadgeBg,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabBtnTextActive: {
    color: '#B8860B',
    fontWeight: '800',
  },

  // SCROLL CONTENT
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },

  // CARTE PAR SERVICE
  serviceCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: COLORS.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  serviceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceDate: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  goldPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.goldBadgeBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
  },
  goldPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B8860B',
  },
  winnerBox: {
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  winnerTextGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  winnerIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  winnerSectionName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  winnerScore: {
    fontSize: 14,
    fontWeight: '900',
    color: '#B8860B',
  },

  // CARTE VEDETTE DU MOIS
  monthCard: {
    backgroundColor: COLORS.goldBadgeBg,
    borderRadius: 22,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: COLORS.goldBorder,
    alignItems: 'center',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  trophyIconLarge: {
    fontSize: 48,
    marginBottom: 8,
  },
  monthTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#B8860B',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  monthSectionName: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.textPrimary,
    marginVertical: 4,
  },
  monthScoreText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#B8860B',
    marginBottom: 14,
  },
  teamPhotoPlaceholder: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamPhotoText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: 6,
  },

  // CARTE TROPHÉE DE L'ANNÉE
  yearCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  yearTrophyIcon: {
    fontSize: 64,
    marginBottom: 10,
  },
  yearLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.goldBadge,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  yearWinnerSection: {
    fontSize: 30,
    fontWeight: '900',
    color: '#FFFFFF',
    marginVertical: 6,
  },
  yearSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
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
