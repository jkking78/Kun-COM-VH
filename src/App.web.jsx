import React, { useState } from 'react';
import HomeScreen from './screens/HomeScreen';
import PlanningScreen from './screens/PlanningScreen';
import RatingDebriefScreen from './screens/RatingDebriefScreen';
import HallOfFameScreen from './screens/HallOfFameScreen';
import ProfileScreen from './screens/ProfileScreen';

export default function AppWeb() {
  const [activeTab, setActiveTab] = useState('home');

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'home':
        return <HomeScreen />;
      case 'planning':
        return <PlanningScreen />;
      case 'debrief':
        return <RatingDebriefScreen />;
      case 'halloffame':
        return <HallOfFameScreen />;
      case 'profile':
        return <ProfileScreen />;
      default:
        return <HomeScreen />;
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* Rendu de l'écran actif */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {renderActiveScreen()}
      </div>

      {/* Barre de navigation globale interactive Web / PWA */}
      <nav style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '70px',
        backgroundColor: 'rgba(255, 255, 255, 0.94)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid #E5E5EA',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        zIndex: 1000
      }}>
        <button
          onClick={() => setActiveTab('home')}
          style={tabButtonStyle(activeTab === 'home')}
        >
          <span style={{ fontSize: '20px' }}>🏠</span>
          <span style={tabTextStyle(activeTab === 'home')}>Accueil</span>
        </button>

        <button
          onClick={() => setActiveTab('planning')}
          style={tabButtonStyle(activeTab === 'planning')}
        >
          <span style={{ fontSize: '20px' }}>📅</span>
          <span style={tabTextStyle(activeTab === 'planning')}>Planning</span>
        </button>

        {/* Bouton Central Surélevé Publier [+] */}
        <button
          onClick={() => setActiveTab('debrief')}
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '26px',
            backgroundColor: '#007AFF',
            color: '#FFFFFF',
            border: 'none',
            fontSize: '26px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '-24px',
            boxShadow: '0 6px 16px rgba(0, 122, 255, 0.4)',
            cursor: 'pointer'
          }}
        >
          +
        </button>

        <button
          onClick={() => setActiveTab('halloffame')}
          style={tabButtonStyle(activeTab === 'halloffame')}
        >
          <span style={{ fontSize: '20px' }}>🌟</span>
          <span style={tabTextStyle(activeTab === 'halloffame')}>Vedettes</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          style={tabButtonStyle(activeTab === 'profile')}
        >
          <span style={{ fontSize: '20px' }}>👤</span>
          <span style={tabTextStyle(activeTab === 'profile')}>Profil</span>
        </button>
      </nav>
    </div>
  );
}

const tabButtonStyle = (isActive) => ({
  background: 'none',
  border: 'none',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: '4px 8px',
  opacity: isActive ? 1 : 0.65,
  transition: 'opacity 0.2s ease'
});

const tabTextStyle = (isActive) => ({
  fontSize: '11px',
  fontWeight: isActive ? '800' : '600',
  color: isActive ? '#007AFF' : '#8E8E93',
  marginTop: '2px'
});
