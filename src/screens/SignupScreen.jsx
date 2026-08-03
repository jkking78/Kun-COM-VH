import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  StatusBar
} from 'react-native';
import { styles } from './authStyles';
import Toast from '../components/Toast';

const SECTIONS = [
  { id: 'web', nom: 'Web' },
  { id: 'proj', nom: 'Projection' },
  { id: 'prod', nom: 'Prod' },
  { id: 'regie', nom: 'Régie' },
  { id: 'cadrage', nom: 'Cadrage' },
  { id: 'photo', nom: 'Photo' },
  { id: 'vente', nom: 'Vente' },
];

export default function SignupScreen({ onSignupSuccess, onNavigateToLogin }) {
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedSection, setSelectedSection] = useState('cadrage');

  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
  };

  const handleSignup = () => {
    if (!nom || !prenom || !email || !password) {
      showToast("Veuillez remplir tous les champs.", "error");
      return;
    }

    const newMember = {
      id: `usr-${Date.now()}`,
      nom: nom,
      prenom: prenom,
      email: email,
      sectionId: selectedSection,
      sectionNom: SECTIONS.find(s => s.id === selectedSection)?.nom || 'Communication',
      role: 'MEMBRE',
      trustScore: 100.0,
      isStagiaireBadge: true
    };

    // Redirection immédiate vers le Feed principal avec déclenchement du Toast
    onSignupSuccess(newMember);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast({ ...toast, visible: false })} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingVertical: 30}}>
        <View style={styles.innerBox}>
          <View style={styles.logoHeader}>
            <Text style={styles.appSub}>INSCRIPTION COMPTE</Text>
            <Text style={styles.appTitle}>Rejoindre Kun COM</Text>
          </View>

          <View style={styles.formBox}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Prénom</Text>
              <TextInput
                style={styles.input}
                value={prenom}
                onChangeText={setPrenom}
                placeholder="ex: Jean"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nom</Text>
              <TextInput
                style={styles.input}
                value={nom}
                onChangeText={setNom}
                placeholder="ex: Dupont"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Adresse E-mail</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="ex: jean.dupont@eglise.org"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mot de passe</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Section d'appartenance</Text>
              <View style={styles.sectionGrid}>
                {SECTIONS.map(sec => {
                  const isActive = selectedSection === sec.id;
                  return (
                    <TouchableOpacity
                      key={sec.id}
                      style={[styles.sectionChip, isActive && styles.sectionChipActive]}
                      onPress={() => setSelectedSection(sec.id)}
                    >
                      <Text style={[styles.sectionChipText, isActive && styles.sectionChipTextActive]}>
                        {sec.nom}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleSignup}>
              <Text style={styles.primaryBtnText}>Créer mon compte (MEMBRE)</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.switchBox} onPress={onNavigateToLogin}>
            <Text style={styles.switchText}>
              Vous avez déjà un compte ? <Text style={styles.switchLink}>Se connecter</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
