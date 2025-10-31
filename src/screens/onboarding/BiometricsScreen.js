import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { TextInput, Button, Text, RadioButton } from 'react-native-paper';

export default function BiometricsScreen({ navigation }) {
  const [formData, setFormData] = useState({
    age: '',
    sex: 'male',
    weight: '',
    height: '',
    activityLevel: 'moderate'
  });

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    // Validate
    if (!formData.age || !formData.weight || !formData.height) {
      alert('Please fill in all fields');
      return;
    }

    navigation.navigate('Goals', { biometrics: formData });
  };

  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Tell us about yourself
      </Text>

      <TextInput
        label="Age"
        value={formData.age}
        onChangeText={(text) => updateField('age', text)}
        keyboardType="numeric"
        mode="outlined"
        style={styles.input}
      />

      <Text variant="titleMedium" style={styles.sectionTitle}>Sex</Text>
      <RadioButton.Group
        onValueChange={(value) => updateField('sex', value)}
        value={formData.sex}
      >
        <View style={styles.radioRow}>
          <RadioButton.Item label="Male" value="male" />
          <RadioButton.Item label="Female" value="female" />
        </View>
      </RadioButton.Group>

      <TextInput
        label="Current Weight (lbs)"
        value={formData.weight}
        onChangeText={(text) => updateField('weight', text)}
        keyboardType="numeric"
        mode="outlined"
        style={styles.input}
      />

      <TextInput
        label="Height (inches)"
        value={formData.height}
        onChangeText={(text) => updateField('height', text)}
        keyboardType="numeric"
        mode="outlined"
        style={styles.input}
      />

      <Text variant="titleMedium" style={styles.sectionTitle}>
        Activity Level
      </Text>
      <RadioButton.Group
        onValueChange={(value) => updateField('activityLevel', value)}
        value={formData.activityLevel}
      >
        <RadioButton.Item label="Sedentary (little/no exercise)" value="sedentary" />
        <RadioButton.Item label="Light (1-3 days/week)" value="light" />
        <RadioButton.Item label="Moderate (3-5 days/week)" value="moderate" />
        <RadioButton.Item label="Active (6-7 days/week)" value="active" />
        <RadioButton.Item label="Very Active (physical job + exercise)" value="veryActive" />
      </RadioButton.Group>

      <Button mode="contained" onPress={handleNext} style={styles.button}>
        Next
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff'
  },
  title: {
    marginBottom: 24,
    fontWeight: 'bold'
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 8
  },
  input: {
    marginBottom: 16
  },
  radioRow: {
    flexDirection: 'row'
  },
  button: {
    marginTop: 24,
    marginBottom: 40
  }
});
