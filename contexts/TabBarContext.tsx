import React, { createContext, useContext, useState, ReactNode } from 'react';

interface TabBarContextType {
  isPhotoZoomed: boolean;
  setIsPhotoZoomed: (value: boolean) => void;
}

const TabBarContext = createContext<TabBarContextType | undefined>(undefined);

export const useTabBar = () => {
  const context = useContext(TabBarContext);
  if (context === undefined) {
    throw new Error('useTabBar must be used within a TabBarProvider');
  }
  return context;
};

interface TabBarProviderProps {
  children: ReactNode;
}

export const TabBarProvider: React.FC<TabBarProviderProps> = ({ children }) => {
  const [isPhotoZoomed, setIsPhotoZoomed] = useState(false);

  return (
    <TabBarContext.Provider value={{ isPhotoZoomed, setIsPhotoZoomed }}>
      {children}
    </TabBarContext.Provider>
  );
};

