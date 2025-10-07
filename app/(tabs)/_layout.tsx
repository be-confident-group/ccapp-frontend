import { Tabs } from 'expo-router';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { HomeIcon, MapIcon, PlusCircleIcon, UserGroupIcon, UserIcon } from 'react-native-heroicons/solid';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          height: 80,
          paddingBottom: 20,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <HomeIcon size={32} color={color} />,
        }}
      />
      <Tabs.Screen
        name="maps"
        options={{
          title: 'Maps',
          tabBarIcon: ({ color }) => <MapIcon size={32} color={color} />,
        }}
      />
      <Tabs.Screen
        name="quick-actions"
        options={{
          title: '',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.plusButton}>
              <PlusCircleIcon
                size={56}
                color={focused ? Colors[colorScheme ?? 'light'].primary : color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: 'Groups',
          tabBarIcon: ({ color }) => <UserGroupIcon size={32} color={color} />,
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: 'You',
          tabBarIcon: ({ color }) => <UserIcon size={32} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  plusButton: {
    marginTop: -10,
  },
});
