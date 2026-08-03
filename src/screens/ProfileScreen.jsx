import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView
} from 'react-native';
import { supabase } from '../supabaseClient';

export default function ProfileScreen({ currentUser = { prenom: 'Éric', nom: 'Kouamé', role: 'RESP_SECTION', sectionNom: 'Cadrage' }, onLogout }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);

  const isAdmin = currentUser.role === 'GRAND_RESPONSABLE';

  useEffect(() => {
    if (isAdmin) {
      fetchProfiles();
    }
  }, [isAdmin]);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('profiles').select('*');
      if (data) {
        setProfiles(data);
      }
    } catch (e) {}
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerSub}>DÉPARTEMENT COMMUNICATION</Text>
            <Text style={styles.headerTitle}>Mon Profil</Text>
          </View>

          <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
            <Text style={styles.logoutBtnText}>Se déconnecter</Text>
          </TouchableOpacity>
        </View>

        {/* CARTE PROFIL */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{currentUser.prenom ? currentUser.prenom.charAt(0) : 'U'}</Text>
          </View>
          <Text style={styles.profileName}>{currentUser.prenom} {currentUser.nom}</Text>
          <Text style={styles.profileSub}>Rôle : {currentUser.role} • Section {currentUser.sectionNom || 'Cadrage'}</Text>
        </View>

        {/* DASHBOARD ADMIN DE TRACKING DU GRAND RESPONSABLE */}
        {isAdmin && (
          <View style={styles.adminDashboard}>
            <View style={styles.adminHeader}>
              <Text style={styles.adminTitle}>Dashboard Grand Responsable</Text>
              <Text style={styles.adminSub}>Suivi des membres & Activité Temps Réel</Text>
            </View>

            {loading ? (
              <Text style={styles.loadingText}>Chargement des membres Supabase...</Text>
            ) : (
              <View style={styles.membersList}>
                {profiles.map(p => (
                  <View key={p.id} style={styles.memberCard}>
                    <View style={styles.memberLeft}>
                      <View style={[styles.statusDot, p.is_online ? styles.dotOnline : styles.dotOffline]} />
                      <View>
                        <Text style={styles.memberName}>{p.prenom} {p.nom} ({p.section_nom || 'COM'})</Text>
                        <Text style={styles.memberRole}>{p.role} • {p.email}</Text>
                      </View>
                    </View>

                    <View style={styles.memberRight}>
                      <Text style={styles.lastActionText}>{p.last_action || 'Actif'}</Text>
                      <Text style={styles.timeAgoText}>{p.is_online ? 'En ligne' : 'Hors ligne'}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    padding: 16,
    paddingBottom: 90,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerSub: {
    fontSize: 10,
    fontWeight: '800',
    color: '#007AFF',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#000000',
  },
  logoutBtn: {
    backgroundColor: '#FFEBEA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  logoutBtnText: {
    color: '#FF3B30',
    fontSize: 12,
    fontWeight: '800',
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F0F6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 3,
    borderColor: '#007AFF',
  },
  avatarText: {
    fontSize: 30,
    fontWeight: '800',
    color: '#007AFF',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#000000',
  },
  profileSub: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  adminDashboard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  adminHeader: {
    marginBottom: 14,
  },
  adminTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
  },
  adminSub: {
    fontSize: 12,
    color: '#8E8E93',
  },
  loadingText: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    paddingVertical: 20,
  },
  membersList: {
    gap: 10,
  },
  memberCard: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotOnline: {
    backgroundColor: '#34C759',
  },
  dotOffline: {
    backgroundColor: '#C7C7CC',
  },
  memberName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#000000',
  },
  memberRole: {
    fontSize: 11,
    color: '#8E8E93',
  },
  memberRight: {
    alignItems: 'flex-end',
  },
  lastActionText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#007AFF',
  },
  timeAgoText: {
    fontSize: 10.5,
    color: '#8E8E93',
  },
});
