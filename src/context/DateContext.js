import React, { createContext, useContext, useState } from 'react';

const DateContext = createContext();

export const DateProvider = ({ children }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());

  return (
    <DateContext.Provider value={{ selectedDate, setSelectedDate }}>
      {children}
    </DateContext.Provider>
  );
};

export const useSelectedDate = () => {
  const context = useContext(DateContext);
  if (!context) {
    throw new Error('useSelectedDate must be used within a DateProvider');
  }
  return context;
};
