import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform, Image, KeyboardAvoidingView, TouchableOpacity, Modal, Linking } from 'react-native';
import { TextInput, Button, Text, IconButton, ActivityIndicator, Card, Chip, Surface } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Voice from '@react-native-voice/voice';
import { parseMealDescription, convertImageToDescription, gradeMealBackend } from '../../services/geminiService';
import { mealService } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { lookupBarcode, formatBarcodeProductForParsing } from '../../services/barcodeService';
import MealGradeCard from '../../components/MealGradeCard';
import { useLocalization, getMealTypeLabel, getMealTypeLabelLower } from '../../localization/i18n';

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

// Message types: 'user', 'ai', 'system', 'loading'
// AI messages can have parsedData attached

export default function ChatLogMealScreen({ navigation, route }) {
  const { user, userProfile } = useAuth();
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

      // Auto-submit the edited description for re-parsing
      setTimeout(() => {
        setInputText(editingMeal.description);
        handleSendMessage(editingMeal.description);
      }, 500);
    }
  }, [editingMeal, reparse]);

  const loadRecentMeals = async () => {
    try {
      const meals = await mealService.getRecentMeals(user.uid, 10);

      // Filter to last 3 days
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const recentFiltered = meals.filter(meal => {
        const mealDate = meal.date?.toDate ? meal.date.toDate() : new Date(meal.date);
        return mealDate >= threeDaysAgo;
      });

      // Remove duplicates by description (keep most recent)
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

    // Add user message with the meal description so it gets saved correctly
    addMessage('user', meal.description);

    // Use the selected meal's data
    addMessage('ai', t('chat.usingRecentMeal', { name: meal.description }));

    setParsedData({
      items: meal.items,
      totals: meal.totals
    });

    // Show the nutrition breakdown
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

      // Add confirmation prompt for recent meals
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
      }, 300); // Small delay to let the screen render
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
      // Only countdown on initial recording (no parsed data yet)
      if (!parsedData) {
        startCountdown();
      } else {
        // Feedback mode - no countdown, direct recording
        startVoiceRecording();
      }
    }
  };

  const pickImage = async () => {
    try {
      const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        if (canAskAgain === false) {
          // Permission permanently denied
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
          // Permission permanently denied
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
        // Check if they can ask again or if it was permanently denied
        if (result.canAskAgain === false) {
          // Permission was permanently denied - guide them to Settings
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
          // Permission was just denied this time
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
    // Prevent multiple scans using ref (immediate check)
    if (isScanningBarcodeRef.current) {
      console.log('⚠️ Barcode scan already in progress, ignoring duplicate');
      return;
    }

    isScanningBarcodeRef.current = true;
    setScannedBarcode(data);
    setShowBarcodeScanner(false);
    setLookingUpBarcode(true);

    // Store barcode ID temporarily
    const tempUserMessage = addMessage('user', t('chat.barcodeScanning'));
    addMessage('ai', t('chat.lookingUpProduct'));

    try {
      // Look up the barcode in multiple databases
      const result = await lookupBarcode(data);

      // Remove the "looking up" message
      setMessages(prev => prev.slice(0, -1));

      if (result.found) {
        // Update the user message with the product name
        setMessages(prev => prev.map(msg =>
          msg.id === tempUserMessage.id
            ? { ...msg, content: `${result.product.name}${result.product.brand ? ' (' + result.product.brand + ')' : ''}` }
            : msg
        ));

        const formattedProduct = formatBarcodeProductForParsing(result);

        if (formattedProduct) {
          const nutritionData = formattedProduct.nutritionData;
          const servingSize = formattedProduct.servingSize;

          // Create parsed data structure
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

          // Add confirmation prompt for barcode scans
          setTimeout(() => {
            addMessage('ai', '', { showFeedbackSuggestions: true });
          }, 500);
        }
      } else {
        // Update the user message with barcode if product not found
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
      // Update the user message with barcode if error
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

      // Update the user message with the actual description
      setMessages(prev => prev.map(msg =>
        msg.id === tempUserMessage.id
          ? { ...msg, content: description }
          : msg
      ));

      // Remove the "analyzing" message
      setMessages(prev => prev.slice(0, -1));

      // Process the description automatically
      await parseAndRespond(description);
    } catch (error) {
      console.error('Error processing image:', error);
      // Update the user message to show it was a photo even if processing failed
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
    console.log('🔍 [ChatLogMeal] parseAndRespond called with text:', text);
    setIsProcessing(true);
    setShowAdjustmentHints(false);
    addMessage('ai', t('chat.calculatingNutrition'));

    try {
      console.log('🤖 [ChatLogMeal] Calling parseMealDescription API');
      const result = await parseMealDescription(text, null, locale || localeCode);
      console.log('✅ [ChatLogMeal] Parse result:', JSON.stringify(result, null, 2));

      // Remove the "calculating" message
      setMessages(prev => prev.slice(0, -1));

      // Check if result has zero or very low calories (< 20)
      const totalCal = result.totals.calories;
      const isZeroOrLowCalories = totalCal < 20;

      // Check if items array is empty or has no recognizable food
      const hasNoItems = !result.items || result.items.length === 0;

      if (isZeroOrLowCalories || hasNoItems) {
        console.log('⚠️ [ChatLogMeal] Zero/low calories or no items detected');
        // Show error message and ask user to clarify
        addMessage('ai', t('chat.lowCaloriePrompt', { text }));
        setParsedData(null); // Clear any existing parsed data
        console.log('⚠️ [ChatLogMeal] User prompted to provide clearer description');
        return; // Exit early, don't save zero-calorie meal
      }

      // Create a friendly response
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

      // Add explicit feedback prompt with examples
      setTimeout(() => {
        addMessage('ai', '', { showFeedbackSuggestions: true });
      }, 500);
      setParsedData(result);
      console.log('✅ [ChatLogMeal] Parse and respond complete');
    } catch (error) {
      console.error('❌ [ChatLogMeal] Error parsing meal:', error);
      console.error('❌ [ChatLogMeal] Error details:', error.message, error.stack);
      setMessages(prev => prev.slice(0, -1));
      addMessage('ai', t('chat.parseFailed'));
    } finally {
      setIsProcessing(false);
      console.log('🏁 [ChatLogMeal] parseAndRespond finished');
    }
  };

  const handleSendMessage = async () => {
    console.log('🚀 [ChatLogMeal] handleSendMessage called');

    // Stop recording if it's active
    if (isListening) {
      console.log('🎤 [ChatLogMeal] Stopping voice recording');
      await stopVoiceRecording();
    }

    const text = inputText.trim();
    console.log('📝 [ChatLogMeal] Input text:', text);
    console.log('🖼️ [ChatLogMeal] Selected image:', !!selectedImage);

    if (!text && !selectedImage) {
      console.log('⚠️ [ChatLogMeal] No text or image, returning early');
      return;
    }

    // Clear input immediately
    setInputText('');
    textBeforeVoiceRef.current = '';
    setShowAdjustmentHints(false);
    console.log('🧹 [ChatLogMeal] Input cleared');

    // If we already have parsed data, treat this as a refinement
    if (parsedData && text) {
      console.log('🔄 [ChatLogMeal] Refining existing parsed data');
      console.log('📊 [ChatLogMeal] Current parsed data:', parsedData);

      // Reset confirmation since we're making changes
      setMealConfirmed(false);

      addMessage('user', text);

      // AI acknowledges the refinement
      addMessage('ai', t('chat.adjustPrompt'));

      setIsProcessing(true);
      try {
        console.log('🤖 [ChatLogMeal] Calling parseMealDescription for refinement');
        // Re-parse with the feedback AND existing data context
        const result = await parseMealDescription(text, parsedData, locale || localeCode);
        console.log('✅ [ChatLogMeal] Refinement result:', result);

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

        // Add feedback prompt again
        setTimeout(() => {
          addMessage('ai', '', { showFeedbackSuggestions: true });
        }, 500);

        setParsedData(result);
      } catch (error) {
        console.error('❌ [ChatLogMeal] Error refining meal:', error);
        setMessages(prev => prev.slice(0, -1));
        addMessage('ai', t('chat.rephraseAdjustment'));
      } finally {
        setIsProcessing(false);
        console.log('✅ [ChatLogMeal] Refinement complete');
      }
      return;
    }

    // Initial meal description
    if (text) {
      console.log('📝 [ChatLogMeal] Processing initial meal description');
      addMessage('user', text);
      await parseAndRespond(text);
    }
  };

  const handleSaveMeal = async () => {
    console.log('💾 [ChatLogMeal] handleSaveMeal called');
    console.log('📊 [ChatLogMeal] Parsed data:', parsedData);
    console.log('🍽️ [ChatLogMeal] Selected meal type:', selectedMealType);

    if (!parsedData || !selectedMealType) {
      console.log('⚠️ [ChatLogMeal] Missing parsedData or selectedMealType');
      showAlert(t('common.error'), t('chat.saveMealError'));
      return;
    }

    // Prevent duplicate saves
    if (isSaving) {
      console.log('⚠️ [ChatLogMeal] Already saving, preventing duplicate');
      return;
    }

    setIsSaving(true);
    console.log('🔄 [ChatLogMeal] Starting save process');

    try {
      const mealDate = selectedDate ? new Date(selectedDate) : new Date();
      if (selectedDate) {
        const now = new Date();
        mealDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
      }
      console.log('📅 [ChatLogMeal] Meal date:', mealDate);

      // Get the original description from messages
      const userMessages = messages.filter(m => m.role === 'user' && !m.data?.imageUri);
      const description = userMessages.map(m => m.content).join(', ');
      console.log('📝 [ChatLogMeal] Meal description:', description);

      // Check if there's an image in the messages
      const imageMessage = messages.find(m => m.data?.imageUri);
      const imageUri = imageMessage?.data?.imageUri || null;
      console.log('🖼️ [ChatLogMeal] Image URI:', imageUri);
      let imageUrl = null;

      if (imageUri) {
        console.log('☁️ [ChatLogMeal] Uploading meal image');
        imageUrl = await mealService.uploadMealImage(user.uid, imageUri);
        console.log('✅ [ChatLogMeal] Image upload result:', imageUrl ? 'uploaded' : 'missing');
      }

      const mealData = {
        mealType: selectedMealType,
        description: description || t('chat.photoMealDescription'),
        items: parsedData.items,
        totals: parsedData.totals,
        date: mealDate,
        ...(imageUrl && { imageUrl }) // Add image URL if available
      };
      console.log('📦 [ChatLogMeal] Meal data to save:', JSON.stringify(mealData, null, 2));

      console.log('🔥 [ChatLogMeal] Calling mealService.logMeal');
      const mealId = await mealService.logMeal(user.uid, mealData);
      console.log('✅ [ChatLogMeal] Meal saved successfully with ID:', mealId);

      addMessage('ai', t('chat.mealLogged', { mealType: getMealTypeLabelLower(selectedMealType, t) }));

      // Grade the meal using backend based on user's goals
      console.log('🔍 [ChatLogMeal] Checking grading conditions:');
      console.log('  - userProfile exists:', !!userProfile);
      console.log('  - onboardingCompleted:', userProfile?.onboardingCompleted);
      console.log('  - mealId:', mealId);
      console.log('  - dailyCalorieTarget:', userProfile?.dailyCalorieTarget);

      // Grade if user has profile and daily calorie target set
      if (userProfile && userProfile.dailyCalorieTarget && mealId) {
        console.log('🎯 [ChatLogMeal] Grading meal via backend');
        addMessage('ai', t('chat.analyzingMeal'));
        try {
          const gradeData = await gradeMealBackend(mealId, parsedData, userProfile);
          console.log('📊 [ChatLogMeal] Meal grade from backend:', gradeData);
          // Remove the "analyzing" message
          setMessages(prev => prev.slice(0, -1));
          addMessage('ai', '', { gradeData });
        } catch (gradeError) {
          console.error('❌ [ChatLogMeal] Error grading meal:', gradeError);
          // Remove the "analyzing" message on error too
          setMessages(prev => prev.slice(0, -1));
        }
      } else {
        console.log('⚠️ [ChatLogMeal] Skipping grading - conditions not met');
      }

      // Show "Done" button instead of auto-redirect
      setMealSaved(true);
      setIsSaving(false);
      console.log('✅ [ChatLogMeal] Save process complete');
    } catch (error) {
      console.error('❌ [ChatLogMeal] Error saving meal:', error);
      console.error('❌ [ChatLogMeal] Error details:', error.message, error.stack);
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
    const isAI = message.role === 'ai';

    if (message.data?.imageUri) {
      return (
        <View key={message.id} style={[styles.messageContainer, styles.userMessageContainer]}>
          <Surface style={[styles.messageBubble, styles.userBubble]}>
            <Image source={{ uri: message.data.imageUri }} style={styles.messageImage} />
          </Surface>
        </View>
      );
    }

    // Feedback suggestions (show after parsing)
    if (message.data?.showFeedbackSuggestions && parsedData && !mealSaved) {
      // Show confirmation button if meal not yet confirmed
      if (!mealConfirmed) {
        return (
          <View key={message.id} style={styles.feedbackSuggestionsContainer}>
            <Surface style={styles.confirmationCard} elevation={1}>
              <Text style={styles.confirmationText}>{t('chat.confirmQuestion')}</Text>
              <View style={styles.confirmationButtons}>
                <Button
                  mode="outlined"
                  onPress={() => {
                    // User wants to make changes - focus on input
                    setShowAdjustmentHints(true);
                    textInputRef.current?.focus();
                  }}
                  style={styles.editButton}
                  contentStyle={styles.buttonContent}
                  textColor="#6366F1"
                >
                  {t('chat.makeChanges')}
                </Button>
                <Button
                  mode="contained"
                  onPress={() => {
                    setMealConfirmed(true);
                    setShowAdjustmentHints(false);
                  }}
                  style={styles.confirmButton}
                  contentStyle={styles.buttonContent}
                  buttonColor="#6366F1"
                >
                  {t('chat.looksGood')}
                </Button>
              </View>
            </Surface>
          </View>
        );
      }

      // Show compact edit options after confirmation (optional - can be removed if you want)
      return null;
    }

    // Recent meals button (hide if meal already parsed)
    if (message.showRecentMealsButton && !parsedData) {
      return (
        <View key={message.id} style={[styles.messageContainer, styles.aiMessageContainer]}>
            <Surface style={[styles.messageBubble, styles.aiBubble]}>
              <Button
                mode="outlined"
                icon="clock-outline"
                onPress={handleShowRecentMeals}
                style={styles.recentMealsButtonInChat}
                contentStyle={styles.recentMealsButtonContent}
              >
                {t('chat.viewRecentMeals')}
              </Button>
            </Surface>
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

    // Don't render empty messages (messages with no content and no special data)
    if (!message.content || message.content.trim() === '') {
      return null;
    }

    // Helper to render text with markdown bold
    const renderFormattedText = (text) => {
      // Split by **bold** patterns
      const parts = [];
      const regex = /\*\*(.*?)\*\*/g;
      let lastIndex = 0;
      let match;

      while ((match = regex.exec(text)) !== null) {
        // Add text before the match
        if (match.index > lastIndex) {
          parts.push({
            text: text.substring(lastIndex, match.index),
            bold: false
          });
        }
        // Add the bold text
        parts.push({
          text: match[1],
          bold: true
        });
        lastIndex = regex.lastIndex;
      }

      // Add remaining text
      if (lastIndex < text.length) {
        parts.push({
          text: text.substring(lastIndex),
          bold: false
        });
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
        <Surface style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.aiBubble
        ]}>
          <Text style={[
            styles.messageText,
            isUser ? styles.userMessageText : styles.aiMessageText
          ]}>
            {renderFormattedText(message.content)}
          </Text>
        </Surface>
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
            <Text style={styles.countdownNumber}>{countdown}</Text>
            <Text style={styles.countdownTitle}>{t('chat.getReady')}</Text>
            <Text style={styles.countdownSuggestion}>
              {t('chat.trySaying')}
            </Text>
            <Text style={styles.countdownSkipHint}>
              {t('chat.tapToSkip')}
            </Text>
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
                <Text style={styles.barcodeTitle}>{t('chat.scanBarcodeTitle')}</Text>
                <Text style={styles.barcodeSubtitle}>
                  {t('chat.scanBarcodeSubtitle')}
                </Text>
              </View>
            </View>
          </CameraView>
        </View>
      </Modal>

      {/* Date Indicator */}
      {selectedDate && (
        <View style={styles.dateIndicator}>
          <Text style={styles.dateIndicatorText}>
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
          </Text>
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
            <Surface style={[styles.messageBubble, styles.aiBubble]}>
              <ActivityIndicator size="small" color="#6366F1" />
            </Surface>
          </View>
        )}

        {/* Recent Meals Bubbles */}
        {showRecentMeals && (
          <View style={styles.recentMealsContainer}>
            <View style={[styles.messageContainer, styles.aiMessageContainer]}>
              <Surface style={[styles.messageBubble, styles.aiBubble]}>
                <Text style={styles.aiMessageText}>
                  {t('chat.pickRecentMeal')}
                </Text>
              </Surface>
            </View>
            {recentMeals.slice(0, 5).map((meal, index) => {
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
                  style={[styles.messageContainer, styles.aiMessageContainer]}
                >
                  <Surface style={[styles.messageBubble, styles.recentMealBubble]}>
                    <Text style={styles.recentMealTitle}>
                      {meal.description.substring(0, 50)}{meal.description.length > 50 ? '...' : ''}
                    </Text>
                    <Text style={styles.recentMealMeta}>
                      {t('chat.recentCalories', { calories: meal.totals.calories, time: timeLabel })}
                    </Text>
                  </Surface>
                </TouchableOpacity>
              );
            })}
            <Button
              mode="text"
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
            <Text style={styles.mealTypeTitle}>{t('chat.selectMealType')}</Text>
            <View style={styles.chipContainer}>
              {MEAL_TYPES.map((type) => (
                <Chip
                  key={type}
                  selected={selectedMealType === type}
                  onPress={() => setSelectedMealType(type)}
                  mode={selectedMealType === type ? 'flat' : 'outlined'}
                  selectedColor={selectedMealType === type ? '#FFFFFF' : '#6366F1'}
                  style={[
                    styles.chip,
                    selectedMealType === type && styles.chipSelected
                  ]}
                >
                  {getMealTypeLabel(type, t)}
                </Chip>
              ))}
            </View>

            {selectedMealType && (
              <View style={styles.actionButtons}>
                <Button
                  mode="outlined"
                  onPress={handleStartOver}
                  style={styles.startOverButton}
                  textColor="#64748B"
                >
                  {t('chat.startOver')}
                </Button>
                <Button
                  mode="contained"
                  onPress={handleSaveMeal}
                  style={styles.saveButton}
                  icon="check-circle"
                  loading={isSaving}
                  disabled={isSaving}
                >
                  {isSaving ? t('chat.saving') : t('chat.saveMeal')}
                </Button>
              </View>
            )}
          </View>
        )}

        {/* Done Button - shows after meal is saved */}
        {mealSaved && (
          <View style={styles.doneContainer}>
            <Button
              mode="contained"
              onPress={() => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  navigation.navigate('Dashboard', { screen: 'DashboardMain' });
                }
              }}
              style={styles.doneButton}
              icon="check"
            >
              {t('chat.done')}
            </Button>
          </View>
        )}
      </ScrollView>

      {/* Input Bar */}
      <Surface style={styles.inputContainer} elevation={4}>
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
              <IconButton icon="camera" size={24} iconColor="#6366F1" />
              <Text style={styles.plusMenuText}>{t('chat.camera')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.plusMenuItem}
              onPress={() => {
                setShowPlusMenu(false);
                openBarcodeScanner();
              }}
            >
              <IconButton icon="barcode-scan" size={24} iconColor="#6366F1" />
              <Text style={styles.plusMenuText}>{t('chat.scanBarcode')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {showAdjustmentHints && parsedData && !mealSaved && (
          <Surface style={styles.feedbackSuggestionsCard} elevation={0}>
            <Text style={styles.feedbackTitle}>{t('chat.adjustHintTitle')}</Text>
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
                  <Text style={styles.feedbackChipTitleCompact}>{example}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Surface>
        )}

        <View style={styles.inputRow}>
          <IconButton
            icon={showPlusMenu ? "close" : "plus-circle"}
            size={26}
            iconColor="#6366F1"
            onPress={() => setShowPlusMenu(!showPlusMenu)}
            disabled={isProcessing}
          />

          <TextInput
            ref={textInputRef}
            mode="outlined"
            placeholder={parsedData ? t('chat.improveMeal') : t('chat.describeMeal')}
            value={inputText}
            onChangeText={setInputText}
            style={styles.textInput}
            multiline
            maxLength={500}
            disabled={isProcessing}
            onSubmitEditing={handleSendMessage}
          />

          <IconButton
            icon={inputText.trim() ? 'send' : (isListening ? 'microphone' : 'microphone-outline')}
            size={24}
            iconColor={isListening ? '#EF4444' : '#6366F1'}
            onPress={inputText.trim() ? handleSendMessage : toggleVoiceInput}
            disabled={isProcessing}
          />
        </View>

        {isListening && (
          <View style={styles.listeningIndicator}>
            <View style={styles.listeningDot} />
            <Text style={styles.listeningText}>{t('chat.listening')}</Text>
          </View>
        )}
      </Surface>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9'
  },
  dateIndicator: {
    backgroundColor: '#EEF2FF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#C7D2FE',
    alignItems: 'center'
  },
  dateIndicatorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4338CA'
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
    maxWidth: '80%'
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
    borderRadius: 20,
    padding: 12,
    paddingHorizontal: 16,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.06)',
      },
    }),
  },
  userBubble: {
    backgroundColor: '#6366F1',
    borderBottomRightRadius: 4
  },
  aiBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20
  },
  userMessageText: {
    color: '#FFFFFF'
  },
  aiMessageText: {
    color: '#1E293B'
  },
  boldText: {
    fontWeight: '800',
    fontSize: 17,
    color: '#6366F1'
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 12
  },
  mealTypeContainer: {
    marginTop: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.06)',
      },
    }),
  },
  mealTypeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 10
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12
  },
  chip: {
    marginRight: 8,
    marginBottom: 8
  },
  chipSelected: {
    backgroundColor: '#6366F1'
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12
  },
  startOverButton: {
    flex: 1,
    borderColor: '#CBD5E1'
  },
  saveButton: {
    flex: 1
  },
  doneContainer: {
    padding: 20,
    alignItems: 'center'
  },
  doneButton: {
    paddingVertical: 8,
    paddingHorizontal: 32
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    position: 'relative'
  },
  plusMenuContainer: {
    position: 'absolute',
    bottom: '100%',
    left: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 8,
    marginBottom: 8,
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.15)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5
      }
    })
  },
  plusMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 180
  },
  plusMenuText: {
    fontSize: 16,
    color: '#1E293B',
    marginLeft: 8
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: '#F8FAFC',
    fontSize: 15
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
    backgroundColor: '#EF4444',
    marginRight: 8
  },
  listeningText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600'
  },
  countdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(99, 102, 241, 0.98)',
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
  recentMealsContainer: {
    marginVertical: 12
  },
  recentMealBubble: {
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#6366F1',
    borderBottomLeftRadius: 4
  },
  recentMealTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4
  },
  recentMealMeta: {
    fontSize: 13,
    color: '#64748B'
  },
  cancelRecentButton: {
    alignSelf: 'center',
    marginTop: 12
  },
  recentMealsButtonInChat: {
    borderColor: '#6366F1',
    marginTop: 4
  },
  recentMealsButtonContent: {
    paddingVertical: 4
  },
  gradeCardContainer: {
    width: '100%',
    paddingHorizontal: 0,
    marginBottom: 12
  },
  // Feedback Suggestions Styles
  feedbackSuggestionsContainer: {
    width: '100%',
    marginBottom: 16
  },
  feedbackSuggestionsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  feedbackTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
    lineHeight: 18
  },
  feedbackExamplesCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  feedbackChipCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  feedbackChipIconCompact: {
    margin: 0,
    marginRight: 2
  },
  feedbackChipTitleCompact: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E293B'
  },
  // Confirmation Card Styles
  confirmationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  confirmationText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
    textAlign: 'center'
  },
  confirmationButtons: {
    flexDirection: 'row',
    gap: 12
  },
  editButton: {
    flex: 1,
    borderColor: '#CBD5E1'
  },
  confirmButton: {
    flex: 1
  },
  buttonContent: {
    paddingVertical: 4
  },
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
    borderColor: '#6366F1',
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
