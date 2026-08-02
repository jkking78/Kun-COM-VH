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
  orangeTransition: '#FF9500',
  orangeBg: '#FFF4E5',
  purpleAction: '#5856D6',
  purpleBg: '#F0EFFF',
  greyClosed: '#8E8E93',
  greyClosedBg: '#E5E5EA',
  redBadge: '#FF3B30',
  borderLight: '#E5E5EA',
  goldBadgeBg: '#FFF9E6',
  goldBorder: '#FFC107',
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
    color: COLORS.purpleAction,
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
  roleToggleButton: {
    backgroundColor: COLORS.purpleBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(88,86,214,0.2)',
  },
  roleToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.purpleAction,
  },

  // 2. CALENDRIER HORIZONTAL
  calendarContainer: {
    backgroundColor: COLORS.cardBg,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  calendarScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  dateItem: {
    width: 60,
    height: 72,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dateItemActive: {
    backgroundColor: COLORS.appleBlue,
    shadowColor: COLORS.appleBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  dateDayText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  dateDayTextActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  dateNumberText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  dateNumberTextActive: {
    color: '#FFFFFF',
  },

  // SCROLL CONTENT
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },

  // 3. BANNIÈRE TRANSITION (30 MIN)
  transitionBanner: {
    backgroundColor: COLORS.orangeBg,
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.orangeTransition,
    shadowColor: COLORS.orangeTransition,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  transitionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  transitionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.orangeTransition,
  },
  timerBadge: {
    backgroundColor: COLORS.orangeTransition,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timerText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  transitionSubtitle: {
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 18,
    marginBottom: 14,
  },

  // Mini Card Check-in Rapide
  checkInCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,149,0,0.3)',
  },
  checkInLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkInIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  checkInTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  checkInSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  checkInBtn: {
    backgroundColor: COLORS.appleBlue,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  checkInBtnDone: {
    backgroundColor: COLORS.greenSuccess,
  },
  checkInBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // 4. CARTE DE CULTE
  culteCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: COLORS.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  culteCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  culteName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  culteHours: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Badges de statut
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusBadgeEnCours: {
    backgroundColor: COLORS.greenBg,
  },
  statusBadgeTextEnCours: {
    color: COLORS.greenSuccess,
    fontWeight: '800',
    fontSize: 11,
  },
  statusBadgeTransition: {
    backgroundColor: COLORS.orangeBg,
  },
  statusBadgeTextTransition: {
    color: COLORS.orangeTransition,
    fontWeight: '800',
    fontSize: 11,
  },
  statusBadgeAVenir: {
    backgroundColor: COLORS.appleBlueLight,
  },
  statusBadgeTextAVenir: {
    color: COLORS.appleBlue,
    fontWeight: '800',
    fontSize: 11,
  },
  statusBadgeCloture: {
    backgroundColor: COLORS.greyClosedBg,
  },
  statusBadgeTextCloture: {
    color: COLORS.greyClosed,
    fontWeight: '800',
    fontSize: 11,
  },

  // Affectations par section
  sectionsAssignmentTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
  },
  assignmentsGrid: {
    gap: 8,
    marginBottom: 14,
  },
  assignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  sectionBadgeTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionBadgeIcon: {
    marginRight: 6,
    fontSize: 14,
  },
  sectionBadgeName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  membersAssignedText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },

  // Boutons Actions Responsables
  managerActionContainer: {
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  actionBtnFinish: {
    backgroundColor: COLORS.purpleAction,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.purpleAction,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  actionBtnFinishText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  actionBtnCloseDay: {
    backgroundColor: COLORS.greenSuccess,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: COLORS.greenSuccess,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  actionBtnCloseDayText: {
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
