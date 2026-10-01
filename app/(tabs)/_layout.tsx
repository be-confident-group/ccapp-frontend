import { Tabs, router } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { HomeIcon, MapIcon, PlusIcon, UserGroupIcon, UserIcon } from 'react-native-heroicons/solid';
import {
  HomeIcon as HomeOutlineIcon,
  MapIcon as MapOutlineIcon,
  UserGroupIcon as UserGroupOutlineIcon,
  UserIcon as UserOutlineIcon,
} from 'react-native-heroicons/outline';

import { GlassTabBar } from '@/components/navigation/GlassTabBar';
import { PermissionToast } from '@/components/onboarding/PermissionToast';
import { useAuth } from '@/contexts/AuthContext';
import { TabBarProvider } from '@/contexts/TabBarContext';

const QUICK_ACTIONS_ROUTE = 'quick-actions';

export default function TabLayout() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  // "/" resolves to (tabs)/index on cold start, before the auth check finishes.
  // Don't mount the tab screens (and fire their authenticated queries) until
  // signed in; useProtectedRoute redirects to the auth flow meanwhile.
  if (!isAuthenticated) {
    return null;
  }

  return (
    <TabBarProvider>
      <View style={styles.container}>
        <Tabs
          tabBar={(props) => <GlassTabBar {...props} actionRouteName={QUICK_ACTIONS_ROUTE} />}
          screenOptions={{ headerShown: false }}>
          <Tabs.Screen
            name="index"
            options={{
              title: t('common:navigation.home'),
              tabBarIcon: ({ color, size, focused }) =>
                focused ? <HomeIcon size={size} color={color} /> : <HomeOutlineIcon size={size} color={color} />,
            }}
          />
          <Tabs.Screen
            name="maps"
            options={{
              title: t('common:navigation.maps'),
              tabBarIcon: ({ color, size, focused }) =>
                focused ? <MapIcon size={size} color={color} /> : <MapOutlineIcon size={size} color={color} />,
            }}
          />
          <Tabs.Screen
            name={QUICK_ACTIONS_ROUTE}
            options={{
              title: '',
              tabBarAccessibilityLabel: t('common:navigation.quickActions'),
              tabBarIcon: ({ color, size }) => <PlusIcon size={size} color={color} />,
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
              title: t('common:navigation.feed'),
              tabBarIcon: ({ color, size, focused }) =>
                focused ? <UserGroupIcon size={size} color={color} /> : <UserGroupOutlineIcon size={size} color={color} />,
            }}
          />
          <Tabs.Screen
            name="you"
            options={{
              title: t('common:navigation.you'),
              tabBarIcon: ({ color, size, focused }) =>
                focused ? <UserIcon size={size} color={color} /> : <UserOutlineIcon size={size} color={color} />,
            }}
          />
        </Tabs>
        <PermissionToast />
      </View>
    </TabBarProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
