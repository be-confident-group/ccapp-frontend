import { Tabs, router } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { HomeIcon, MapIcon, PlusCircleIcon, UserGroupIcon, UserIcon } from 'react-native-heroicons/solid';

import { HapticTab } from '@/components/haptic-tab';
import { useTheme } from '@/contexts/ThemeContext';

export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
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
                color={focused ? colors.primary : color}
              />
            </View>
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push('/modals/quick-actions-modal');
          },
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
