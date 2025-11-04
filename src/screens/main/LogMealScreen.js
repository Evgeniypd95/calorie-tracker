import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity, Platform, Image } from 'react-native';
import { TextInput, Button, Text, Chip, ActivityIndicator, Card, Searchbar, Divider, IconButton } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import Voice from '@react-native-voice/voice';
import { parseMealDescription, convertImageToDescription } from '../../services/geminiService';
import { mealService } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

export default function LogMealScreen({ navigation, route }) {
  const { user } = useAuth();
  const { selectedDate } = route.params || {};
  const [selectedMealType, setSelectedMealType] = useState(null);
  const [mealDescription, setMealDescription] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recentMeals, setRecentMeals] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [processingImage, setProcessingImage] = useState(false);
  const textBeforeVoiceRef = useRef('');
  const [feedback, setFeedback] = useState('');
  const [isFeedbackVoiceListening, setIsFeedbackVoiceListening] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [originalDescription, setOriginalDescription] = useState('');
  const feedbackTextBeforeVoiceRef = useRef('');
  const voiceContextRef = useRef('meal'); // 'meal' or 'feedback'

  // Load recent meals on mount
  useEffect(() => {
    loadRecentMeals();
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if (Platform.OS === 'web') {
      // Web: Use browser's Speech Recognition API
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

          // Check which context we're in
          if (voiceContextRef.current === 'feedback') {
            // Feedback context
            const baseText = feedbackTextBeforeVoiceRef.current;
            const separator = baseText ? ', ' : '';
            setFeedback(baseText + separator + transcript);
          } else {
            // Meal description context
            const baseText = textBeforeVoiceRef.current;
            const separator = baseText ? ', ' : '';
            setMealDescription(baseText + separator + transcript);
          }
        };

        recognitionInstance.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
          setIsFeedbackVoiceListening(false);
          if (event.error === 'not-allowed') {
            showAlert('Error', 'Microphone access denied. Please enable microphone permissions.');
          } else if (event.error === 'no-speech') {
            showAlert('Info', 'No speech detected. Please try again.');
          }
        };

        recognitionInstance.onend = () => {
          if (voiceContextRef.current === 'feedback') {
            setIsFeedbackVoiceListening(false);
          } else {
            setIsListening(false);
          }
        };

        setRecognition(recognitionInstance);
      }
    } else {
      // Mobile: Use react-native-voice - just set up event handlers
      Voice.onSpeechStart = () => {
        console.log('Speech started');
        if (voiceContextRef.current === 'feedback') {
          setIsFeedbackVoiceListening(true);
        } else {
          setIsListening(true);
        }
      };

      Voice.onSpeechEnd = () => {
        console.log('Speech ended');
        if (voiceContextRef.current === 'feedback') {
          setIsFeedbackVoiceListening(false);
        } else {
          setIsListening(false);
        }
      };

      Voice.onSpeechResults = (event) => {
        if (event.value && event.value.length > 0) {
          const transcript = event.value[0];
          console.log('Speech results:', transcript);

          // Check which context we're in
          if (voiceContextRef.current === 'feedback') {
            // Feedback context
            const baseText = feedbackTextBeforeVoiceRef.current;
            const separator = baseText ? ', ' : '';
            setFeedback(baseText + separator + transcript);
          } else {
            // Meal description context
            const baseText = textBeforeVoiceRef.current;
            const separator = baseText ? ', ' : '';
            setMealDescription(baseText + separator + transcript);
          }
        }
      };

      Voice.onSpeechError = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        setIsFeedbackVoiceListening(false);
        if (event.error?.message?.includes('Missing permissions') ||
            event.error?.message?.includes('privacy-sensitive')) {
          showAlert('Permission Required', 'Please grant microphone and speech recognition permissions in Settings.');
        } else {
          showAlert('Error', 'Voice recognition failed. Please try again.');
        }
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

  const loadRecentMeals = async () => {
    try {
      const meals = await mealService.getRecentMeals(user.uid, 5);
      setRecentMeals(meals);
    } catch (error) {
      console.error('Error loading recent meals:', error);
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.trim()) {
      try {
        const results = await mealService.searchMealsByDescription(user.uid, query);
        setSearchResults(results);
      } catch (error) {
        console.error('Error searching meals:', error);
      }
    } else {
      setSearchResults([]);
    }
  };

  const handleSelectMeal = (meal) => {
    setMealDescription(meal.description);
    setParsedData({
      items: meal.items,
      totals: meal.totals
    });
    setSearchQuery('');
    setSearchResults([]);
  };

  const showAlert = (title, message) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const toggleVoiceInput = async () => {
    if (Platform.OS === 'web') {
      // Web: Use browser's Speech Recognition API
      if (!recognition) {
        showAlert('Not Supported', 'Speech recognition is not supported in this browser. Try Chrome or Edge.');
        return;
      }

      if (isListening) {
        recognition.stop();
        setIsListening(false);
      } else {
        // Save current text before starting voice
        textBeforeVoiceRef.current = mealDescription;
        voiceContextRef.current = 'meal';
        recognition.start();
        setIsListening(true);
      }
    } else {
      // Mobile: Use react-native-voice
      try {
        if (isListening) {
          await Voice.stop();
          setIsListening(false);
        } else {
          // Save current text before starting voice
          textBeforeVoiceRef.current = mealDescription;
          voiceContextRef.current = 'meal';
          await Voice.start('en-US');
          setIsListening(true);
        }
      } catch (error) {
        console.error('Error toggling voice input:', error);
        showAlert('Error', 'Failed to start voice recognition. Please try again.');
      }
    }
  };

  const toggleFeedbackVoice = async () => {
    if (Platform.OS === 'web') {
      // Web: Use browser's Speech Recognition API
      if (!recognition) {
        showAlert('Not Supported', 'Speech recognition is not supported in this browser. Try Chrome or Edge.');
        return;
      }

      if (isFeedbackVoiceListening) {
        recognition.stop();
        setIsFeedbackVoiceListening(false);
      } else {
        // Save current feedback text before starting voice
        feedbackTextBeforeVoiceRef.current = feedback;
        voiceContextRef.current = 'feedback';
        recognition.start();
        setIsFeedbackVoiceListening(true);
      }
    } else {
      // Mobile: Use react-native-voice
      try {
        if (isFeedbackVoiceListening) {
          await Voice.stop();
          setIsFeedbackVoiceListening(false);
        } else {
          // Save current feedback text before starting voice
          feedbackTextBeforeVoiceRef.current = feedback;
          voiceContextRef.current = 'feedback';
          await Voice.start('en-US');
          setIsFeedbackVoiceListening(true);
        }
      } catch (error) {
        console.error('Error toggling feedback voice input:', error);
        showAlert('Error', 'Failed to start voice recognition. Please try again.');
      }
    }
  };

  const pickImage = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Required', 'Sorry, we need camera roll permissions to upload meal photos.');
        return;
      }

      // Launch image picker
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
      showAlert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const takePhoto = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Required', 'Sorry, we need camera permissions to take meal photos.');
        return;
      }

      // Launch camera
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
      showAlert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const processImage = async (image) => {
    setProcessingImage(true);
    try {
      const base64Data = `data:image/jpeg;base64,${image.base64}`;
      const description = await convertImageToDescription(base64Data);
      setMealDescription(description);
      showAlert('Success', 'Image analyzed! You can edit the description before parsing.');
    } catch (error) {
      console.error('Error processing image:', error);
      showAlert('Error', 'Failed to analyze image. Please try again or enter manually.');
      setSelectedImage(null);
    } finally {
      setProcessingImage(false);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
  };

  const showImageOptions = () => {
    if (Platform.OS === 'web') {
      // On web, just pick from library
      pickImage();
    } else {
      // On mobile, show action sheet
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

  const handleParse = async () => {
    if (!mealDescription.trim()) {
      showAlert('Error', 'Please describe what you ate');
      return;
    }

    setLoading(true);
    try {
      const result = await parseMealDescription(mealDescription);
      setParsedData(result);
      setOriginalDescription(mealDescription); // Save original for feedback
      setFeedback(''); // Clear any previous feedback
    } catch (error) {
      showAlert('Error', 'Failed to parse meal. Please try rephrasing.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleImprove = async () => {
    if (!feedback.trim()) {
      showAlert('Error', 'Please provide feedback on what to improve');
      return;
    }

    setIsImproving(true);
    try {
      // Combine original description with feedback
      const improvedPrompt = `${originalDescription}\n\nAdditional info: ${feedback}`;
      const result = await parseMealDescription(improvedPrompt);
      setParsedData(result);
      setFeedback(''); // Clear feedback after successful improvement
    } catch (error) {
      showAlert('Error', 'Failed to improve meal. Please try again.');
      console.error(error);
    } finally {
      setIsImproving(false);
    }
  };

  const handleStartOver = () => {
    setParsedData(null);
    setMealDescription('');
    setOriginalDescription('');
    setFeedback('');
    setSelectedImage(null);
  };

  const handleDeleteItem = (index) => {
    const newItems = parsedData.items.filter((_, i) => i !== index);

    // Recalculate totals
    const newTotals = newItems.reduce((acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
      carbs: acc.carbs + item.carbs,
      fat: acc.fat + item.fat
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    setParsedData({
      items: newItems,
      totals: newTotals
    });
  };


  const handleSave = async () => {
    if (!parsedData) return;

    if (!selectedMealType) {
      showAlert('Error', 'Please select a meal type');
      return;
    }

    try {
      // Use the selected date from the dashboard, or default to now
      const mealDate = selectedDate ? new Date(selectedDate) : new Date();

      // Preserve the current time but set the date to the selected day
      if (selectedDate) {
        const now = new Date();
        mealDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
      }

      await mealService.logMeal(user.uid, {
        mealType: selectedMealType,
        description: mealDescription,
        items: parsedData.items,
        totals: parsedData.totals,
        date: mealDate
      });

      showAlert('Success', 'Meal logged successfully!');
      navigation.goBack();
    } catch (error) {
      showAlert('Error', 'Failed to save meal');
      console.error(error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>
        Log a Meal
      </Text>

      {!parsedData && (
        <>
          {/* Search Bar */}
          <Searchbar
            placeholder="Search previous meals..."
            onChangeText={handleSearch}
            value={searchQuery}
            style={styles.searchBar}
          />

          {/* Search Results or Recent Meals */}
          {searchQuery.trim() ? (
        searchResults.length > 0 ? (
          <View style={styles.mealsSection}>
            <Text variant="labelLarge" style={styles.sectionLabel}>Search Results</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mealsScroll}>
              {searchResults.map((meal) => (
                <TouchableOpacity
                  key={meal.id}
                  onPress={() => handleSelectMeal(meal)}
                  style={styles.mealChip}
                >
                  <Card style={styles.mealCard}>
                    <Card.Content style={styles.mealCardContent}>
                      <Text variant="titleSmall" style={styles.mealTitle} numberOfLines={2}>
                        {meal.description}
                      </Text>
                      <Text variant="bodySmall" style={styles.mealCalories}>
                        {meal.totals?.calories} cal
                      </Text>
                    </Card.Content>
                  </Card>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Divider style={styles.divider} />
          </View>
        ) : (
          <View style={styles.noResults}>
            <Text variant="bodySmall" style={styles.noResultsText}>No meals found</Text>
          </View>
        )
      ) : recentMeals.length > 0 ? (
        <View style={styles.mealsSection}>
          <Text variant="labelLarge" style={styles.sectionLabel}>Recent Meals</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mealsScroll}>
            {recentMeals.map((meal) => (
              <TouchableOpacity
                key={meal.id}
                onPress={() => handleSelectMeal(meal)}
                style={styles.mealChip}
              >
                <Card style={styles.mealCard}>
                  <Card.Content style={styles.mealCardContent}>
                    <Text variant="titleSmall" style={styles.mealTitle} numberOfLines={2}>
                      {meal.description}
                    </Text>
                    <Text variant="bodySmall" style={styles.mealCalories}>
                      {meal.totals?.calories} cal
                    </Text>
                  </Card.Content>
                </Card>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Divider style={styles.divider} />
        </View>
      ) : null}

          {/* Image Preview */}
      {selectedImage && (
        <Card style={styles.imagePreviewCard}>
          <Card.Content style={styles.imagePreviewContent}>
            <Image source={{ uri: selectedImage.uri }} style={styles.imagePreview} />
            <IconButton
              icon="close-circle"
              size={28}
              iconColor="#EF4444"
              style={styles.removeImageButton}
              onPress={removeImage}
            />
          </Card.Content>
        </Card>
      )}

      {processingImage && (
      <Card style={styles.processingCard}>
        <Card.Content style={styles.processingContent}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text variant="bodyMedium" style={styles.processingText}>
            Analyzing your meal photo...
          </Text>
        </Card.Content>
      </Card>
      )}

      {/* Meal Description */}
      <View style={styles.inputContainer}>
        <View style={styles.inputHeader}>
          <Text variant="labelMedium" style={styles.inputLabel}>
            Describe your meal
          </Text>
          <View style={styles.inputIcons}>
            <IconButton
              icon="camera"
              size={24}
              iconColor="#6366F1"
              onPress={showImageOptions}
              style={styles.iconButton}
            />
            <IconButton
              icon={isListening ? 'microphone' : 'microphone-outline'}
              size={24}
              iconColor={isListening ? '#EF4444' : '#6366F1'}
              onPress={toggleVoiceInput}
              style={styles.iconButton}
            />
          </View>
        </View>
        <TextInput
          label=""
          value={mealDescription}
          onChangeText={setMealDescription}
          mode="outlined"
          multiline
          numberOfLines={4}
          placeholder="Type, speak, or take a photo of your meal"
          style={styles.input}
        />
        {isListening && (
          <Chip
            icon="microphone-off"
            onPress={toggleVoiceInput}
            style={styles.stopChip}
            textStyle={styles.stopChipText}
            accessibilityLabel="Stop recording"
          >
            Stop recording
          </Chip>
        )}
        {isListening && (
          <Text variant="bodySmall" style={styles.listeningText}>
            🎤 Listening... Tap mic to stop
          </Text>
        )}
      </View>

          <Button
            mode="contained"
            onPress={handleParse}
            loading={loading}
            disabled={loading || isListening || !mealDescription.trim()}
            style={styles.button}
          >
            Parse with AI
          </Button>
        </>
      )}

      {/* Parsed Results */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>AI is analyzing your meal...</Text>
        </View>
      )}

      {parsedData && (
        <Card style={styles.resultsCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.resultsTitle}>
              Nutrition Breakdown
            </Text>

            {parsedData.items.map((item, index) => (
              <View key={index} style={styles.foodItem}>
                <View style={styles.foodItemHeader}>
                  <View style={styles.foodItemLeft}>
                    <Text variant="bodyLarge" style={styles.foodName}>
                      {item.quantity} {item.food}
                    </Text>
                  </View>
                  <IconButton
                    icon="delete"
                    size={20}
                    iconColor="#EF4444"
                    onPress={() => handleDeleteItem(index)}
                    style={styles.deleteItemButton}
                  />
                </View>
                <Text variant="bodySmall" style={styles.foodStats}>
                  {item.calories} cal | P: {item.protein}g | C: {item.carbs}g | F: {item.fat}g
                </Text>
              </View>
            ))}

            <View style={styles.totals}>
              <Text variant="titleMedium">Total</Text>
              <Text variant="bodyLarge" style={styles.totalCalories}>
                {parsedData.totals.calories} calories
              </Text>
              <Text variant="bodyMedium">
                Protein: {parsedData.totals.protein}g | Carbs: {parsedData.totals.carbs}g | Fat: {parsedData.totals.fat}g
              </Text>
            </View>

            {/* Feedback Section */}
            <View style={styles.feedbackSection}>
              <Text variant="labelLarge" style={styles.feedbackLabel}>
                Not quite right?
              </Text>
              <View style={styles.feedbackInputContainer}>
                <View style={styles.feedbackInputHeader}>
                  <Text variant="bodySmall" style={styles.feedbackHelp}>
                    Tell us what to improve (e.g., "Add 100g rice", "Chicken was 200g")
                  </Text>
                  <IconButton
                    icon={isFeedbackVoiceListening ? 'microphone' : 'microphone-outline'}
                    size={20}
                    iconColor={isFeedbackVoiceListening ? '#EF4444' : '#6366F1'}
                    onPress={toggleFeedbackVoice}
                    style={styles.feedbackIconButton}
                  />
                </View>
                <TextInput
                  label=""
                  value={feedback}
                  onChangeText={setFeedback}
                  mode="outlined"
                  multiline
                  numberOfLines={2}
                  placeholder="What needs to be corrected?"
                  style={styles.feedbackInput}
                />
                {isFeedbackVoiceListening && (
                  <Text variant="bodySmall" style={styles.listeningText}>
                    🎤 Listening... Tap mic to stop
                  </Text>
                )}
              </View>
              <Button
                mode="outlined"
                onPress={handleImprove}
                loading={isImproving}
                disabled={isImproving || !feedback.trim()}
                style={styles.improveButton}
              >
                Improve
              </Button>
            </View>

            {/* Meal Type Selector */}
            <View style={styles.mealTypeSection}>
              <Text variant="labelLarge" style={styles.mealTypeLabel}>
                Meal Type *
              </Text>
              <View style={styles.chipContainer}>
                {MEAL_TYPES.map((type) => (
                  <Chip
                    key={type}
                    selected={selectedMealType === type}
                    onPress={() => setSelectedMealType(type)}
                    style={styles.chip}
                  >
                    {type}
                  </Chip>
                ))}
              </View>
              {!selectedMealType && (
                <Text variant="bodySmall" style={styles.requiredText}>
                  Please select a meal type
                </Text>
              )}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <Button
                mode="outlined"
                onPress={handleStartOver}
                style={styles.startOverButton}
              >
                Start Over
              </Button>
              <Button
                mode="contained"
                onPress={handleSave}
                style={styles.saveButton}
                icon="check"
                disabled={!selectedMealType}
              >
                Looks Correct
              </Button>
            </View>
          </Card.Content>
        </Card>
      )}

      {isImproving && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>AI is improving your meal breakdown...</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F1F5F9'
  },
  title: {
    marginBottom: 24,
    fontWeight: '700',
    fontSize: 28,
    color: '#1E293B',
    letterSpacing: -0.8
  },
  searchBar: {
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.06)',
      },
    }),
  },
  mealsSection: {
    marginBottom: 20
  },
  sectionLabel: {
    marginBottom: 12,
    color: '#64748B',
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  mealTypeLabel: {
    marginBottom: 12,
    color: '#1E293B',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: -0.3
  },
  requiredText: {
    color: '#EF4444',
    marginTop: -8,
    marginBottom: 20,
    fontSize: 13
  },
  mealsScroll: {
    marginBottom: 12
  },
  mealChip: {
    marginRight: 12
  },
  mealCard: {
    width: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.06)',
      },
    }),
  },
  mealCardContent: {
    padding: 14
  },
  mealTitle: {
    fontWeight: '700',
    marginBottom: 6,
    color: '#1E293B',
    fontSize: 15
  },
  mealCalories: {
    color: '#6366F1',
    fontWeight: '700',
    fontSize: 14
  },
  divider: {
    marginTop: 12,
    marginBottom: 12
  },
  noResults: {
    padding: 20,
    alignItems: 'center'
  },
  noResultsText: {
    color: '#94A3B8',
    fontSize: 14
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    gap: 8
  },
  chip: {
    marginRight: 8,
    marginBottom: 8
  },
  inputContainer: {
    marginBottom: 20
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  inputLabel: {
    color: '#1E293B',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: -0.3
  },
  inputIcons: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  iconButton: {
    margin: 0
  },
  stopChip: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
    borderWidth: 1,
    marginTop: 8
  },
  stopChipText: {
    color: '#EF4444',
    fontWeight: '600'
  },
  input: {
    marginBottom: 8,
    backgroundColor: '#FFFFFF'
  },
  listeningText: {
    color: '#EF4444',
    marginBottom: 12,
    marginTop: 8,
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 13
  },
  imagePreviewCard: {
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 12px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  imagePreviewContent: {
    position: 'relative',
    padding: 0
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 0
  },
  removeImageButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20
  },
  processingCard: {
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.06)',
      },
    }),
  },
  processingContent: {
    alignItems: 'center',
    paddingVertical: 40
  },
  processingText: {
    marginTop: 20,
    color: '#64748B',
    fontSize: 15
  },
  button: {
    marginBottom: 28
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40
  },
  loadingText: {
    marginTop: 20,
    color: '#64748B',
    fontSize: 15
  },
  resultsCard: {
    marginBottom: 28,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  resultsTitle: {
    marginBottom: 20,
    fontWeight: '700',
    fontSize: 20,
    color: '#1E293B',
    letterSpacing: -0.5
  },
  foodItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  foodItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  foodItemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center'
  },
  foodName: {
    flex: 1,
    fontWeight: '700',
    color: '#1E293B',
    fontSize: 16
  },
  deleteItemButton: {
    margin: 0,
    marginTop: -8
  },
  foodStats: {
    color: '#64748B',
    fontSize: 13
  },
  totals: {
    marginTop: 20,
    padding: 20,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  totalCalories: {
    fontWeight: '700',
    color: '#6366F1',
    marginVertical: 8,
    fontSize: 24
  },
  feedbackSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  feedbackLabel: {
    marginBottom: 12,
    color: '#1E293B',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: -0.3
  },
  feedbackInputContainer: {
    marginBottom: 16
  },
  feedbackInputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  feedbackHelp: {
    flex: 1,
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 16
  },
  feedbackIconButton: {
    margin: 0
  },
  feedbackInput: {
    marginBottom: 8,
    backgroundColor: '#FFFFFF'
  },
  improveButton: {
    borderColor: '#6366F1'
  },
  mealTypeSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  actionButtons: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 24
  },
  startOverButton: {
    flex: 1,
    borderColor: '#CBD5E1'
  },
  saveButton: {
    flex: 1
  }
});
