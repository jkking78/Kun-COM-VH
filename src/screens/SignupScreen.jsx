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

export default function SignupScreen({ onSignupSuccess, onNavLogin }) {
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [section, setSection] = useState('cadrage');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const secNames = {
    cadrage: 'Cadrage',
    regie: 'Régie',
    web: 'Web',
    proj: 'Projection',
    prod: 'Prod',
    photo: 'Photo',
    vente: 'Vente'
  };

  const handleSignup = async () => {
    if (!email || !password || !prenom || !nom) {
      setErrorMsg("Veuillez remplir tous les champs du formulaire.");
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          nom: nom.trim(),
          prenom: prenom.trim(),
          section_id: section,
          section_nom: secNames[section] || 'Cadrage',
          role: 'MEMBRE'
        }
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      const userProfile = data.user;
      setLoading(false);
      onSignupSuccess(userProfile);
    } catch (err) {
      setErrorMsg(err.message || "Erreur lors de la création du compte.");
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.subHeader}>INSCRIPTION COMPTE</Text>
        <Text style={styles.headerTitle}>Rejoindre Kun COM</Text>

        {errorMsg ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        <View style={styles.formGroup}>
          <Text style={styles.label}>Prénom</Text>
          <TextInput
            style={styles.input}
            placeholder="ex: Jean"
            placeholderTextColor="#8E8E93"
            value={prenom}
            onChangeText={setPrenom}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Nom</Text>
          <TextInput
            style={styles.input}
            placeholder="ex: Dupont"
            placeholderTextColor="#8E8E93"
            value={nom}
            onChangeText={setNom}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Adresse E-mail</Text>
          <TextInput
            style={styles.input}
            placeholder="ex: jean.dupont@eglise.org"
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

        <TouchableOpacity style={styles.submitBtn} onPress={handleSignup} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>Créer mon compte (MEMBRE)</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkContainer} onPress={onNavLogin}>
          <Text style={styles.linkText}>
            Vous avez déjà un compte ? <Text style={styles.linkHighlight}>Se connecter</Text>
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
    fontSize: 28,
    fontWeight: '900',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 24,
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
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  input: {
    width: '100%',
    height: 46,
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
    marginTop: 20,
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
