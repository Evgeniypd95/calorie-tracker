import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { TextInput, Button, Text, Surface, Chip, ActivityIndicator } from 'react-native-paper';
import { useOnboarding } from '../../context/OnboardingContext';
import { analyzeDietContext } from '../../services/geminiService';

// Helper function to calculate TDEE
const calculateTDEEForData = (data) => {
  const { age, weight, height, gender, activityLevel, weightUnit, heightUnit } = data;

  // Convert to metric if needed
  let weightKg = weightUnit === 'lbs' ? weight * 0.453592 : weight;
  let heightCm = heightUnit === 'ft' ? height * 30.48 : height; // Convert feet to cm

  // Mifflin-St Jeor Equation
  let bmr;
  if (gender === 'MALE') {
    bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5;
  } else {
    bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;
  }

  // Activity multipliers
  const activityMultipliers = {
    SEDENTARY: 1.2,
    LIGHT: 1.375,
    MODERATE: 1.55,
    ACTIVE: 1.725,
    VERY_ACTIVE: 1.9
  };

  let tdee = bmr * activityMultipliers[activityLevel || 'MODERATE'];

  return Math.round(tdee);
};

export default function ConversationalOnboardingScreen({ navigation }) {
  const { updateOnboardingData } = useOnboarding();
  const scrollViewRef = useRef(null);

  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'ai',
      content: "Hey! 👋 I'm your AI nutrition coach. I'll help you create a personalized nutrition plan that actually fits your lifestyle.\n\nLet's start with the basics - what brings you here?",
      timestamp: new Date()
    }
  ]);

  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationStage, setConversationStage] = useState('GOAL'); // GOAL, CONTEXT, BIOMETRICS, WORKOUTS, ANALYSIS, PLAN_REVIEW, FEEDBACK, COMPLETE
  const [collectedData, setCollectedData] = useState({});
  const [quickReplies, setQuickReplies] = useState([
    { id: 'LOSE_WEIGHT', label: 'Lose weight', emoji: '🎯' },
    { id: 'BUILD_MUSCLE', label: 'Build muscle', emoji: '💪' },
    { id: 'MAINTAIN', label: 'Stay healthy', emoji: '⚖️' },
    { id: 'EXPLORING', label: 'Just exploring', emoji: '🧭' }
  ]);
  const [generatedPlan, setGeneratedPlan] = useState(null);

  // Scroll to bottom when messages update
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const addMessage = (role, content, options = {}) => {
    const newMessage = {
      id: Date.now() + Math.random(),
      role,
      content,
      timestamp: new Date(),
      ...options
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  };

  const handleQuickReply = async (value, label) => {
    // Add user's selection as a message
    addMessage('user', label || value);

    // Clear quick replies
    setQuickReplies([]);

    // Process based on current stage
    await processUserResponse(value, label);
  };

  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text) return;

    // Add user message
    addMessage('user', text);
    setInputText('');

    // Process response
    await processUserResponse(text);
  };

  const processUserResponse = async (input, displayText) => {
    setIsProcessing(true);

    try {
      switch (conversationStage) {
        case 'GOAL':
          await handleGoalResponse(input);
          break;
        case 'CONTEXT':
          await handleContextResponse(input);
          break;
        case 'BIOMETRICS':
          await handleBiometricsResponse(input);
          break;
        case 'WORKOUTS':
          await handleWorkoutsResponse(input);
          break;
        case 'FEEDBACK':
          await handleFeedbackResponse(input);
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Error processing response:', error);
      addMessage('ai', "Hmm, I didn't quite catch that. Could you try rephrasing?");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGoalResponse = async (goal) => {
    setCollectedData(prev => ({ ...prev, goal }));

    let goalText = '';
    switch (goal) {
      case 'LOSE_WEIGHT':
        goalText = 'lose weight';
        break;
      case 'BUILD_MUSCLE':
        goalText = 'build muscle';
        break;
      case 'MAINTAIN':
        goalText = 'maintain';
        break;
      case 'EXPLORING':
        goalText = 'explore';
        break;
      default:
        goalText = goal;
    }

    setTimeout(() => {
      addMessage('ai', `Got it! So you want to ${goalText}. 💪\n\nTell me a bit about your current situation:\n• What's your typical diet like?\n• How active are you?\n• Any specific challenges you're facing?`);
      setConversationStage('CONTEXT');
    }, 800);
  };

  const handleContextResponse = async (context) => {
    setCollectedData(prev => ({ ...prev, dietContext: context }));

    setTimeout(() => {
      addMessage('ai', "Thanks for sharing! That's really helpful context. 🙏\n\nNow let me get some numbers to calculate your personalized plan. Just give me rough estimates:\n\n• Age\n• Current weight (kg or lbs)\n• Height (cm or ft)\n• Gender");
      setConversationStage('BIOMETRICS');
    }, 1000);
  };

  const handleBiometricsResponse = async (input) => {
    // Parse biometrics from natural language using AI
    addMessage('ai', '🤔 Let me process that...');

    try {
      // Extract numbers and info from the text
      const ageMatch = input.match(/(\d+)\s*(years?|yrs?|yo)?/i);
      const weightMatch = input.match(/(\d+\.?\d*)\s*(kg|lbs?|pounds?)/i);
      const heightMatch = input.match(/(\d+\.?\d*)\s*(cm|ft|feet|'|"|inches?)/i);
      const genderMatch = input.match(/(male|female|man|woman|m|f)/i);

      if (!ageMatch || !weightMatch || !heightMatch) {
        setMessages(prev => prev.slice(0, -1));
        addMessage('ai', "I need all three: age, weight, and height. Try something like:\n\n'I'm 30 years old, weigh 70kg, and I'm 175cm tall'");
        return;
      }

      const age = parseInt(ageMatch[1]);
      const weight = parseFloat(weightMatch[1]);
      const weightUnit = weightMatch[2].toLowerCase().includes('lb') || weightMatch[2].toLowerCase().includes('pound') ? 'lbs' : 'kg';
      const height = parseFloat(heightMatch[1]);
      const heightUnit = heightMatch[2].toLowerCase().includes('cm') ? 'cm' : 'ft';
      const gender = genderMatch ? (genderMatch[1].toLowerCase().startsWith('f') || genderMatch[1].toLowerCase().includes('woman') ? 'FEMALE' : 'MALE') : 'MALE';

      setCollectedData(prev => ({
        ...prev,
        age,
        weight,
        weightUnit,
        height,
        heightUnit,
        gender
      }));

      setMessages(prev => prev.slice(0, -1));
      setTimeout(() => {
        addMessage('ai', `Perfect! So you're ${age} years old, ${weight}${weightUnit}, ${height}${heightUnit}. ✅\n\nOne more thing - how many times per week do you typically work out?`);
        setQuickReplies([
          { id: 0, label: 'None (sedentary)', emoji: '😴' },
          { id: 1, label: '1-2 times', emoji: '🚶' },
          { id: 3, label: '3-4 times', emoji: '🏃' },
          { id: 5, label: '5-6 times', emoji: '🏋️' },
          { id: 7, label: '7+ times', emoji: '⚡' }
        ]);
        setConversationStage('WORKOUTS');
      }, 1000);
    } catch (error) {
      setMessages(prev => prev.slice(0, -1));
      addMessage('ai', "Hmm, I couldn't parse that. Could you try formatting it like:\n\n'30 years old, 70kg, 175cm, male'");
    }
  };

  const handleWorkoutsResponse = async (workoutsPerWeek) => {
    const workouts = typeof workoutsPerWeek === 'string' ? parseInt(workoutsPerWeek) : workoutsPerWeek;

    // Map workouts to activity level
    let activityLevel = 'MODERATE';
    if (workouts === 0) activityLevel = 'SEDENTARY';
    else if (workouts <= 2) activityLevel = 'LIGHT';
    else if (workouts <= 4) activityLevel = 'MODERATE';
    else if (workouts <= 6) activityLevel = 'ACTIVE';
    else activityLevel = 'VERY_ACTIVE';

    setCollectedData(prev => ({
      ...prev,
      workoutsPerWeek: workouts,
      activityLevel
    }));

    setQuickReplies([]);

    setTimeout(async () => {
      addMessage('ai', "Awesome! 🎉 Give me a moment to analyze everything and create your personalized plan...");
      setConversationStage('ANALYSIS');

      // Generate plan
      await generatePersonalizedPlan({
        ...collectedData,
        workoutsPerWeek: workouts,
        activityLevel
      });
    }, 800);
  };

  const generatePersonalizedPlan = async (data) => {
    setIsProcessing(true);

    try {
      // Update onboarding context with collected data
      await updateOnboardingData({
        goal: data.goal,
        age: data.age,
        weight: data.weight,
        height: data.height,
        weightUnit: data.weightUnit,
        heightUnit: data.heightUnit,
        gender: data.gender,
        workoutsPerWeek: data.workoutsPerWeek,
        activityLevel: data.activityLevel,
        bodyType: 'MESOMORPH' // Default
      });

      // Calculate TDEE using a local function with the new data
      const tdee = calculateTDEEForData(data);

      // Generate AI-powered analysis and recommendations
      const aiAnalysis = await analyzeDietContext(data.dietContext, data.goal, {
        age: data.age,
        weight: data.weight,
        height: data.height,
        gender: data.gender,
        activityLevel: data.activityLevel,
        tdee
      });

      // Parse AI response to extract recommendations
      const plan = {
        tdee,
        strategy: aiAnalysis.recommendedStrategy || 'CHALLENGING',
        dailyCalories: aiAnalysis.dailyCalories || Math.round(tdee * 0.85),
        protein: aiAnalysis.protein || Math.round((tdee * 0.85 * 0.30) / 4),
        carbs: aiAnalysis.carbs || Math.round((tdee * 0.85 * 0.40) / 4),
        fat: aiAnalysis.fat || Math.round((tdee * 0.85 * 0.30) / 9),
        reasoning: aiAnalysis.reasoning || '',
        weekendFlexibility: aiAnalysis.weekendFlexibility || false
      };

      setGeneratedPlan(plan);

      // Remove "analyzing" message
      setMessages(prev => prev.slice(0, -1));

      // Present the plan
      setTimeout(() => {
        const goalEmoji = data.goal === 'LOSE_WEIGHT' ? '🎯' : data.goal === 'BUILD_MUSCLE' ? '💪' : '⚖️';

        let planMessage = `${goalEmoji} Here's your personalized nutrition plan:\n\n`;
        planMessage += `**Daily Calories:** ${plan.dailyCalories} cal\n`;
        planMessage += `**Macros:**\n`;
        planMessage += `• Protein: ${plan.protein}g\n`;
        planMessage += `• Carbs: ${plan.carbs}g\n`;
        planMessage += `• Fat: ${plan.fat}g\n\n`;

        if (plan.reasoning) {
          planMessage += `**Why this works for you:**\n${plan.reasoning}\n\n`;
        }

        planMessage += `This is based on your TDEE (maintenance calories) of ${tdee} cal/day.\n\n`;
        planMessage += `What do you think? Does this feel right, or would you like me to adjust anything?`;

        addMessage('ai', planMessage, { planData: plan });
        setConversationStage('PLAN_REVIEW');
        setQuickReplies([
          { id: 'APPROVE', label: 'Looks perfect! ✨', emoji: '✅' },
          { id: 'FEEDBACK', label: 'I want to adjust...', emoji: '🔧' }
        ]);
      }, 2000);
    } catch (error) {
      console.error('Error generating plan:', error);
      setMessages(prev => prev.slice(0, -1));

      // Fallback to basic calculation
      const tdee = calculateTDEE();
      const plan = {
        tdee,
        strategy: 'CHALLENGING',
        dailyCalories: Math.round(tdee * 0.85),
        protein: Math.round((tdee * 0.85 * 0.30) / 4),
        carbs: Math.round((tdee * 0.85 * 0.40) / 4),
        fat: Math.round((tdee * 0.85 * 0.30) / 9),
        reasoning: 'Balanced approach with moderate deficit/surplus',
        weekendFlexibility: false
      };

      setGeneratedPlan(plan);

      addMessage('ai', `Here's your personalized plan:\n\n**Daily Calories:** ${plan.dailyCalories} cal\n**Protein:** ${plan.protein}g | **Carbs:** ${plan.carbs}g | **Fat:** ${plan.fat}g\n\nThis is based on your TDEE of ${tdee} cal/day.\n\nWhat do you think?`);
      setConversationStage('PLAN_REVIEW');
      setQuickReplies([
        { id: 'APPROVE', label: 'Looks good!', emoji: '✅' },
        { id: 'FEEDBACK', label: 'Let me adjust...', emoji: '🔧' }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePlanReview = async (action) => {
    setQuickReplies([]);

    if (action === 'APPROVE') {
      // Save the plan to onboarding context
      updateOnboardingData({
        dailyCalorieTarget: generatedPlan.dailyCalories,
        proteinTarget: generatedPlan.protein,
        carbsTarget: generatedPlan.carbs,
        fatTarget: generatedPlan.fat,
        strategy: generatedPlan.strategy,
        enableWeekendFlexibility: generatedPlan.weekendFlexibility
      });

      setTimeout(() => {
        addMessage('ai', "Amazing! 🎉 Your plan is all set.\n\nLast step - let's create your account so you can start tracking!");
        setConversationStage('COMPLETE');

        setTimeout(() => {
          navigation.navigate('Signup');
        }, 2000);
      }, 800);
    } else if (action === 'FEEDBACK') {
      addMessage('ai', "No problem! Tell me what you'd like to adjust. For example:\n\n• 'Make it more aggressive'\n• 'I want more protein'\n• 'Add weekend flexibility'\n• 'Lower the calories'");
      setConversationStage('FEEDBACK');
    }
  };

  const handleFeedbackResponse = async (feedback) => {
    addMessage('ai', "Let me adjust that for you...");
    setIsProcessing(true);

    try {
      // Use AI to interpret the feedback and adjust the plan
      const adjustedPlan = await adjustPlanBasedOnFeedback(feedback, generatedPlan, collectedData);

      setGeneratedPlan(adjustedPlan);
      setMessages(prev => prev.slice(0, -1));

      setTimeout(() => {
        addMessage('ai', `Updated! ✨\n\n**Daily Calories:** ${adjustedPlan.dailyCalories} cal\n**Protein:** ${adjustedPlan.protein}g | **Carbs:** ${adjustedPlan.carbs}g | **Fat:** ${adjustedPlan.fat}g\n\nHow's this?`);
        setConversationStage('PLAN_REVIEW');
        setQuickReplies([
          { id: 'APPROVE', label: 'Perfect now!', emoji: '✅' },
          { id: 'FEEDBACK', label: 'One more thing...', emoji: '🔧' }
        ]);
      }, 1500);
    } catch (error) {
      console.error('Error adjusting plan:', error);
      setMessages(prev => prev.slice(0, -1));
      addMessage('ai', "Could you be more specific about what you'd like to adjust?");
    } finally {
      setIsProcessing(false);
    }
  };

  const adjustPlanBasedOnFeedback = async (feedback, currentPlan, userData) => {
    // Simple rule-based adjustments (can be enhanced with AI)
    let adjustedPlan = { ...currentPlan };
    const feedbackLower = feedback.toLowerCase();

    if (feedbackLower.includes('aggressive') || feedbackLower.includes('faster') || feedbackLower.includes('more deficit')) {
      adjustedPlan.dailyCalories = Math.round(currentPlan.tdee * 0.80);
      adjustedPlan.strategy = 'AGGRESSIVE';
    } else if (feedbackLower.includes('comfortable') || feedbackLower.includes('slower') || feedbackLower.includes('easier')) {
      adjustedPlan.dailyCalories = Math.round(currentPlan.tdee * 0.90);
      adjustedPlan.strategy = 'COMFORTABLE';
    }

    if (feedbackLower.includes('more protein') || feedbackLower.includes('higher protein')) {
      adjustedPlan.protein = Math.round((adjustedPlan.dailyCalories * 0.35) / 4);
      adjustedPlan.carbs = Math.round((adjustedPlan.dailyCalories * 0.35) / 4);
      adjustedPlan.fat = Math.round((adjustedPlan.dailyCalories * 0.30) / 9);
    } else if (feedbackLower.includes('more carbs') || feedbackLower.includes('higher carbs')) {
      adjustedPlan.protein = Math.round((adjustedPlan.dailyCalories * 0.25) / 4);
      adjustedPlan.carbs = Math.round((adjustedPlan.dailyCalories * 0.50) / 4);
      adjustedPlan.fat = Math.round((adjustedPlan.dailyCalories * 0.25) / 9);
    }

    if (feedbackLower.includes('weekend') || feedbackLower.includes('flexibility')) {
      adjustedPlan.weekendFlexibility = true;
    }

    if (feedbackLower.includes('lower calories') || feedbackLower.includes('less calories')) {
      adjustedPlan.dailyCalories = Math.round(adjustedPlan.dailyCalories * 0.95);
    } else if (feedbackLower.includes('more calories') || feedbackLower.includes('higher calories')) {
      adjustedPlan.dailyCalories = Math.round(adjustedPlan.dailyCalories * 1.05);
    }

    return adjustedPlan;
  };

  const renderMessage = (message) => {
    const isUser = message.role === 'user';

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

        {/* Quick Replies */}
        {quickReplies.length > 0 && (
          <View style={styles.quickRepliesContainer}>
            {quickReplies.map((reply) => (
              <Chip
                key={reply.id}
                mode="outlined"
                onPress={() => handleQuickReply(reply.id, reply.label)}
                style={styles.quickReply}
              >
                {reply.emoji} {reply.label}
              </Chip>
            ))}
          </View>
        )}

        {/* Plan Review Actions */}
        {conversationStage === 'PLAN_REVIEW' && quickReplies.length > 0 && (
          <View style={styles.planReviewActions}>
            {quickReplies.map((reply) => (
              <Button
                key={reply.id}
                mode={reply.id === 'APPROVE' ? 'contained' : 'outlined'}
                onPress={() => handlePlanReview(reply.id)}
                style={styles.planReviewButton}
              >
                {reply.label}
              </Button>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Input Bar - Hide when showing quick replies for certain stages */}
      {conversationStage !== 'PLAN_REVIEW' && (
        <Surface style={styles.inputContainer} elevation={4}>
          <View style={styles.inputRow}>
            <TextInput
              mode="outlined"
              placeholder="Type your response..."
              value={inputText}
              onChangeText={setInputText}
              style={styles.textInput}
              multiline
              maxLength={500}
              disabled={isProcessing || quickReplies.length > 0}
              onSubmitEditing={handleSendMessage}
            />
            <Button
              mode="contained"
              onPress={handleSendMessage}
              disabled={!inputText.trim() || isProcessing}
              style={styles.sendButton}
              icon="send"
            >
              Send
            </Button>
          </View>
        </Surface>
      )}
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
    lineHeight: 22
  },
  userMessageText: {
    color: '#FFFFFF'
  },
  aiMessageText: {
    color: '#1E293B'
  },
  quickRepliesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    marginBottom: 8
  },
  quickReply: {
    marginBottom: 8
  },
  planReviewActions: {
    marginTop: 20,
    gap: 12
  },
  planReviewButton: {
    marginBottom: 8
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0'
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: '#F8FAFC',
    fontSize: 15
  },
  sendButton: {
    marginBottom: 4
  }
});
