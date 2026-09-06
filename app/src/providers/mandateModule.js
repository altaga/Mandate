/**
 * @file mandateModule.js
 * @description Global Context Provider for Mandate State & Telemetry Logging.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { SecurityService } from '../utils/security';
import { CONFIG } from '../constants/config';

const MandateContext = createContext(null);

const defaultUser = {
  id: 'usr_demo_001',
  name: 'Elena Rostova',
  email: 'elena.rostova@example.com',
  walletAddress: CONFIG.ARC_NETWORK.DEFAULT_BUYER_ADDRESS,
  enrolledAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  biometricHash: 'bio_hash_e9a8f4c2d1',
  worldVerified: true,
  riskTier: 'LOW'
};

export const MandateProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(defaultUser);
  const [logs, setLogs] = useState([]);
  const [activeCheckoutItem, setActiveCheckoutItem] = useState(null);

  useEffect(() => {
    async function loadSecureProfile() {
      const stored = await SecurityService.getSecureUser();
      if (stored) {
        setCurrentUser(stored);
      } else {
        await SecurityService.storeSecureUser(defaultUser);
      }
    }
    loadSecureProfile();
  }, []);

  const addLog = (entry) => {
    const newLog = {
      id: 'log_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      ...entry
    };
    setLogs(prev => [newLog, ...prev.slice(0, 100)]);
  };

  const updateUserProfile = async (newUser) => {
    setCurrentUser(newUser);
    await SecurityService.storeSecureUser(newUser);
    addLog({
      component: 'ENROLLMENT_ENGINE',
      action: 'USER_PROFILE_UPDATED',
      details: { userId: newUser.id, name: newUser.name, walletAddress: newUser.walletAddress }
    });
  };

  return (
    <MandateContext.Provider value={{
      currentUser,
      updateUserProfile,
      logs,
      addLog,
      activeCheckoutItem,
      setActiveCheckoutItem
    }}>
      {children}
    </MandateContext.Provider>
  );
};

export const useMandate = () => {
  const context = useContext(MandateContext);
  if (!context) {
    throw new Error('useMandate must be used within a MandateProvider');
  }
  return context;
};
