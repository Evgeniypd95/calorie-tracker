import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform, Image, KeyboardAvoidingView, TouchableOpacity, Modal, Linking, Text as RNText } from 'react-native';
import { TextInput, Button, Text, IconButton, Icon, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Voice from '@react-native-voice/voice';
import { parseMealDescription, convertImageToDescription, gradeMealBackend } from '../../services/geminiService';
import { mealService } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { lookupBarcode, formatBarcodeProductForParsing } from '../../services/barcodeService';
import MealGradeCard from '../../components/MealGradeCard';
import { useLocalization, getMealTypeLabel, getMealTypeLabelLower } from '../../localization/i18n';
import { colors, gradients, radius, shadows } from '../../theme';

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

const MEAL_TYPE_ICONS = {
  Breakfast: 'weather-sunset-up',
  Lunch: 'white-balance-sunny',
  Dinner: 'weather-night',
  Snack: 'food-apple-outline'
};

// Compact nutrition strip shown under parsed AI messages
function NutritionStrip({ totals, t }) {
  if (!totals) return null;
  return (
    <View style={styles.nutritionStrip}>
      <View style={styles.nutritionStat}>
        <RNText style={[styles.nutritionStatValue, { color: colors.primary }]}>{totals.calories}</RNText>
        <RNText style={styles.nutritionStatLabel}>{t('dashboard.calShort')}</RNText>
      </View>
      <View style={styles.nutritionStatDivider} />
      <View style={styles.nutritionStat}>
        <RNText style={[styles.nutritionStatValue, { color: colors.protein }]}>{Math.round(totals.protein)}g</RNText>
        <RNText style={styles.nutritionStatLabel}>{t('dashboard.proteinLabel')}</RNText>
      </View>
      <View style={styles.nutritionStatDivider} />
      <View style={styles.nutritionStat}>
        <RNText style={[styles.nutritionStatValue, { color: colors.carbs }]}>{Math.round(totals.carbs)}g</RNText>
        <RNText style={styles.nutritionStatLabel}>{t('dashboard.carbsLabel')}</RNText>
      </View>
      <View style={styles.nutritionStatDivider} />
      <View style={styles.nutritionStat}>
        <RNText style={[styles.nutritionStatValue, { color: colors.fat }]}>{Math.round(totals.fat)}g</RNText>
        <RNText style={styles.nutritionStatLabel}>{t('dashboard.fatLabel')}</RNText>
      </View>
    </View>
  );
}

export default function ChatLogMealScreen({ navigation, route }) {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const { t, localeCode, locale } = useLocalization();
  const { selectedDate, action, editingMeal, reparse } = route.params || {};
  const scrollViewRef = useRef(null);
  const actionHandledRef = useRef(false);
  const textInputRef = useRef(null);
  const reparseHandledRef = useRef(false);

  const [messages, setMessages] = useState([
    {
      id: Date.now(),
      role: 'ai',
      content: t('chat.intro'),
      timestamp: new Date()
    },
    {
      id: Date.now() + 1,
      role: 'ai',
      content: '',
      showRecentMealsButton: true,
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [selectedMealType, setSelectedMealType] = useState(null);
  const [recognition, setRecognition] = useState(null);
  const textBeforeVoiceRef = useRef('');
  const [isSaving, setIsSaving] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [recentMeals, setRecentMeals] = useState([]);
  const [showRecentMeals, setShowRecentMeals] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedBarcode, setScannedBarcode] = useState(null);
  const [lookingUpBarcode, setLookingUpBarcode] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [mealSaved, setMealSaved] = useState(false);
  const [mealConfirmed, setMealConfirmed] = useState(false);
  const [showAdjustmentHints, setShowAdjustmentHints] = useState(false);
  const isScanningBarcodeRef = useRef(false);
  const adjustmentExamples = [
    t('chat.adjustHintExample1'),
    t('chat.adjustHintExample2'),
    t('chat.adjustHintExample3')
  ];

  // Load recent meals on mount
  useEffect(() => {
    loadRecentMeals();
  }, []);

  // Handle reparse when editing a meal
  useEffect(() => {
    if (editingMeal && reparse && !reparseHandledRef.current) {
      reparseHandledRef.current = true;
      setTimeout(() => {
        setInputText(editingMeal.description);
        handleSendMessage(editingMeal.description);
      }, 500);
    }
  }, [editingMeal, reparse]);

  const loadRecentMeals = async () => {
    try {
      const meals = await mealService.getRecentMeals(user.uid, 10);

      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const recentFiltered = meals.filter(meal => {
        const mealDate = meal.date?.toDate ? meal.date.toDate() : new Date(meal.date);
        return mealDate >= threeDaysAgo;
      });

      const uniqueMeals = [];
      const seenDescriptions = new Set();

      for (const meal of recentFiltered) {
        const normalizedDesc = meal.description.toLowerCase().trim();
        if (!seenDescriptions.has(normalizedDesc)) {
          seenDescriptions.add(normalizedDesc);
          uniqueMeals.push(meal);
        }
      }

      setRecentMeals(uniqueMeals);
    } catch (error) {
      console.error('Error loading recent meals:', error);
    }
  };

  const handleShowRecentMeals = () => {
    if (recentMeals.length === 0) {
      showAlert(t('chat.noRecentMeals'), t('chat.noRecentMealsBody'));
      return;
    }
    setShowRecentMeals(true);
  };

  const handleSelectRecentMeal = (meal) => {
    setShowRecentMeals(false);

    addMessage('user', meal.description);
    addMessage('ai', t('chat.usingRecentMeal', { name: meal.description }));

    setParsedData({
      items: meal.items,
      totals: meal.totals
    });

    const totalCal = meal.totals.calories;
    const itemsList = meal.items.map(item =>
      `• ${item.quantity} ${item.food} (${item.calories} ${t('dashboard.calShort')})`
    ).join('\n');

    const response = t('chat.breakdownIntro', {
      items: itemsList,
      calories: totalCal,
      protein: meal.totals.protein,
      carbs: meal.totals.carbs,
      fat: meal.totals.fat
    });

    setTimeout(() => {
      addMessage('ai', response, { parsedData: { items: meal.items, totals: meal.totals } });
      setTimeout(() => {
        addMessage('ai', '', { showFeedbackSuggestions: true });
      }, 500);
    }, 500);
  };

  // Scroll to bottom when messages update
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  // Initialize speech recognition
  useEffect(() => {
    if (Platform.OS === 'web') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognitionInstance = new SpeechRecognition();
        recognitionInstance.continuous = true;
        recognitionInstance.interimResults = true;
        recognitionInstance.lang = localeCode;

        recognitionInstance.onresult = (event) => {
          let transcript = '';
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          const baseText = textBeforeVoiceRef.current;
          const separator = baseText ? ', ' : '';
          setInputText(baseText + separator + transcript);
        };

        recognitionInstance.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        recognitionInstance.onend = () => {
          setIsListening(false);
        };

        setRecognition(recognitionInstance);
      }
    } else {
      Voice.onSpeechStart = () => setIsListening(true);
      Voice.onSpeechEnd = () => setIsListening(false);
      Voice.onSpeechResults = (event) => {
        if (event.value && event.value.length > 0) {
          const transcript = event.value[0];
          const baseText = textBeforeVoiceRef.current;
          const separator = baseText ? ', ' : '';
          setInputText(baseText + separator + transcript);
        }
      };
      Voice.onSpeechError = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
    }

    return () => {
      if (Platform.OS === 'web' && recognition) {
        recognition.stop();
      } else if (Platform.OS !== 'web') {
        Voice.destroy().then(Voice.removeAllListeners).catch(console.error);
      }
    };
  }, []);

  // Handle action parameter (auto-launch camera, scanner, voice)
  useEffect(() => {
    if (action && !actionHandledRef.current) {
      actionHandledRef.current = true;
      setTimeout(() => {
        switch (action) {
          case 'type':
            textInputRef.current?.focus();
            break;
          case 'scan':
            setShowBarcodeScanner(true);
            break;
          case 'photo':
            showImageOptions();
            break;
          case 'voice':
            toggleVoiceInput();
            break;
          default:
            break;
        }
      }, 300);
    }
  }, [action]);

  const showAlert = (title, message) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const addMessage = (role, content, data = null) => {
    const newMessage = {
      id: Date.now() + Math.random(),
      role,
      content,
      timestamp: new Date(),
      data
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  };

  const countdownIntervalRef = useRef(null);

  const startCountdown = () => {
    setShowCountdown(true);
    setCountdown(3);

    countdownIntervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          setShowCountdown(false);
          startVoiceRecording();
          return 3;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const skipCountdown = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    setShowCountdown(false);
    startVoiceRecording();
  };

  const startVoiceRecording = async () => {
    if (Platform.OS === 'web') {
      if (!recognition) {
        showAlert(t('chat.notSupported'), t('chat.speechNotSupported'));
        return;
      }
      textBeforeVoiceRef.current = inputText;
      recognition.start();
      setIsListening(true);
    } else {
      try {
        textBeforeVoiceRef.current = inputText;
        await Voice.start(localeCode);
        setIsListening(true);
      } catch (error) {
        console.error('Voice error:', error);
        showAlert(t('common.error'), t('chat.voiceStartFailed'));
      }
    }
  };

  const stopVoiceRecording = async () => {
    if (Platform.OS === 'web') {
      if (recognition) {
        recognition.stop();
      }
    } else {
      try {
        await Voice.stop();
      } catch (error) {
        console.error('Error stopping voice:', error);
      }
    }
    setIsListening(false);
  };

  const toggleVoiceInput = async () => {
    if (isListening) {
      await stopVoiceRecording();
    } else {
      if (!parsedData) {
        startCountdown();
      } else {
        startVoiceRecording();
      }
    }
  };

  const pickImage = async () => {
    try {
      const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        if (canAskAgain === false) {
          if (Platform.OS === 'web') {
            window.alert(t('chat.photoPermissionWeb'));
          } else {
            Alert.alert(
              t('chat.photoLibraryPermissionTitle'),
              t('chat.photoLibraryPermissionBody'),
              [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('chat.openSettings'),
                  onPress: () => {
                    if (Platform.OS === 'ios') {
                      Linking.openURL('app-settings:');
                    } else {
                      Linking.openSettings();
                    }
                  }
                }
              ]
            );
          }
        } else {
          showAlert(t('chat.permissionRequired'), t('chat.cameraRollPermission'));
        }
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0]);
        await processImage(result.assets[0]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showAlert(t('common.error'), t('chat.pickImageFailed'));
    }
  };

  const takePhoto = async () => {
    try {
      const { status, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        if (canAskAgain === false) {
          if (Platform.OS === 'web') {
            window.alert(t('chat.cameraPermissionWeb'));
          } else {
            Alert.alert(
              t('chat.cameraPermissionTitle'),
              t('chat.cameraPermissionBody'),
              [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('chat.openSettings'),
                  onPress: () => {
                    if (Platform.OS === 'ios') {
                      Linking.openURL('app-settings:');
                    } else {
                      Linking.openSettings();
                    }
                  }
                }
              ]
            );
          }
        } else {
          showAlert(t('chat.permissionRequired'), t('chat.cameraPermission'));
        }
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0]);
        await processImage(result.assets[0]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      showAlert(t('common.error'), t('chat.takePhotoFailed'));
    }
  };

  const showImageOptions = () => {
    if (Platform.OS === 'web') {
      pickImage();
    } else {
      Alert.alert(
        t('chat.addMealPhoto'),
        t('chat.chooseOption'),
        [
          { text: t('chat.takePhoto'), onPress: takePhoto },
          { text: t('chat.chooseFromLibrary'), onPress: pickImage },
          { text: t('common.cancel'), style: 'cancel' }
        ]
      );
    }
  };

  const openBarcodeScanner = async () => {
    if (!permission) {
      return;
    }

    if (!permission.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        if (result.canAskAgain === false) {
          if (Platform.OS === 'web') {
            window.alert(t('chat.barcodePermissionWeb'));
          } else {
            Alert.alert(
              t('chat.cameraPermissionTitle'),
              t('chat.cameraPermissionBody'),
              [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('chat.openSettings'),
                  onPress: () => {
                    if (Platform.OS === 'ios') {
                      Linking.openURL('app-settings:');
                    } else {
                      Linking.openSettings();
                    }
                  }
                }
              ]
            );
          }
        } else {
          showAlert(t('chat.permissionRequired'), t('chat.barcodePermission'));
        }
        return;
      }
    }

    setScannedBarcode(null);
    setShowBarcodeScanner(true);
  };

  const closeBarcodeScanner = () => {
    setShowBarcodeScanner(false);
    setScannedBarcode(null);
    isScanningBarcodeRef.current = false;
  };

  const handleBarcodeScanned = async ({ type, data }) => {
    if (isScanningBarcodeRef.current) {
      return;
    }

    isScanningBarcodeRef.current = true;
    setScannedBarcode(data);
    setShowBarcodeScanner(false);
    setLookingUpBarcode(true);

    const tempUserMessage = addMessage('user', t('chat.barcodeScanning'));
    addMessage('ai', t('chat.lookingUpProduct'));

    try {
      const result = await lookupBarcode(data);

      setMessages(prev => prev.slice(0, -1));

      if (result.found) {
        setMessages(prev => prev.map(msg =>
          msg.id === tempUserMessage.id
            ? { ...msg, content: `${result.product.name}${result.product.brand ? ' (' + result.product.brand + ')' : ''}` }
            : msg
        ));

        const formattedProduct = formatBarcodeProductForParsing(result);

        if (formattedProduct) {
          const nutritionData = formattedProduct.nutritionData;
          const servingSize = formattedProduct.servingSize;

          const parsedResult = {
            items: [{
              food: result.product.name,
              quantity: servingSize,
              calories: Math.round(nutritionData.calories || 0),
              protein: Math.round(nutritionData.protein || 0),
              carbs: Math.round(nutritionData.carbs || 0),
              fat: Math.round(nutritionData.fat || 0)
            }],
            totals: {
              calories: Math.round(nutritionData.calories || 0),
              protein: Math.round(nutritionData.protein || 0),
              carbs: Math.round(nutritionData.carbs || 0),
              fat: Math.round(nutritionData.fat || 0)
            }
          };

          setParsedData(parsedResult);

          const response = t('chat.foundProduct', {
            name: `${result.product.name}${result.product.brand ? ' (' + result.product.brand + ')' : ''}`,
            serving: servingSize,
            calories: parsedResult.totals.calories,
            protein: parsedResult.totals.protein,
            carbs: parsedResult.totals.carbs,
            fat: parsedResult.totals.fat,
            source: result.source
          });

          addMessage('ai', response, { parsedData: parsedResult });

          setTimeout(() => {
            addMessage('ai', '', { showFeedbackSuggestions: true });
          }, 500);
        }
      } else {
        setMessages(prev => prev.map(msg =>
          msg.id === tempUserMessage.id
            ? { ...msg, content: t('chat.barcodeScanned', { code: data }) }
            : msg
        ));
        addMessage('ai', t('chat.productNotFound', { code: data }));
      }
    } catch (error) {
      console.error('Error looking up barcode:', error);
      setMessages(prev => prev.slice(0, -1));
      setMessages(prev => prev.map(msg =>
        msg.id === tempUserMessage.id
          ? { ...msg, content: t('chat.barcodeScanned', { code: data }) }
          : msg
      ));
      addMessage('ai', t('chat.lookupFailed'));
    } finally {
      setLookingUpBarcode(false);
      isScanningBarcodeRef.current = false;
    }
  };

  const processImage = async (image) => {
    setIsProcessing(true);
    const tempUserMessage = addMessage('user', t('chat.analyzingPhoto'), { imageUri: image.uri });
    addMessage('ai', t('chat.analyzingPhotoAi'));

    try {
      const base64Data = `data:image/jpeg;base64,${image.base64}`;
      setShowAdjustmentHints(false);
      const description = await convertImageToDescription(base64Data, locale || localeCode);

      setMessages(prev => prev.map(msg =>
        msg.id === tempUserMessage.id
          ? { ...msg, content: description }
          : msg
      ));

      setMessages(prev => prev.slice(0, -1));

      await parseAndRespond(description);
    } catch (error) {
      console.error('Error processing image:', error);
      setMessages(prev => prev.map(msg =>
        msg.id === tempUserMessage.id
          ? { ...msg, content: t('chat.photoMealFallback') }
          : msg
      ));
      setMessages(prev => prev.slice(0, -1));
      addMessage('ai', t('chat.analyzingFailed'));
    } finally {
      setIsProcessing(false);
      setSelectedImage(null);
    }
  };

  const parseAndRespond = async (text) => {
    setIsProcessing(true);
    setShowAdjustmentHints(false);
    addMessage('ai', t('chat.calculatingNutrition'));

    try {
      const result = await parseMealDescription(text, null, locale || localeCode);

      setMessages(prev => prev.slice(0, -1));

      const totalCal = result.totals.calories;
      const isZeroOrLowCalories = totalCal < 20;
      const hasNoItems = !result.items || result.items.length === 0;

      if (isZeroOrLowCalories || hasNoItems) {
        addMessage('ai', t('chat.lowCaloriePrompt', { text }));
        setParsedData(null);
        return;
      }

      const itemsList = result.items.map(item =>
        `• ${item.quantity} ${item.food} (${item.calories} cal)`
      ).join('\n');

      const response = t('chat.gotIt', {
        items: itemsList,
        calories: totalCal,
        protein: result.totals.protein,
        carbs: result.totals.carbs,
        fat: result.totals.fat
      });

      addMessage('ai', response, { parsedData: result });

      setTimeout(() => {
        addMessage('ai', '', { showFeedbackSuggestions: true });
      }, 500);
      setParsedData(result);
    } catch (error) {
      console.error('Error parsing meal:', error);
      setMessages(prev => prev.slice(0, -1));
      addMessage('ai', t('chat.parseFailed'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendMessage = async () => {
    if (isListening) {
      await stopVoiceRecording();
    }

    const text = inputText.trim();

    if (!text && !selectedImage) {
      return;
    }

    setInputText('');
    textBeforeVoiceRef.current = '';
    setShowAdjustmentHints(false);

    // If we already have parsed data, treat this as a refinement
    if (parsedData && text) {
      setMealConfirmed(false);

      addMessage('user', text);
      addMessage('ai', t('chat.adjustPrompt'));

      setIsProcessing(true);
      try {
        const result = await parseMealDescription(text, parsedData, locale || localeCode);

        setMessages(prev => prev.slice(0, -1));

        const totalCal = result.totals.calories;
        const itemsList = result.items.map(item =>
          `• ${item.quantity} ${item.food} (${item.calories} cal)`
        ).join('\n');

        const response = t('chat.updated', {
          items: itemsList,
          calories: totalCal,
          protein: result.totals.protein,
          carbs: result.totals.carbs,
          fat: result.totals.fat
        });

        addMessage('ai', response, { parsedData: result });

        setTimeout(() => {
          addMessage('ai', '', { showFeedbackSuggestions: true });
        }, 500);

        setParsedData(result);
      } catch (error) {
        console.error('Error refining meal:', error);
        setMessages(prev => prev.slice(0, -1));
        addMessage('ai', t('chat.rephraseAdjustment'));
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // Initial meal description
    if (text) {
      addMessage('user', text);
      await parseAndRespond(text);
    }
  };

  const handleSaveMeal = async () => {
    if (!parsedData || !selectedMealType) {
      showAlert(t('common.error'), t('chat.saveMealError'));
      return;
    }

    if (isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      const mealDate = selectedDate ? new Date(selectedDate) : new Date();
      if (selectedDate) {
        const now = new Date();
        mealDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
      }

      const userMessages = messages.filter(m => m.role === 'user' && !m.data?.imageUri);
      const description = userMessages.map(m => m.content).join(', ');

      const imageMessage = messages.find(m => m.data?.imageUri);
      const imageUri = imageMessage?.data?.imageUri || null;
      let imageUrl = null;

      if (imageUri) {
        imageUrl = await mealService.uploadMealImage(user.uid, imageUri);
      }

      const mealData = {
        mealType: selectedMealType,
        description: description || t('chat.photoMealDescription'),
        items: parsedData.items,
        totals: parsedData.totals,
        date: mealDate,
        ...(imageUrl && { imageUrl })
      };

      const mealId = await mealService.logMeal(user.uid, mealData);
      refreshUserProfile();

      addMessage('ai', t('chat.mealLogged', { mealType: getMealTypeLabelLower(selectedMealType, t) }));

      // Grade if user has profile and daily calorie target set
      if (userProfile && userProfile.dailyCalorieTarget && mealId) {
        addMessage('ai', t('chat.analyzingMeal'));
        try {
          const gradeData = await gradeMealBackend(mealId, parsedData, userProfile);
          setMessages(prev => prev.slice(0, -1));
          addMessage('ai', '', { gradeData });
        } catch (gradeError) {
          console.error('Error grading meal:', gradeError);
          setMessages(prev => prev.slice(0, -1));
        }
      }

      setMealSaved(true);
      setIsSaving(false);
    } catch (error) {
      console.error('Error saving meal:', error);
      showAlert(t('common.error'), t('chat.saveFailed'));
      setIsSaving(false);
    }
  };

  const handleStartOver = () => {
    setParsedData(null);
    setSelectedMealType(null);
    setMealConfirmed(false);
    setShowAdjustmentHints(false);
    setMessages([
      {
        id: Date.now(),
        role: 'ai',
        content: t('chat.freshStart'),
        timestamp: new Date()
      }
    ]);
  };

  const renderMessage = (message) => {
    const isUser = message.role === 'user';

    if (message.data?.imageUri) {
      return (
        <View key={message.id} style={[styles.messageContainer, styles.userMessageContainer]}>
          <View style={[styles.messageBubble, styles.userBubble, styles.imageBubble]}>
            <Image source={{ uri: message.data.imageUri }} style={styles.messageImage} />
          </View>
        </View>
      );
    }

    // Feedback suggestions (show after parsing)
    if (message.data?.showFeedbackSuggestions && parsedData && !mealSaved) {
      if (!mealConfirmed) {
        return (
          <View key={message.id} style={styles.confirmationCard}>
            <RNText style={styles.confirmationText}>{t('chat.confirmQuestion')}</RNText>
            <View style={styles.confirmationButtons}>
              <TouchableOpacity
                style={styles.editButton}
                activeOpacity={0.7}
                onPress={() => {
                  setShowAdjustmentHints(true);
                  textInputRef.current?.focus();
                }}
              >
                <RNText style={styles.editButtonLabel}>{t('chat.makeChanges')}</RNText>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.confirmButtonWrap}
                onPress={() => {
                  setMealConfirmed(true);
                  setShowAdjustmentHints(false);
                }}
              >
                <LinearGradient
                  colors={gradients.brand}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.confirmButton}
                >
                  <Icon source="check" size={18} color="#FFFFFF" />
                  <RNText style={styles.confirmButtonLabel}>{t('chat.looksGood')}</RNText>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        );
      }
      return null;
    }

    // Recent meals button (hide if meal already parsed)
    if (message.showRecentMealsButton && !parsedData) {
      return (
        <View key={message.id} style={[styles.messageContainer, styles.aiMessageContainer]}>
          <TouchableOpacity
            style={styles.recentMealsButton}
            activeOpacity={0.7}
            onPress={handleShowRecentMeals}
          >
            <Icon source="history" size={18} color={colors.primary} />
            <RNText style={styles.recentMealsButtonLabel}>{t('chat.viewRecentMeals')}</RNText>
          </TouchableOpacity>
        </View>
      );
    }

    // Meal grade card
    if (message.data?.gradeData) {
      return (
        <View key={message.id} style={styles.gradeCardContainer}>
          <MealGradeCard gradeData={message.data.gradeData} />
        </View>
      );
    }

    if (!message.content || message.content.trim() === '') {
      return null;
    }

    // Helper to render text with markdown bold
    const renderFormattedText = (text) => {
      const parts = [];
      const regex = /\*\*(.*?)\*\*/g;
      let lastIndex = 0;
      let match;

      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          parts.push({ text: text.substring(lastIndex, match.index), bold: false });
        }
        parts.push({ text: match[1], bold: true });
        lastIndex = regex.lastIndex;
      }

      if (lastIndex < text.length) {
        parts.push({ text: text.substring(lastIndex), bold: false });
      }

      return parts.map((part, index) => (
        <Text
          key={index}
          style={[
            styles.messageText,
            isUser ? styles.userMessageText : styles.aiMessageText,
            part.bold && styles.boldText
          ]}
        >
          {part.text}
        </Text>
      ));
    };

    return (
      <View key={message.id} style={[
        styles.messageContainer,
        isUser ? styles.userMessageContainer : styles.aiMessageContainer
      ]}>
        <View style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.aiBubble
        ]}>
          <Text style={[
            styles.messageText,
            isUser ? styles.userMessageText : styles.aiMessageText
          ]}>
            {renderFormattedText(message.content)}
          </Text>
        </View>
        {message.data?.parsedData?.totals && (
          <NutritionStrip totals={message.data.parsedData.totals} t={t} />
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* Countdown Modal */}
      {showCountdown && (
        <TouchableOpacity
          style={styles.countdownOverlay}
          onPress={skipCountdown}
          activeOpacity={1}
        >
          <View style={styles.countdownContent}>
            <RNText style={styles.countdownNumber}>{countdown}</RNText>
            <RNText style={styles.countdownTitle}>{t('chat.getReady')}</RNText>
            <RNText style={styles.countdownSuggestion}>{t('chat.trySaying')}</RNText>
            <RNText style={styles.countdownSkipHint}>{t('chat.tapToSkip')}</RNText>
          </View>
        </TouchableOpacity>
      )}

      {/* Barcode Scanner Modal */}
      <Modal
        visible={showBarcodeScanner}
        animationType="slide"
        onRequestClose={closeBarcodeScanner}
      >
        <View style={styles.barcodeContainer}>
          <CameraView
            style={styles.barcodeCamera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr', 'code_128', 'code_39']
            }}
            onBarcodeScanned={scannedBarcode ? undefined : handleBarcodeScanned}
          >
            <View style={styles.barcodeOverlay}>
              <View style={styles.barcodeHeader}>
                <IconButton
                  icon="close"
                  iconColor="#FFFFFF"
                  size={28}
                  onPress={closeBarcodeScanner}
                  style={styles.closeButton}
                />
              </View>

              <View style={styles.barcodeScanArea}>
                <View style={styles.scanFrame}>
                  <View style={[styles.scanCorner, styles.scanCornerTopLeft]} />
                  <View style={[styles.scanCorner, styles.scanCornerTopRight]} />
                  <View style={[styles.scanCorner, styles.scanCornerBottomLeft]} />
                  <View style={[styles.scanCorner, styles.scanCornerBottomRight]} />
                </View>
              </View>

              <View style={styles.barcodeInstructions}>
                <RNText style={styles.barcodeTitle}>{t('chat.scanBarcodeTitle')}</RNText>
                <RNText style={styles.barcodeSubtitle}>{t('chat.scanBarcodeSubtitle')}</RNText>
              </View>
            </View>
          </CameraView>
        </View>
      </Modal>

      {/* Date Indicator */}
      {selectedDate && (
        <View style={styles.dateIndicatorRow}>
          <View style={styles.dateIndicator}>
            <Icon source="calendar-outline" size={15} color={colors.primaryDark} />
            <RNText style={styles.dateIndicatorText}>
              {(() => {
                const date = new Date(selectedDate);
                const today = new Date();
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);

                if (date.toDateString() === today.toDateString()) {
                  return t('chat.addMealToday');
                } else if (date.toDateString() === yesterday.toDateString()) {
                  return t('chat.addMealYesterday');
                } else {
                  return t('chat.addMealDate', {
                    date: date.toLocaleDateString(localeCode, { month: 'short', day: 'numeric', year: 'numeric' })
                  });
                }
              })()}
            </RNText>
          </View>
        </View>
      )}

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.map(renderMessage)}

        {isProcessing && (
          <View style={[styles.messageContainer, styles.aiMessageContainer]}>
            <View style={[styles.messageBubble, styles.aiBubble]}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          </View>
        )}

        {/* Recent Meals list */}
        {showRecentMeals && (
          <View style={styles.recentMealsContainer}>
            <View style={[styles.messageContainer, styles.aiMessageContainer]}>
              <View style={[styles.messageBubble, styles.aiBubble]}>
                <Text style={styles.aiMessageText}>{t('chat.pickRecentMeal')}</Text>
              </View>
            </View>
            {recentMeals.slice(0, 5).map((meal) => {
              const mealDate = meal.date?.toDate ? meal.date.toDate() : new Date(meal.date);
              const daysAgo = Math.floor((new Date() - mealDate) / (1000 * 60 * 60 * 24));
              const timeLabel = daysAgo === 0
                ? t('chat.today')
                : daysAgo === 1
                ? t('chat.yesterday')
                : t('social.daysAgo', { count: daysAgo });

              return (
                <TouchableOpacity
                  key={meal.id}
                  onPress={() => handleSelectRecentMeal(meal)}
                  style={styles.recentMealCard}
                  activeOpacity={0.7}
                >
                  <View style={styles.recentMealInfo}>
                    <RNText style={styles.recentMealTitle} numberOfLines={1}>
                      {meal.description}
                    </RNText>
                    <RNText style={styles.recentMealMeta}>
                      {t('chat.recentCalories', { calories: meal.totals.calories, time: timeLabel })}
                    </RNText>
                  </View>
                  <Icon source="chevron-right" size={20} color={colors.faint} />
                </TouchableOpacity>
              );
            })}
            <Button
              mode="text"
              textColor={colors.muted}
              onPress={() => setShowRecentMeals(false)}
              style={styles.cancelRecentButton}
            >
              {t('common.cancel')}
            </Button>
          </View>
        )}

        {/* Meal Type Selector - shows when we have parsed data AND meal is confirmed */}
        {parsedData && !mealSaved && mealConfirmed && (
          <View style={styles.mealTypeContainer}>
            <RNText style={styles.mealTypeTitle}>{t('chat.selectMealType')}</RNText>
            <View style={styles.mealTypeGrid}>
              {MEAL_TYPES.map((mealType) => {
                const selected = selectedMealType === mealType;
                return (
                  <TouchableOpacity
                    key={mealType}
                    style={[styles.mealTypeOption, selected && styles.mealTypeOptionSelected]}
                    onPress={() => setSelectedMealType(mealType)}
                    activeOpacity={0.7}
                  >
                    <Icon
                      source={MEAL_TYPE_ICONS[mealType]}
                      size={20}
                      color={selected ? colors.primary : colors.faint}
                    />
                    <RNText style={[styles.mealTypeLabel, selected && styles.mealTypeLabelSelected]}>
                      {getMealTypeLabel(mealType, t)}
                    </RNText>
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedMealType && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.startOverButton}
                  onPress={handleStartOver}
                  activeOpacity={0.7}
                >
                  <RNText style={styles.startOverLabel}>{t('chat.startOver')}</RNText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButtonWrap}
                  onPress={handleSaveMeal}
                  disabled={isSaving}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={gradients.brand}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.saveButton, isSaving && { opacity: 0.6 }]}
                  >
                    {isSaving
                      ? <ActivityIndicator size="small" color="#FFFFFF" />
                      : <Icon source="check-circle-outline" size={18} color="#FFFFFF" />}
                    <RNText style={styles.saveButtonLabel}>
                      {isSaving ? t('chat.saving') : t('chat.saveMeal')}
                    </RNText>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Done Button - shows after meal is saved */}
        {mealSaved && (
          <TouchableOpacity
            style={styles.doneContainer}
            activeOpacity={0.85}
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('Dashboard', { screen: 'DashboardMain' });
              }
            }}
          >
            <LinearGradient
              colors={gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.doneButton}
            >
              <Icon source="check" size={20} color="#FFFFFF" />
              <RNText style={styles.doneButtonLabel}>{t('chat.done')}</RNText>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Input Bar */}
      <View style={styles.inputContainer}>
        {/* Plus Menu */}
        {showPlusMenu && (
          <View style={styles.plusMenuContainer}>
            <TouchableOpacity
              style={styles.plusMenuItem}
              onPress={() => {
                setShowPlusMenu(false);
                showImageOptions();
              }}
            >
              <View style={styles.plusMenuIconWrap}>
                <Icon source="camera-outline" size={20} color={colors.primary} />
              </View>
              <RNText style={styles.plusMenuText}>{t('chat.camera')}</RNText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.plusMenuItem}
              onPress={() => {
                setShowPlusMenu(false);
                openBarcodeScanner();
              }}
            >
              <View style={styles.plusMenuIconWrap}>
                <Icon source="barcode-scan" size={20} color={colors.primary} />
              </View>
              <RNText style={styles.plusMenuText}>{t('chat.scanBarcode')}</RNText>
            </TouchableOpacity>
          </View>
        )}

        {showAdjustmentHints && parsedData && !mealSaved && (
          <View style={styles.feedbackSuggestionsCard}>
            <RNText style={styles.feedbackTitle}>{t('chat.adjustHintTitle')}</RNText>
            <View style={styles.feedbackExamplesCompact}>
              {adjustmentExamples.map((example, index) => (
                <TouchableOpacity
                  key={`${example}-${index}`}
                  style={styles.feedbackChipCompact}
                  onPress={() => {
                    setInputText(example);
                    textInputRef.current?.focus();
                  }}
                >
                  <RNText style={styles.feedbackChipTitleCompact}>{example}</RNText>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.inputRow}>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={() => setShowPlusMenu(!showPlusMenu)}
            disabled={isProcessing}
            activeOpacity={0.7}
          >
            <Icon source={showPlusMenu ? 'close' : 'plus'} size={22} color={colors.primary} />
          </TouchableOpacity>

          <TextInput
            ref={textInputRef}
            mode="outlined"
            placeholder={parsedData ? t('chat.improveMeal') : t('chat.describeMeal')}
            value={inputText}
            onChangeText={setInputText}
            style={styles.textInput}
            outlineStyle={styles.textInputOutline}
            multiline
            maxLength={500}
            disabled={isProcessing}
            onSubmitEditing={handleSendMessage}
          />

          <TouchableOpacity
            style={styles.sendButtonWrap}
            onPress={inputText.trim() ? handleSendMessage : toggleVoiceInput}
            disabled={isProcessing}
            activeOpacity={0.85}
          >
            {isListening ? (
              <View style={[styles.sendButton, { backgroundColor: colors.danger }]}>
                <Icon source="stop" size={20} color="#FFFFFF" />
              </View>
            ) : (
              <LinearGradient
                colors={gradients.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sendButton}
              >
                <Icon
                  source={inputText.trim() ? 'send' : 'microphone'}
                  size={20}
                  color="#FFFFFF"
                />
              </LinearGradient>
            )}
          </TouchableOpacity>
        </View>

        {isListening && (
          <View style={styles.listeningIndicator}>
            <View style={styles.listeningDot} />
            <RNText style={styles.listeningText}>{t('chat.listening')}</RNText>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  dateIndicatorRow: {
    alignItems: 'center',
    paddingTop: 10
  },
  dateIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.tint,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.tintBorder
  },
  dateIndicatorText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryDark
  },
  messagesContainer: {
    flex: 1
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 24
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: '85%'
  },
  userMessageContainer: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end'
  },
  aiMessageContainer: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start'
  },
  messageBubble: {
    borderRadius: 18,
    padding: 12,
    paddingHorizontal: 16
  },
  imageBubble: {
    padding: 4
  },
  userBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 6
  },
  aiBubble: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21
  },
  userMessageText: {
    color: '#FFFFFF'
  },
  aiMessageText: {
    color: colors.ink
  },
  boldText: {
    fontWeight: '800',
    color: colors.primaryDark
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 14
  },
  nutritionStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignSelf: 'stretch'
  },
  nutritionStat: {
    flex: 1,
    alignItems: 'center'
  },
  nutritionStatDivider: {
    width: 1,
    height: 22,
    backgroundColor: colors.border
  },
  nutritionStatValue: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.3
  },
  nutritionStatLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.faint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 1
  },
  // Meal type selector
  mealTypeContainer: {
    marginTop: 12,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    ...shadows.card
  },
  mealTypeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 12
  },
  mealTypeGrid: {
    flexDirection: 'row',
    gap: 8
  },
  mealTypeOption: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: radius.md,
    backgroundColor: colors.subtle,
    borderWidth: 1.5,
    borderColor: 'transparent'
  },
  mealTypeOptionSelected: {
    backgroundColor: colors.tint,
    borderColor: colors.primary
  },
  mealTypeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted
  },
  mealTypeLabelSelected: {
    color: colors.primaryDark,
    fontWeight: '700'
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16
  },
  startOverButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border
  },
  startOverLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.muted
  },
  saveButtonWrap: {
    flex: 1.4
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: radius.pill,
    ...shadows.glow
  },
  saveButtonLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  },
  doneContainer: {
    padding: 20,
    alignItems: 'center'
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: radius.pill,
    ...shadows.glow
  },
  doneButtonLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700'
  },
  // Input bar
  inputContainer: {
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    position: 'relative'
  },
  plusMenuContainer: {
    position: 'absolute',
    bottom: '100%',
    left: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 6,
    marginBottom: 8,
    minWidth: 200,
    ...shadows.raised
  },
  plusMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14
  },
  plusMenuIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center'
  },
  plusMenuText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center'
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: colors.subtle,
    fontSize: 15
  },
  textInputOutline: {
    borderRadius: 22,
    borderColor: colors.border
  },
  sendButtonWrap: {},
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.glow
  },
  listeningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8
  },
  listeningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
    marginRight: 8
  },
  listeningText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600'
  },
  // Countdown overlay
  countdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5, 150, 105, 0.97)',
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center'
  },
  countdownContent: {
    alignItems: 'center',
    padding: 40
  },
  countdownNumber: {
    fontSize: 120,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 20
  },
  countdownTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16
  },
  countdownSuggestion: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 20
  },
  countdownSkipHint: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    fontStyle: 'italic'
  },
  // Recent meals
  recentMealsContainer: {
    marginVertical: 12
  },
  recentMealsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.tintBorder,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 18
  },
  recentMealsButtonLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary
  },
  recentMealCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 8,
    ...shadows.card
  },
  recentMealInfo: {
    flex: 1,
    marginRight: 8
  },
  recentMealTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
    marginBottom: 3
  },
  recentMealMeta: {
    fontSize: 12,
    color: colors.muted
  },
  cancelRecentButton: {
    alignSelf: 'center',
    marginTop: 8
  },
  gradeCardContainer: {
    width: '100%',
    marginBottom: 12
  },
  // Confirmation card
  confirmationCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 16,
    ...shadows.card
  },
  confirmationText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 12,
    textAlign: 'center'
  },
  confirmationButtons: {
    flexDirection: 'row',
    gap: 10
  },
  editButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border
  },
  editButtonLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.muted
  },
  confirmButtonWrap: {
    flex: 1.3
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.pill,
    ...shadows.glow
  },
  confirmButtonLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  },
  // Adjustment hints
  feedbackSuggestionsCard: {
    backgroundColor: colors.subtle,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border
  },
  feedbackTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
    marginBottom: 8,
    lineHeight: 18
  },
  feedbackExamplesCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  feedbackChipCompact: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.border
  },
  feedbackChipTitleCompact: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink
  },
  // Barcode scanner
  barcodeContainer: {
    flex: 1,
    backgroundColor: '#000000'
  },
  barcodeCamera: {
    flex: 1
  },
  barcodeOverlay: {
    flex: 1,
    backgroundColor: 'transparent'
  },
  barcodeHeader: {
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.3)'
  },
  closeButton: {
    margin: 0
  },
  barcodeScanArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  scanFrame: {
    width: 280,
    height: 180,
    position: 'relative'
  },
  scanCorner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#10B981',
    borderWidth: 4
  },
  scanCornerTopLeft: {
    top: 0,
    left: 0,
    borderBottomWidth: 0,
    borderRightWidth: 0
  },
  scanCornerTopRight: {
    top: 0,
    right: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0
  },
  scanCornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderTopWidth: 0,
    borderRightWidth: 0
  },
  scanCornerBottomRight: {
    bottom: 0,
    right: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0
  },
  barcodeInstructions: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center'
  },
  barcodeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center'
  },
  barcodeSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 22
  }
});
