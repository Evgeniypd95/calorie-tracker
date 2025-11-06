import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TextInput as RNTextInput, TouchableOpacity, Animated } from 'react-native';
import { Button, Text, Surface, ActivityIndicator, IconButton } from 'react-native-paper';
import Voice from '@react-native-voice/voice';
import { chatOnboarding } from '../../services/geminiService';
import { useOnboarding } from '../../context/OnboardingContext';

export default function ConversationalOnboardingScreen({ navigation }) {
  const { updateOnboardingData } = useOnboarding();
  const scrollViewRef = useRef(null);

  // Conversation state
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hey! 👋 I'm your AI nutrition coach. Let's chat about your fitness goals.\n\nTell me about yourself - your body, your weight, your goals, and your current routine. You can type or use voice!"
    }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState(null);

  // Plan state
  const [calculatedPlan, setCalculatedPlan] = useState(null);
  const [showFinishButton, setShowFinishButton] = useState(false);

  // Voice pulse animation
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Initialize voice recognition
  useEffect(() => {
    if (Platform.OS === 'web') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognitionInstance = new SpeechRecognition();
        recognitionInstance.continuous = false;
        recognitionInstance.interimResults = false;
        recognitionInstance.lang = 'en-US';

        recognitionInstance.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          setUserInput(transcript);
          setIsListening(false);
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
      // Mobile voice setup
      Voice.onSpeechResults = (event) => {
        if (event.value && event.value[0]) {
          setUserInput(event.value[0]);
        }
      };

      Voice.onSpeechEnd = () => {
        setIsListening(false);
      };

      Voice.onSpeechError = (event) => {
        console.error('Speech error:', event.error);
        setIsListening(false);
      };
    }

    return () => {
      if (Platform.OS !== 'web') {
        Voice.destroy().then(Voice.removeAllListeners);
      }
    };
  }, []);

  // Pulse animation for voice button
  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isListening]);

  // Scroll to bottom when messages change
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const toggleVoiceInput = async () => {
    if (isListening) {
      // Stop listening
      if (Platform.OS === 'web') {
        recognition?.stop();
      } else {
        await Voice.stop();
      }
      setIsListening(false);
    } else {
      // Start listening
      try {
        if (Platform.OS === 'web') {
          recognition?.start();
        } else {
          await Voice.start('en-US');
        }
        setIsListening(true);
      } catch (error) {
        console.error('Error starting voice:', error);
      }
    }
  };

  const sendMessage = async () => {
    if (!userInput.trim() || isLoading) return;

    const newUserMessage = {
      role: 'user',
      content: userInput.trim()
    };

    setMessages(prev => [...prev, newUserMessage]);
    setUserInput('');
    setIsLoading(true);

    try {
      // Call AI chat service
      const response = await chatOnboarding(
        [...messages, newUserMessage],
        newUserMessage.content
      );

      // Add AI response to messages
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.response
      }]);

      // If AI has calculated a plan, show it
      if (response.calculatedPlan) {
        setCalculatedPlan(response.calculatedPlan);
        setShowFinishButton(true);

        // Save plan data
        updateOnboardingData({
          ...response.extractedData,
          dailyCalorieTarget: response.calculatedPlan.dailyCalories,
          proteinTarget: response.calculatedPlan.protein,
          carbsTarget: response.calculatedPlan.carbs,
          fatTarget: response.calculatedPlan.fat
        });
      }

    } catch (error) {
      console.error('Error in chat:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I'm having trouble connecting. Let me try again - could you repeat that?"
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinish = () => {
    navigation.navigate('Signup');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your AI Coach</Text>
        <Text style={styles.headerSubtitle}>Speak or type naturally</Text>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.map((message, index) => (
          <View
            key={index}
            style={[
              styles.messageBubble,
              message.role === 'user' ? styles.userMessage : styles.assistantMessage
            ]}
          >
            <Text style={[
              styles.messageText,
              message.role === 'user' ? styles.userMessageText : styles.assistantMessageText
            ]}>
              {message.content}
            </Text>
          </View>
        ))}

        {/* Show plan if calculated */}
        {calculatedPlan && (
          <Surface style={styles.planCard}>
            <Text style={styles.planTitle}>Your Personalized Plan 🎯</Text>

            <View style={styles.planStats}>
              <View style={styles.planStat}>
                <Text style={styles.planStatValue}>{calculatedPlan.dailyCalories}</Text>
                <Text style={styles.planStatLabel}>Daily Calories</Text>
              </View>
            </View>

            <View style={styles.macrosContainer}>
              <View style={styles.macroItem}>
                <Text style={styles.macroValue}>{calculatedPlan.protein}g</Text>
                <Text style={styles.macroLabel}>Protein</Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={styles.macroValue}>{calculatedPlan.carbs}g</Text>
                <Text style={styles.macroLabel}>Carbs</Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={styles.macroValue}>{calculatedPlan.fat}g</Text>
                <Text style={styles.macroLabel}>Fat</Text>
              </View>
            </View>

            {calculatedPlan.reasoning && (
              <Text style={styles.planReasoning}>{calculatedPlan.reasoning}</Text>
            )}
          </Surface>
        )}

        {isLoading && (
          <View style={styles.loadingBubble}>
            <ActivityIndicator size="small" color="#6366F1" />
            <Text style={styles.loadingText}>AI is thinking...</Text>
          </View>
        )}
      </ScrollView>

      {/* Finish Button (shown when plan is ready) */}
      {showFinishButton && (
        <View style={styles.finishButtonContainer}>
          <Button
            mode="contained"
            onPress={handleFinish}
            style={styles.finishButton}
            icon="check-circle"
          >
            Finish & Create Account
          </Button>
        </View>
      )}

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <TouchableOpacity
          onPress={toggleVoiceInput}
          style={styles.voiceButton}
        >
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <IconButton
              icon={isListening ? "microphone" : "microphone-outline"}
              size={32}
              iconColor={isListening ? "#EF4444" : "#6366F1"}
            />
          </Animated.View>
        </TouchableOpacity>

        <RNTextInput
          style={styles.textInput}
          placeholder={isListening ? "Listening..." : "Type or tap mic to speak..."}
          value={userInput}
          onChangeText={setUserInput}
          onSubmitEditing={sendMessage}
          multiline
          editable={!isListening}
          placeholderTextColor="#94A3B8"
        />

        <TouchableOpacity
          onPress={sendMessage}
          disabled={!userInput.trim() || isLoading}
          style={[styles.sendButton, (!userInput.trim() || isLoading) && styles.sendButtonDisabled]}
        >
          <IconButton
            icon="send"
            size={24}
            iconColor={userInput.trim() && !isLoading ? "#6366F1" : "#CBD5E1"}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9'
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 4
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748B'
  },
  messagesContainer: {
    flex: 1
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 14,
    borderRadius: 20,
    marginBottom: 12
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#6366F1',
    borderBottomRightRadius: 4
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22
  },
  userMessageText: {
    color: '#FFFFFF'
  },
  assistantMessageText: {
    color: '#1E293B'
  },
  loadingBubble: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    paddingHorizontal: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    marginBottom: 12,
    gap: 8
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
    fontStyle: 'italic'
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
    textAlign: 'center'
  },
  planStats: {
    alignItems: 'center',
    marginBottom: 16
  },
  planStat: {
    alignItems: 'center'
  },
  planStatValue: {
    fontSize: 42,
    fontWeight: '800',
    color: '#6366F1',
    marginBottom: 4
  },
  planStatLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600'
  },
  macrosContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0'
  },
  macroItem: {
    alignItems: 'center'
  },
  macroValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4
  },
  macroLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600'
  },
  planReasoning: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginTop: 12,
    fontStyle: 'italic'
  },
  finishButtonContainer: {
    padding: 16,
    paddingTop: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0'
  },
  finishButton: {
    paddingVertical: 6
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 8
  },
  voiceButton: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1E293B',
    maxHeight: 100,
    minHeight: 44
  },
  sendButton: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  sendButtonDisabled: {
    opacity: 0.5
  }
});
