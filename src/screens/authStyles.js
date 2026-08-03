import { StyleSheet, Platform } from 'react-native';

export const COLORS = {
  background: '#FAFAFA',
  cardBg: '#FFFFFF',
  textPrimary: '#000000',
  textSecondary: '#8E8E93',
  appleBlue: '#007AFF',
  appleBlueLight: '#F0F6FF',
  borderLight: '#EFEFEF',
  redError: '#FF3B30',
  greenSuccess: '#34C759'
};

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  innerBox: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  logoHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  appSub: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.appleBlue,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  appTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: -0.8,
  },
  formBox: {
    gap: 14,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  input: {
    width: '100%',
    height: 48,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 14,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  pickerContainer: {
    width: '100%',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    overflow: 'hidden',
  },
  sectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  sectionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  sectionChipActive: {
    backgroundColor: COLORS.appleBlue,
    borderColor: COLORS.appleBlue,
  },
  sectionChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  sectionChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  primaryBtn: {
    width: '100%',
    height: 50,
    backgroundColor: COLORS.appleBlue,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: COLORS.appleBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  switchBox: {
    marginTop: 24,
    alignItems: 'center',
  },
  switchText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  switchLink: {
    color: COLORS.appleBlue,
    fontWeight: '800',
  }
});
