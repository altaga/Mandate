/**
 * @file databaseService.js
 * @description Secure Database Service for Mandate.
 * Interfaces with the backend API routes and SecureStore
 * to maintain local and persistent biometric identity vaults.
 */

import { SecurityService } from '../utils/security.js';

const getBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return '';
  }
  return 'http://localhost:8081';
};

export class DatabaseService {
  static async saveEnrolledUser(profile) {
    await SecurityService.storeSecureUser(profile);

    try {
      const res = await fetch(`${getBaseUrl()}/api/db/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return true;
    } catch {
      return true;
    }
  }

  static async getAllEnrolledUsers() {
    try {
      const res = await fetch(`${getBaseUrl()}/api/db/users`);
      const data = await res.json();
      
      if (data.success && data.users && data.users.length > 0) {
        return data.users;
      }
      
      const secureUser = await SecurityService.getSecureUser();
      return secureUser ? [secureUser] : [];
    } catch {
      const secureUser = await SecurityService.getSecureUser();
      return secureUser ? [secureUser] : [];
    }
  }
}
