import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  Image,
  ViewToken,
  Animated,
  TouchableOpacity,
  PanResponder,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter, useNavigation } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronDownIcon, UserIcon, EnvelopeIcon, LockClosedIcon } from 'react-native-heroicons/outline';
import { authApi } from '@/lib/api';
import { useSocialAuth } from '@/lib/hooks/useSocialAuth';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const carouselData = [
  { id: '1', image: require('@/assets/images/carousel-1.png') },
  { id: '2', image: require('@/assets/images/carousel-2.png') },
];

export default function WelcomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const { signIn } = useAuth();
  const { handleGoogleSignIn, handleAppleSignIn, loading: socialLoading, appleAuthAvailable } = useSocialAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Handle back button/gesture navigation (Android & iOS)
  useEffect(() => {
    const handleBackAction = () => {
      // If showing password input, go back to email input
      if (showPasswordInput) {
        setShowPasswordInput(false);
        setPassword('');
        return true; // Prevent default behavior
      }

      // If showing email input, go back to auth buttons
      if (showEmailInput) {
        setShowEmailInput(false);
        setEmail('');
        return true; // Prevent default behavior
      }

      // If expanded (showing auth content), collapse it
      if (isExpanded) {
        handleCollapsePress();
        return true; // Prevent default behavior
      }

      // Otherwise, allow default behavior (exit app or go to previous screen)
      return false;
    };

    // Android hardware back button
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackAction);

    return () => backHandler.remove();
  }, [isExpanded, showEmailInput, showPasswordInput]);

  // iOS: Prevent swipe-back gesture when auth states are active, but allow programmatic navigation (replace/push)
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      // Allow programmatic navigation (e.g., replace to /(tabs))
      const actionType = e?.data?.action?.type;
      if (actionType && actionType !== 'POP' && actionType !== 'GO_BACK') {
        return;
      }

      // If no auth states are active, allow navigation
      if (!isExpanded && !showEmailInput && !showPasswordInput) {
        return;
      }

      // Prevent default back behavior and collapse auth UI instead
      e.preventDefault();

      if (showPasswordInput) {
        setShowPasswordInput(false);
        setPassword('');
      } else if (showEmailInput) {
        setShowEmailInput(false);
        setEmail('');
      } else if (isExpanded) {
        handleCollapsePress();
      }
    });

    return unsubscribe;
  }, [navigation, isExpanded, showEmailInput, showPasswordInput]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        setCurrentIndex(viewableItems[0].index || 0);
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const handleSignUpPress = () => {
    setIsExpanded(true);
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 10,
    }).start();
  };

  const handleEmailButtonPress = () => {
    setShowEmailInput(true);
  };

  const handleEmailSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      const response = await authApi.checkEmail(email.trim());

      if (response.exists) {
        // User exists, show password input
        setShowPasswordInput(true);
      } else {
        // User doesn't exist, navigate to signup
        router.push({
          pathname: '/(auth)/signup',
          params: { email: email.trim() }
        });
      }
    } catch (error) {
      console.error('Email check error:', error);
      Alert.alert('Error', 'Failed to verify email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!password.trim()) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    setLoading(true);

    try {
      await authApi.login({
        email: email.trim(),
        password: password,
      });

      // Set loading to false
      setLoading(false);

      // Update auth state - this will trigger navigation via AuthContext
      signIn();
    } catch (error) {
      console.error('Login error:', error);
      setLoading(false);

      const errorMessage = error instanceof Error
        ? error.message
        : 'Login failed. Please check your credentials.';
      Alert.alert('Login Failed', errorMessage);
    }
  };

  const handleCollapsePress = () => {
    setIsExpanded(false);
    setShowEmailInput(false);
    setShowPasswordInput(false);
    setEmail('');
    setPassword('');
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 10,
    }).start();
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => isExpanded,
        onStartShouldSetPanResponderCapture: () => false, // Allow children to handle first
        onMoveShouldSetPanResponder: (_, gestureState) => {
          // Only respond to vertical drags when expanded
          return (
            isExpanded &&
            gestureState.dy > 5 && // Must be dragging down
            Math.abs(gestureState.dy) > Math.abs(gestureState.dx) // More vertical than horizontal
          );
        },
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          // Capture vertical drags to prevent FlatList from handling them
          return (
            isExpanded &&
            gestureState.dy > 5 &&
            Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
          );
        },
        onPanResponderGrant: () => {
          // Touch started
        },
        onPanResponderMove: () => {
          // Optional: Add visual feedback during drag
          // Could add a translateY animation here
        },
        onPanResponderRelease: (_, gestureState) => {
          // If dragged down more than 50px, collapse the view
          if (gestureState.dy > 50) {
            handleCollapsePress();
          }
        },
      }),
    [isExpanded]
  );

  const renderItem = ({ item }: { item: { id: string; image: any } }) => (
    <View style={styles.imageSlide}>
      <View style={styles.imageWrapper}>
        <Image
          source={item.image}
          style={styles.image}
          resizeMode="cover"
        />
      </View>
    </View>
  );

  const cardTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    // Lift higher to reveal auth, maintaining a floating feel
    outputRange: [0, -SCREEN_HEIGHT * 0.35],
  });

  const cardScale = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.9],
  });

  const buttonOpacity = slideAnim.interpolate({
    inputRange: [0, 0.5],
    outputRange: [1, 0],
  });

  const authContentOpacity = slideAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  const chevronOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const paginationOpacity = slideAnim.interpolate({
    inputRange: [0, 0.5],
    outputRange: [1, 0],
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Chevron (shown when expanded) - positioned at top */}
        <Animated.View style={[styles.chevronContainer, { opacity: chevronOpacity }]}>
          <TouchableOpacity onPress={handleCollapsePress} style={styles.chevronButton}>
            <ChevronDownIcon color={colors.textSecondary} size={28} />
          </TouchableOpacity>
        </Animated.View>

        {/* Main Content Container - uses flex to create relationships */}
        <View style={styles.mainContent}>
          {/* Photo Card */}
          <Animated.View
            style={[
              styles.cardContainer,
              {
                transform: [
                  { translateY: cardTranslateY },
                  { scale: cardScale }
                ],
              },
            ]}
          >
            <View
              style={[styles.card, { backgroundColor: colors.card }]}
              {...(isExpanded ? panResponder.panHandlers : {})}
            >
              {/* Carousel */}
              <FlatList
                ref={flatListRef}
                data={carouselData}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                scrollEnabled={!isExpanded}
              />
            </View>
          </Animated.View>

          {/* Spacer - creates flexible space that centers pagination */}
          <View style={styles.topSpacer} />

          {/* Pagination Dashes (perfectly centered between image and button) */}
          <Animated.View style={[styles.paginationContainerOutside, { opacity: paginationOpacity }]}>
            {carouselData.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dash,
                  {
                    backgroundColor: currentIndex === index ? colors.primary : colors.border,
                    width: currentIndex === index ? 54 : 28,
                  },
                ]}
              />
            ))}
          </Animated.View>

          {/* Spacer - creates flexible space that centers pagination */}
          <View style={styles.bottomSpacer} />

          {/* Button and Auth Content Container - they occupy the same space */}
          <View style={styles.actionContainer}>
            {/* Sign Up / Sign In Button (disappears when expanded) */}
            <Animated.View
              style={[styles.signUpButtonContainer, { opacity: buttonOpacity }]}
              pointerEvents={isExpanded ? 'none' : 'auto'}
            >
              <TouchableOpacity
                style={[styles.signUpButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={handleSignUpPress}
              >
                <UserIcon color={colors.text} size={24} />
                <Text style={[styles.signUpButtonText, { color: colors.text }]}>Sign Up / Sign In</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Auth Content (shown when expanded) */}
            <Animated.View
              style={[
                styles.authContent,
                {
                  opacity: authContentOpacity,
                  transform: [
                    { translateY: cardTranslateY }
                  ],
                },
              ]}
              pointerEvents={isExpanded ? 'auto' : 'none'}
            >
              {!showEmailInput ? (
                <>
                  <Text style={[styles.authTitle, { color: colors.text }]}>Let's get started</Text>
                  <Text style={[styles.authSubtitle, { color: colors.textSecondary }]}>
                    Sign in to track your walks and rides, provide feedbacks on the infrastructure and help local authorities improve the it.
                  </Text>

                  <View style={styles.authButtons}>
                    {/* Google Button */}
                    <TouchableOpacity
                      style={[styles.authButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                      onPress={handleGoogleSignIn}
                      disabled={socialLoading}
                    >
                      <View style={styles.authButtonContent}>
                        <FontAwesome name="google" size={20} color={colors.text} />
                        <Text style={[styles.authButtonText, { color: colors.text }]}>Continue with Google</Text>
                      </View>
                    </TouchableOpacity>

                    {/* Apple Button (iOS only) */}
                    {Platform.OS === 'ios' && appleAuthAvailable && (
                      <TouchableOpacity
                        style={[styles.authButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={handleAppleSignIn}
                        disabled={socialLoading}
                      >
                        <View style={styles.authButtonContent}>
                          <FontAwesome name="apple" size={20} color={colors.text} />
                          <Text style={[styles.authButtonText, { color: colors.text }]}>Continue with Apple</Text>
                        </View>
                      </TouchableOpacity>
                    )}

                    {/* Email Button */}
                    <TouchableOpacity
                      style={[styles.authButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                      onPress={handleEmailButtonPress}
                    >
                      <View style={styles.authButtonContent}>
                        <EnvelopeIcon color={colors.text} size={20} />
                        <Text style={[styles.authButtonText, { color: colors.text }]}>Continue with email</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </>
              ) : !showPasswordInput ? (
                <>
                  <Text style={[styles.authTitle, { color: colors.text }]}>Enter your email address</Text>

                  <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <EnvelopeIcon color={colors.textSecondary} size={20} />
                    <TextInput
                      style={[styles.textInput, { color: colors.text }]}
                      placeholder="Type your email"
                      placeholderTextColor={colors.textSecondary}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      autoFocus={showEmailInput}
                      editable={!loading}
                      onSubmitEditing={handleEmailSubmit}
                      returnKeyType="next"
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.sendButton, { backgroundColor: colors.primary, opacity: loading || !email.trim() ? 0.5 : 1 }]}
                    onPress={handleEmailSubmit}
                    disabled={loading || !email.trim()}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.sendButtonText}>Continue</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={[styles.authTitle, { color: colors.text }]}>Enter your password</Text>

                  <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <LockClosedIcon color={colors.textSecondary} size={20} />
                    <TextInput
                      style={[styles.textInput, { color: colors.text }]}
                      placeholder="Type your password"
                      placeholderTextColor={colors.textSecondary}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      autoCapitalize="none"
                      autoComplete="password"
                      autoFocus={showPasswordInput}
                      editable={!loading}
                      onSubmitEditing={handlePasswordSubmit}
                      returnKeyType="done"
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.sendButton, { backgroundColor: colors.primary, opacity: loading || !password.trim() ? 0.5 : 1 }]}
                    onPress={handlePasswordSubmit}
                    disabled={loading || !password.trim()}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.sendButtonText}>Sign In</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.forgotPasswordLink}
                    onPress={() => router.push('/(auth)/forgot-password')}
                  >
                    <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>
                      Forgot password?
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </Animated.View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingBottom: 20,
  },
  cardContainer: {
    width: '100%',
  },
  card: {
    // Rounded corners, no border lines
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: 'transparent',
    elevation: 0,
  },
  imageSlide: {
    width: SCREEN_WIDTH - 40,
    height: SCREEN_HEIGHT * 0.75,
    paddingHorizontal: 4,
  },
  imageWrapper: {
    flex: 1,
    borderRadius: 32,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  spacer: {
    flex: 1,
  },
  topSpacer: {
    height: 24,
  },
  bottomSpacer: {
    height: 24,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  paginationContainerOutside: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dash: {
    height: 6,
    borderRadius: 3,
  },
  chevronContainer: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
  chevronButton: {
    padding: 8,
  },
  actionContainer: {
    width: '100%',
    position: 'relative',
  },
  signUpButtonContainer: {
    width: '100%',
  },
  signUpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 2,
    gap: 12,
  },
  signUpButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  authContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
  },
  authTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 2,
    gap: 12,
    marginBottom: 16,
    height: 52,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    paddingVertical: 0,
    includeFontPadding: false,
  },
  sendButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  authSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  authButtons: {
    gap: 10,
  },
  authButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 2,
  },
  authButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  authButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  forgotPasswordLink: {
    alignItems: 'center',
    marginTop: 16,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
