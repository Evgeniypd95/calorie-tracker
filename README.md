# AI Calorie Tracker - MVP

A React Native mobile app that uses Gemini AI to parse meal descriptions into nutritional data. Users can set health goals, log meals via text input, track progress, and follow friends.

## Tech Stack

- **Frontend**: React Native (Expo)
- **Backend**: Firebase (Firestore, Authentication, Cloud Functions)
- **AI**: Gemini API
- **Navigation**: React Navigation
- **UI Components**: React Native Paper

## Project Structure

```
calorie-tracker/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── MealCard.js
│   │   ├── ProgressRing.js
│   │   └── MacroBar.js
│   ├── screens/            # App screens
│   │   ├── auth/           # Login/Signup
│   │   ├── onboarding/     # User setup flow
│   │   └── main/           # Dashboard, LogMeal, Social, Profile
│   ├── navigation/         # Navigation setup
│   ├── services/           # Firebase & API services
│   ├── context/            # React Context (Auth)
│   └── config/             # Firebase config
├── firebase/
│   └── functions/          # Cloud Functions
└── App.js                  # Root component
```

## Setup Instructions

### 1. Firebase Setup

1. Create a new Firebase project at https://console.firebase.google.com
2. Enable **Email/Password Authentication**:
   - Go to Authentication > Sign-in method
   - Enable Email/Password provider
3. Create a **Firestore Database**:
   - Go to Firestore Database
   - Click "Create database"
   - Start in test mode (or production mode with proper rules)
4. Get your Firebase config:
   - Go to Project Settings > General
   - Scroll to "Your apps" and add a web app
   - Copy the configuration object

### 2. Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Firebase credentials:
   ```env
   EXPO_PUBLIC_FIREBASE_API_KEY=your_actual_api_key
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_actual_auth_domain
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_actual_project_id
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_actual_storage_bucket
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_actual_sender_id
   EXPO_PUBLIC_FIREBASE_APP_ID=your_actual_app_id
   ```

   **Important**: The `.env` file is gitignored to keep your credentials secure. Never commit it to version control.

### 3. Gemini API Setup

1. Get a Gemini API key from https://makersuite.google.com/app/apikey
2. You'll use this key in Firebase Cloud Functions (see step 4)

### 4. Deploy Firebase Cloud Functions

```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project (if not already done)
firebase init

# Select:
# - Functions
# - Use existing project (select your Firebase project)

# Navigate to functions directory
cd firebase/functions

# Install dependencies
npm install

# Set the Gemini API key
  # Add your Gemini API key to functions/.env:
  # GEMINI_API_KEY=your_api_key_here
  
# Deploy functions
firebase deploy --only functions
```

### 5. Install Dependencies

```bash
# Already installed during project creation, but if needed:
npm install
```

### 6. Run the App

```bash
# Start the Expo development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run on web
npm run web
```

## Environment Variables

All sensitive credentials are stored in the `.env` file (which is gitignored for security).

### Setup Steps:

1. **Copy the template**:
   ```bash
   cp .env.example .env
   ```

2. **Fill in your credentials** in the `.env` file:
   ```env
   # Firebase Configuration
   EXPO_PUBLIC_FIREBASE_API_KEY=your_actual_api_key
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_actual_auth_domain
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_actual_project_id
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_actual_storage_bucket
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_actual_sender_id
   EXPO_PUBLIC_FIREBASE_APP_ID=your_actual_app_id

   # Gemini API Key (for Cloud Functions)
   GEMINI_API_KEY=your_gemini_api_key
   ```

### Important Notes:

- **EXPO_PUBLIC_ prefix**: Environment variables in Expo must be prefixed with `EXPO_PUBLIC_` to be accessible in the app
- **Security**: The `.env` file is in `.gitignore` and should NEVER be committed to version control
- **Production**: For production deployments, set these as environment variables in your hosting provider's dashboard
- **Restart required**: After changing `.env`, restart the Expo dev server for changes to take effect

## Features

### Core Features (Implemented)

- **Authentication**: Email/password signup and login
- **Onboarding Flow**:
  - Collect biometric data (age, sex, weight, height, activity level)
  - Set weight loss goals
  - Calculate personalized daily calorie and macro budgets
- **Meal Logging**:
  - Text-based meal input
  - AI-powered nutrition parsing via Gemini
  - Automatic macro calculation
- **Dashboard**:
  - Daily calorie progress ring
  - Macro breakdown (protein, carbs, fat)
  - Today's meal history
  - Streak counter
- **Social Features**:
  - Personal code system for following friends
  - View friends' streaks
- **Profile**:
  - View daily budget
  - View stats (streaks, followers, following)
  - Logout functionality

## Firestore Data Structure

### Users Collection

```javascript
{
  userId: {
    age: number,
    sex: "male" | "female",
    weight: number,
    height: number,
    activityLevel: string,
    targetWeight: number,
    weeksToGoal: number,
    dailyBudget: {
      calories: number,
      protein: number,
      carbs: number,
      fat: number
    },
    personalCode: string,
    following: [userId],
    followers: [userId],
    streakCount: number,
    lastLogDate: timestamp,
    createdAt: timestamp
  }
}
```

### Meals Collection

```javascript
{
  mealId: {
    userId: string,
    mealType: "Breakfast" | "Lunch" | "Dinner" | "Snack",
    description: string,
    items: [{
      food: string,
      quantity: string,
      calories: number,
      protein: number,
      carbs: number,
      fat: number
    }],
    totals: {
      calories: number,
      protein: number,
      carbs: number,
      fat: number
    },
    date: timestamp,
    createdAt: timestamp
  }
}
```

## Testing

### Manual Testing Checklist

- [ ] User can sign up with email/password
- [ ] User can log in
- [ ] Onboarding flow collects all required data
- [ ] Daily budget is calculated correctly
- [ ] User can log a meal with text description
- [ ] Gemini API parses meal correctly
- [ ] Meals appear on dashboard
- [ ] Daily totals update correctly
- [ ] Progress ring shows accurate percentage
- [ ] Streak increments when logging daily
- [ ] User can follow friends via personal code
- [ ] Following list displays correctly
- [ ] User can log out

## Troubleshooting

### Firebase Connection Issues

- Verify Firebase config in `src/config/firebase.config.js`
- Check that Firebase Authentication and Firestore are enabled
- Ensure Firestore security rules allow read/write access

### Gemini API Issues

- Verify Gemini API key is set in Cloud Functions config
- Check Cloud Functions logs: `firebase functions:log`
- Ensure the parseMeal function is deployed

### Build Issues

- Clear Metro bundler cache: `npm start -- --reset-cache`
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Clear Expo cache: `expo start -c`

## Next Steps

### Potential Enhancements

1. **Voice Input**: Add speech-to-text for meal logging
2. **Photo Recognition**: Allow users to upload meal photos
3. **Weight Tracking**: Track weight over time with graphs
4. **Meal Planning**: Suggest meals to hit daily targets
5. **Barcode Scanning**: Scan packaged foods
6. **Water Tracking**: Track daily water intake
7. **Exercise Logging**: Log workouts and adjust calorie budget
8. **Advanced Analytics**: Weekly/monthly progress reports
9. **Push Notifications**: Remind users to log meals
10. **Offline Support**: Cache data for offline use

## License

This project is provided as-is for educational purposes.

## Support

For issues or questions, please check:
- Firebase Documentation: https://firebase.google.com/docs
- Expo Documentation: https://docs.expo.dev
- Gemini API Documentation: https://ai.google.dev/docs
