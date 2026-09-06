/**
 * @file security.js
 * @description Security & Cryptographic Storage Utilities for Mandate.
 * Securely stores biometric hashes, wallet keys, and World ID nullifiers.
 */

const ENROLLED_USER_KEY = 'mandate_secure_enrolled_user_v1';
const NULLIFIERS_STORE_KEY = 'mandate_secure_nullifiers_v1';

const memoryStoreMock = {};

export class SecurityService {
  static async getSecureStoreModule() {
    try {
      const SecureStore = await import('expo-secure-store');
      return SecureStore;
    } catch {
      return null;
    }
  }

  static async setSecureItem(key, value) {
    try {
      const SecureStore = await this.getSecureStoreModule();
      if (SecureStore && typeof SecureStore.setItemAsync === 'function') {
        await SecureStore.setItemAsync(key, value);
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      } else {
        memoryStoreMock[key] = value;
      }
    } catch {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
      else memoryStoreMock[key] = value;
    }
  }

  static async getSecureItem(key) {
    try {
      const SecureStore = await this.getSecureStoreModule();
      if (SecureStore && typeof SecureStore.getItemAsync === 'function') {
        const val = await SecureStore.getItemAsync(key);
        if (val) return val;
      }
      if (typeof localStorage !== 'undefined') {
        const val = localStorage.getItem(key);
        if (val) return val;
      }
      return memoryStoreMock[key] || null;
    } catch {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key) || null;
      }
      return memoryStoreMock[key] || null;
    }
  }

  static async storeSecureUser(userData) {
    try {
      if (!userData || !userData.walletAddress) {
        throw new Error('Invalid user payload: Wallet address is required for secure storage');
      }

      const sanitizedPayload = {
        id: String(userData.id || '').trim(),
        name: String(userData.name || '').trim(),
        email: String(userData.email || '').toLowerCase().trim(),
        walletAddress: String(userData.walletAddress || '').trim(),
        biometricHash: String(userData.biometricHash || '').trim(),
        faceVector: Array.isArray(userData.faceVector) ? userData.faceVector : null,
        enrolledAt: userData.enrolledAt || new Date().toISOString(),
        riskTier: userData.riskTier || 'LOW'
      };

      const jsonValue = JSON.stringify(sanitizedPayload);
      await this.setSecureItem(ENROLLED_USER_KEY, jsonValue);
      return true;
    } catch (error) {
      console.error('[SECURITY_SERVICE] Error saving secure user:', error);
      return false;
    }
  }

  static async getSecureUser() {
    try {
      const jsonValue = await this.getSecureItem(ENROLLED_USER_KEY);
      return jsonValue ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error('[SECURITY_SERVICE] Error retrieving secure user:', error);
      return null;
    }
  }

  static async isNullifierReused(nullifierHash) {
    try {
      if (!nullifierHash) return false;
      const cleanHash = nullifierHash.toLowerCase().trim();
      const rawNullifiers = await this.getSecureItem(NULLIFIERS_STORE_KEY);
      const nullifierRecords = rawNullifiers ? JSON.parse(rawNullifiers) : [];

      return nullifierRecords.some(record =>
        (typeof record === 'string' ? record : record.nullifierHash) === cleanHash
      );
    } catch (error) {
      console.error('[SECURITY_SERVICE] Error checking nullifier hash:', error);
      return false;
    }
  }

  static async storeNullifier(nullifierHash, orderId = null) {
    try {
      if (!nullifierHash) return false;
      const cleanHash = nullifierHash.toLowerCase().trim();
      const rawNullifiers = await this.getSecureItem(NULLIFIERS_STORE_KEY);
      const nullifierRecords = rawNullifiers ? JSON.parse(rawNullifiers) : [];

      const exists = nullifierRecords.some(record =>
        (typeof record === 'string' ? record : record.nullifierHash) === cleanHash
      );

      if (!exists) {
        nullifierRecords.push({
          nullifierHash: cleanHash,
          orderId,
          timestamp: new Date().toISOString(),
          lockStatus: 'ACTIVE_REPLAY_PROTECTION'
        });
        await this.setSecureItem(NULLIFIERS_STORE_KEY, JSON.stringify(nullifierRecords));
      }
      return true;
    } catch (error) {
      console.error('[SECURITY_SERVICE] Error storing nullifier hash:', error);
      return false;
    }
  }
}
