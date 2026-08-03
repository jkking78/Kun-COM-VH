import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { styles } from './authStyles';
import Toast from '../components/Toast';

export default function LoginScreen({ onLoginSuccess, onNavigateToSignup }) {
  const [email, setEmail] = useState('eric.kouame@eglise.org');
  const [password, setPassword] = useState('password123');

  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
  };

  const handleLogin = () => {
    if (!email || !password) {
      showToast("Veuillez remplir tous les champs.", "error");
      return;
    }

    const mockUser = {
      id: 'usr-cadrage-1',
      nom: 'Kouamé',
      prenom: 'Éric',
      email: email,
      sectionId: 'cadrage',
      sectionNom: 'Cadrage',
      role: 'RESP_SECTION',
      trustScore: 98.5,
      isStagiaireBadge: false
    };

    onLoginSuccess(mockUser);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast({ ...toast, visible: false })} />

      <View style={styles.innerBox}>
        <View style={styles.logoHeader}>
          <Text style={styles.appSub}>ÉGLISE VASE D'HONNEUR</Text>
          <Text style={styles.appTitle}>Kun COM</Text>
        </View>

        <View style={styles.formBox}>
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

          <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin}>
            <Text style={styles.primaryBtnText}>Se connecter</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.switchBox} onPress={onNavigateToSignup}>
          <Text style={styles.switchText}>
            Vous n'avez pas de compte ? <Text style={styles.switchLink}>S'inscrire</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
