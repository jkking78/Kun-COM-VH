import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator
} from 'react-native';
import { supabase } from '../supabaseClient';

export default function LoginScreen({ onLoginSuccess, onNavSignup }) {
  const [email, setEmail] = useState('eric.kouame@eglise.org');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMsg("Veuillez saisir votre e-mail et mot de passe.");
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      const userProfile = data.user;
      setLoading(false);
      onLoginSuccess(userProfile);
    } catch (err) {
      setErrorMsg(err.message || "Erreur de connexion.");
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.subHeader}>ÉGLISE VASE D'HONNEUR</Text>
        <Text style={styles.headerTitle}>Kun COM</Text>

        {errorMsg ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        <View style={styles.formGroup}>
          <Text style={styles.label}>Adresse E-mail</Text>
          <TextInput
            style={styles.input}
            placeholder="ex: eric.kouame@eglise.org"
            placeholderTextColor="#8E8E93"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Mot de passe</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#8E8E93"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>Se connecter</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkContainer} onPress={onNavSignup}>
          <Text style={styles.linkText}>
            Vous n'avez pas de compte ? <Text style={styles.linkHighlight}>S'inscrire</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 380,
    padding: 24,
  },
  subHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#007AFF',
    letterSpacing: 1.4,
    textAlign: 'center',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 32,
    letterSpacing: -0.8,
  },
  errorBox: {
    backgroundColor: '#FFEBEA',
    padding: 10,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#000000',
  },
  submitBtn: {
    width: '100%',
    height: 50,
    backgroundColor: '#007AFF',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  linkContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 13,
    color: '#8E8E93',
  },
  linkHighlight: {
    color: '#007AFF',
    fontWeight: '800',
  },
});
