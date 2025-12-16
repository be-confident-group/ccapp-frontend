import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

const UNITS_STORAGE_KEY = '@beactive_units';

export type UnitSystem = 'metric' | 'imperial';

interface UnitsContextType {
  unitSystem: UnitSystem;
  setUnitSystem: (system: UnitSystem) => Promise<void>;
  isLoading: boolean;

  // Conversion functions
  formatDistance: (km: number, decimals?: number) => string;
  formatSpeed: (kmh: number, decimals?: number) => string;
  formatWeight: (kg: number, decimals?: number) => string;
  formatElevation: (meters: number, decimals?: number) => string;
  formatTemperature: (celsius: number, decimals?: number) => string;

  // Unit labels
  distanceUnit: string;
  speedUnit: string;
  weightUnit: string;
  elevationUnit: string;
  temperatureUnit: string;

  // Raw conversion functions (for when you need just the number)
  kmToDistance: (km: number) => number;
  metersToElevation: (meters: number) => number;
  kmhToSpeed: (kmh: number) => number;
  kgToWeight: (kg: number) => number;
  celsiusToTemperature: (celsius: number) => number;
}

const UnitsContext = createContext<UnitsContextType | undefined>(undefined);

// Conversion constants
const KM_TO_MILES = 0.621371;
const METERS_TO_FEET = 3.28084;
const KG_TO_LBS = 2.20462;

interface UnitsProviderProps {
  children: ReactNode;
}

export function UnitsProvider({ children }: UnitsProviderProps) {
  const [unitSystem, setUnitSystemState] = useState<UnitSystem>('metric');
  const [isLoading, setIsLoading] = useState(true);

  // Load units preference on mount
  useEffect(() => {
    loadUnitsPreference();
  }, []);

  const loadUnitsPreference = async () => {
    try {
      setIsLoading(true);

      // Try to get saved preference
      const saved = await AsyncStorage.getItem(UNITS_STORAGE_KEY);

      if (saved) {
        setUnitSystemState(saved as UnitSystem);
      } else {
        // Auto-detect based on locale
        const locale = Localization.getLocales()[0];
        const region = locale?.regionCode;

        // Default to metric for all regions
        const defaultSystem: UnitSystem = 'metric';
        setUnitSystemState(defaultSystem);

        // Save the default
        await AsyncStorage.setItem(UNITS_STORAGE_KEY, defaultSystem);
      }
    } catch (error) {
      console.error('Error loading units preference:', error);
      setUnitSystemState('metric'); // Fallback to metric
    } finally {
      setIsLoading(false);
    }
  };

  const setUnitSystem = async (system: UnitSystem) => {
    try {
      await AsyncStorage.setItem(UNITS_STORAGE_KEY, system);
      setUnitSystemState(system);
    } catch (error) {
      console.error('Error saving units preference:', error);
    }
  };

  // Raw conversion functions
  const kmToDistance = (km: number): number => {
    return unitSystem === 'imperial' ? km * KM_TO_MILES : km;
  };

  const metersToElevation = (meters: number): number => {
    return unitSystem === 'imperial' ? meters * METERS_TO_FEET : meters;
  };

  const kmhToSpeed = (kmh: number): number => {
    return unitSystem === 'imperial' ? kmh * KM_TO_MILES : kmh;
  };

  const kgToWeight = (kg: number): number => {
    return unitSystem === 'imperial' ? kg * KG_TO_LBS : kg;
  };

  const celsiusToTemperature = (celsius: number): number => {
    return unitSystem === 'imperial' ? (celsius * 9/5) + 32 : celsius;
  };

  // Formatted conversion functions
  const formatDistance = (km: number, decimals: number = 2): string => {
    const converted = kmToDistance(km);
    const unit = unitSystem === 'imperial' ? 'mi' : 'km';
    return `${converted.toFixed(decimals)} ${unit}`;
  };

  const formatSpeed = (kmh: number, decimals: number = 1): string => {
    const converted = kmhToSpeed(kmh);
    const unit = unitSystem === 'imperial' ? 'mph' : 'km/h';
    return `${converted.toFixed(decimals)} ${unit}`;
  };

  const formatWeight = (kg: number, decimals: number = 1): string => {
    const converted = kgToWeight(kg);
    const unit = unitSystem === 'imperial' ? 'lbs' : 'kg';
    return `${converted.toFixed(decimals)} ${unit}`;
  };

  const formatElevation = (meters: number, decimals: number = 0): string => {
    const converted = metersToElevation(meters);
    const unit = unitSystem === 'imperial' ? 'ft' : 'm';
    return `${converted.toFixed(decimals)} ${unit}`;
  };

  const formatTemperature = (celsius: number, decimals: number = 0): string => {
    const converted = celsiusToTemperature(celsius);
    const unit = unitSystem === 'imperial' ? '°F' : '°C';
    return `${converted.toFixed(decimals)}${unit}`;
  };

  // Unit labels
  const distanceUnit = unitSystem === 'imperial' ? 'mi' : 'km';
  const speedUnit = unitSystem === 'imperial' ? 'mph' : 'km/h';
  const weightUnit = unitSystem === 'imperial' ? 'lbs' : 'kg';
  const elevationUnit = unitSystem === 'imperial' ? 'ft' : 'm';
  const temperatureUnit = unitSystem === 'imperial' ? '°F' : '°C';

  const value: UnitsContextType = {
    unitSystem,
    setUnitSystem,
    isLoading,
    formatDistance,
    formatSpeed,
    formatWeight,
    formatElevation,
    formatTemperature,
    distanceUnit,
    speedUnit,
    weightUnit,
    elevationUnit,
    temperatureUnit,
    kmToDistance,
    metersToElevation,
    kmhToSpeed,
    kgToWeight,
    celsiusToTemperature,
  };

  return <UnitsContext.Provider value={value}>{children}</UnitsContext.Provider>;
}

export function useUnits(): UnitsContextType {
  const context = useContext(UnitsContext);
  if (context === undefined) {
    throw new Error('useUnits must be used within a UnitsProvider');
  }
  return context;
}
