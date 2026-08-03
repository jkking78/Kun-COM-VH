import React, { useState, useEffect } from 'react';
import HomeScreen from './screens/HomeScreen';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authView, setAuthView] = useState('login'); // 'login', 'signup', 'app'

  // INITIALISATION OPTIMISTE IMMÉDIATE (SANS AWAIT BLOQUANT)
  useEffect(() => {
    let isMounted = true;

    // Timeout de sécurité de 1.5s max sur le check d'authentification
    const authTimeout = setTimeout(() => {
      if (isMounted && !currentUser) {
        setAuthView('login');
      }
    }, 1500);

    try {
      const savedUser = sessionStorage.getItem('kun_com_user');
      if (savedUser && isMounted) {
        setCurrentUser(JSON.parse(savedUser));
        setAuthView('app');
      }
    } catch (e) {
      if (isMounted) setAuthView('login');
    }

    return () => {
      isMounted = false;
      clearTimeout(authTimeout);
    };
  }, []);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    try {
      sessionStorage.setItem('kun_com_user', JSON.stringify(user));
    } catch(e) {}
    setAuthView('app');
  };

  const handleSignupSuccess = (user) => {
    setCurrentUser(user);
    try {
      sessionStorage.setItem('kun_com_user', JSON.stringify(user));
    } catch(e) {}
    setAuthView('app');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      sessionStorage.removeItem('kun_com_user');
    } catch(e) {}
    setAuthView('login');
  };

  if (authView === 'login') {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} onNavigateToSignup={() => setAuthView('signup')} />;
  }

  if (authView === 'signup') {
    return <SignupScreen onSignupSuccess={handleSignupSuccess} onNavigateToLogin={() => setAuthView('login')} />;
  }

  return <HomeScreen currentUser={currentUser} onLogout={handleLogout} />;
}
