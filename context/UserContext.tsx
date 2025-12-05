import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserPreferences } from '../types';
import { getUserPreferences, saveUserPreferences, clearUserPreferences, defaultPreferences } from '../services/storage';

interface UserContextType {
  user: UserPreferences | null;
  isLoading: boolean;
  updateUser: (prefs: UserPreferences) => Promise<void>;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const prefs = await getUserPreferences();
      setUser(prefs);
    } catch (e) {
      console.error('Failed to load user', e);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUser = async (prefs: UserPreferences) => {
    await saveUserPreferences(prefs);
    setUser(prefs);
  };

  const logout = async () => {
    await clearUserPreferences();
    setUser(null);
  };

  return (
    <UserContext.Provider value={{ user, isLoading, updateUser, logout }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
