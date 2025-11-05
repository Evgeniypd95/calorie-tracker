import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform, Image, KeyboardAvoidingView, TouchableOpacity } from 'react-native';
import { TextInput, Button, Text, IconButton, ActivityIndicator, Card, Chip, Surface } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import Voice from '@react-native-voice/voice';
import { parseMealDescription, convertImageToDescription } from '../../services/geminiService';
import { mealService } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

// Message types: 'user', 'ai', 'system', 'loading'
// AI messages can have parsedData attached

export default function ChatLogMealScreen({ navigation, route }) {
  const { user } = useAuth();
  const { selectedDate } = route.params || {};
  const scrollViewRef = useRef(null);

  const [messages, setMessages] = useState([
    {
      id: Date.now(),
      role: 'ai',
      content: "Hey! 👋 Just tell me what you ate and I'll figure out the nutrition for you. You can type, speak, or send a photo!",
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

  // Load recent meals on mount
  useEffect(() => {
    loadRecentMeals();
  }, []);

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

      setRecentMeals(recentFiltered);

      // Update initial message if we have recent meals
      if (recentFiltered.length > 0) {
        const mealsList = recentFiltered.slice(0, 5).map((meal, idx) => {
          const mealDate = meal.date?.toDate ? meal.date.toDate() : new Date(meal.date);
          const daysAgo = Math.floor((new Date() - mealDate) / (1000 * 60 * 60 * 24));
          const timeLabel = daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo}d ago`;
          return `${idx + 1}. ${meal.description.substring(0, 40)}${meal.description.length > 40 ? '...' : ''} (${timeLabel})`;
        }).join('\n');

        setMessages([
          {
            id: Date.now(),
            role: 'ai',
            content: `Hey! 👋 What did you eat?\n\nOr pick from your recent meals:\n${mealsList}\n\nJust tell me the number or describe something new!`,
            timestamp: new Date()
          }
        ]);
      }
    } catch (error) {
      console.error('Error loading recent meals:', error);
    }
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
        recognitionInstance.lang = 'en-US';

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

  const startCountdown = () => {
    setShowCountdown(true);
    setCountdown(3);

    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          setShowCountdown(false);
          startVoiceRecording();
          return 3;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startVoiceRecording = async () => {
    if (Platform.OS === 'web') {
      if (!recognition) {
        showAlert('Not Supported', 'Speech recognition is not supported in this browser.');
        return;
      }
      textBeforeVoiceRef.current = inputText;
      recognition.start();
      setIsListening(true);
    } else {
      try {
        textBeforeVoiceRef.current = inputText;
        await Voice.start('en-US');
        setIsListening(true);
      } catch (error) {
        console.error('Voice error:', error);
        showAlert('Error', 'Failed to start voice recognition.');
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
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Required', 'We need camera roll permissions to upload meal photos.');
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
      showAlert('Error', 'Failed to pick image.');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Required', 'We need camera permissions to take meal photos.');
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
      showAlert('Error', 'Failed to take photo.');
    }
  };

  const showImageOptions = () => {
    if (Platform.OS === 'web') {
      pickImage();
    } else {
      Alert.alert(
        'Add Meal Photo',
        'Choose an option',
        [
          { text: 'Take Photo', onPress: takePhoto },
          { text: 'Choose from Library', onPress: pickImage },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  };

  const processImage = async (image) => {
    setIsProcessing(true);
    addMessage('user', '📷 [Photo of meal]', { imageUri: image.uri });
    addMessage('ai', '🔍 Let me analyze that photo...');

    try {
      const base64Data = `data:image/jpeg;base64,${image.base64}`;
      const description = await convertImageToDescription(base64Data);

      // Remove the "analyzing" message
      setMessages(prev => prev.slice(0, -1));

      // Process the description automatically
      await parseAndRespond(description);
    } catch (error) {
      console.error('Error processing image:', error);
      setMessages(prev => prev.slice(0, -1));
      addMessage('ai', "Hmm, I couldn't analyze that photo. Could you describe it for me instead?");
    } finally {
      setIsProcessing(false);
      setSelectedImage(null);
    }
  };

  const parseAndRespond = async (text) => {
    setIsProcessing(true);
    addMessage('ai', '🤔 Let me calculate the nutrition...');

    try {
      const result = await parseMealDescription(text);

      // Remove the "calculating" message
      setMessages(prev => prev.slice(0, -1));

      // Create a friendly response
      const totalCal = result.totals.calories;
      const itemsList = result.items.map(item =>
        `• ${item.quantity} ${item.food} (${item.calories} cal)`
      ).join('\n');

      const response = `Got it! 🍽️ Here's what I found:\n\n${itemsList}\n\nTotal: **${totalCal} calories**\nProtein: ${result.totals.protein}g | Carbs: ${result.totals.carbs}g | Fat: ${result.totals.fat}g\n\nDoes this look right? You can tell me what to adjust, or if it looks good, just pick a meal type below and we'll save it!`;

      addMessage('ai', response, { parsedData: result });
      setParsedData(result);
    } catch (error) {
      console.error('Error parsing:', error);
      setMessages(prev => prev.slice(0, -1));
      addMessage('ai', "Oops, I had trouble with that. Could you try describing it differently?");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendMessage = async () => {
    // Stop recording if it's active
    if (isListening) {
      await stopVoiceRecording();
    }

    const text = inputText.trim();
    if (!text && !selectedImage) return;

    // Clear input immediately
    setInputText('');
    textBeforeVoiceRef.current = '';

    // If we already have parsed data, treat this as a refinement
    if (parsedData && text) {
      addMessage('user', text);

      // AI acknowledges the refinement
      addMessage('ai', "👍 Let me adjust that for you...");

      setIsProcessing(true);
      try {
        // Re-parse with the feedback
        const result = await parseMealDescription(text);

        setMessages(prev => prev.slice(0, -1));

        const totalCal = result.totals.calories;
        const itemsList = result.items.map(item =>
          `• ${item.quantity} ${item.food} (${item.calories} cal)`
        ).join('\n');

        const response = `Updated! ✨\n\n${itemsList}\n\nTotal: **${totalCal} calories**\nProtein: ${result.totals.protein}g | Carbs: ${result.totals.carbs}g | Fat: ${result.totals.fat}g\n\nLooking better?`;

        addMessage('ai', response, { parsedData: result });
        setParsedData(result);
      } catch (error) {
        console.error('Error refining:', error);
        setMessages(prev => prev.slice(0, -1));
        addMessage('ai', "Hmm, could you rephrase that adjustment?");
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // Initial meal description
    if (text) {
      addMessage('user', text);

      // Check if user typed a number (selecting recent meal)
      const mealIndex = parseInt(text);
      if (!isNaN(mealIndex) && mealIndex >= 1 && mealIndex <= recentMeals.length) {
        const selectedMeal = recentMeals[mealIndex - 1];

        // Use the selected meal's data
        addMessage('ai', `Great choice! Using "${selectedMeal.description}"`);

        setParsedData({
          items: selectedMeal.items,
          totals: selectedMeal.totals
        });

        // Show the nutrition breakdown
        const totalCal = selectedMeal.totals.calories;
        const itemsList = selectedMeal.items.map(item =>
          `• ${item.quantity} ${item.food} (${item.calories} cal)`
        ).join('\n');

        const response = `Here's the breakdown:\n\n${itemsList}\n\nTotal: **${totalCal} calories**\nProtein: ${selectedMeal.totals.protein}g | Carbs: ${selectedMeal.totals.carbs}g | Fat: ${selectedMeal.totals.fat}g\n\nPick a meal type below to save it!`;

        setTimeout(() => {
          addMessage('ai', response, { parsedData: { items: selectedMeal.items, totals: selectedMeal.totals } });
        }, 500);
      } else {
        // New meal description
        await parseAndRespond(text);
      }
    }
  };

  const handleSaveMeal = async () => {
    if (!parsedData || !selectedMealType) {
      showAlert('Error', 'Please select a meal type first!');
      return;
    }

    // Prevent duplicate saves
    if (isSaving) return;

    setIsSaving(true);

    try {
      const mealDate = selectedDate ? new Date(selectedDate) : new Date();
      if (selectedDate) {
        const now = new Date();
        mealDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
      }

      // Get the original description from messages
      const userMessages = messages.filter(m => m.role === 'user' && !m.data?.imageUri);
      const description = userMessages.map(m => m.content).join(', ');

      await mealService.logMeal(user.uid, {
        mealType: selectedMealType,
        description: description || 'Meal from photo',
        items: parsedData.items,
        totals: parsedData.totals,
        date: mealDate
      });

      addMessage('ai', `Perfect! Your ${selectedMealType.toLowerCase()} has been logged. Keep up the great work! 💪`);

      setTimeout(() => {
        // Navigate back to Dashboard stack
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate('Dashboard', { screen: 'DashboardMain' });
        }
      }, 1500);
    } catch (error) {
      console.error('Error saving meal:', error);
      showAlert('Error', 'Failed to save meal');
      setIsSaving(false);
    }
  };

  const handleStartOver = () => {
    setParsedData(null);
    setSelectedMealType(null);
    setMessages([
      {
        id: Date.now(),
        role: 'ai',
        content: "No problem! Let's start fresh. What did you eat? 🍽️",
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
            {message.content}
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
        <View style={styles.countdownOverlay}>
          <View style={styles.countdownContent}>
            <Text style={styles.countdownNumber}>{countdown}</Text>
            <Text style={styles.countdownTitle}>Get ready!</Text>
            <Text style={styles.countdownSuggestion}>
              Try saying: "I just had a..."
            </Text>
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
            <Surface style={[styles.messageBubble, styles.aiBubble]}>
              <ActivityIndicator size="small" color="#6366F1" />
            </Surface>
          </View>
        )}

        {/* Meal Type Selector - shows when we have parsed data */}
        {parsedData && (
          <View style={styles.mealTypeContainer}>
            <Text style={styles.mealTypeTitle}>Pick a meal type:</Text>
            <View style={styles.chipContainer}>
              {MEAL_TYPES.map((type) => (
                <Chip
                  key={type}
                  selected={selectedMealType === type}
                  onPress={() => setSelectedMealType(type)}
                  style={styles.chip}
                  mode={selectedMealType === type ? 'flat' : 'outlined'}
                  selectedColor={selectedMealType === type ? '#FFFFFF' : '#6366F1'}
                  style={[
                    styles.chip,
                    selectedMealType === type && styles.chipSelected
                  ]}
                >
                  {type}
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
                  Start Over
                </Button>
                <Button
                  mode="contained"
                  onPress={handleSaveMeal}
                  style={styles.saveButton}
                  icon="check-circle"
                  loading={isSaving}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Meal'}
                </Button>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Input Bar */}
      <Surface style={styles.inputContainer} elevation={4}>
        <View style={styles.inputRow}>
          <IconButton
            icon="camera"
            size={24}
            iconColor="#6366F1"
            onPress={showImageOptions}
            disabled={isProcessing}
          />

          <TextInput
            mode="outlined"
            placeholder={parsedData ? "Want to adjust something?" : "Describe your meal..."}
            value={inputText}
            onChangeText={setInputText}
            style={styles.textInput}
            multiline
            maxLength={500}
            disabled={isProcessing}
            onSubmitEditing={handleSendMessage}
          />

          <IconButton
            icon={isListening ? 'microphone' : 'microphone-outline'}
            size={24}
            iconColor={isListening ? '#EF4444' : '#6366F1'}
            onPress={toggleVoiceInput}
            disabled={isProcessing}
          />

          <IconButton
            icon="send"
            size={24}
            iconColor="#6366F1"
            onPress={handleSendMessage}
            disabled={!inputText.trim() || isProcessing}
          />
        </View>

        {isListening && (
          <View style={styles.listeningIndicator}>
            <View style={styles.listeningDot} />
            <Text style={styles.listeningText}>Listening...</Text>
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
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 12
  },
  mealTypeContainer: {
    marginTop: 20,
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 12px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  mealTypeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16
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
  inputContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0'
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
    lineHeight: 26
  }
});
