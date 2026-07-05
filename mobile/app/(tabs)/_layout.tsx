import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../../constants/theme';

interface TabIconProps {
  emoji: string;
  label: string;
  focused: boolean;
}

function TabIcon({ emoji, label, focused }: TabIconProps) {
  return (
    <View style={styles.tabItem}>
      <Text style={[styles.emoji, focused && styles.emojiActive]}>{emoji}</Text>
      <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🏠" label="Today" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="goals/index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🎯" label="Goals" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📊" label="Growth" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="👤" label="Profile" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    height: 80,
    paddingBottom: 12,
    paddingTop: 8,
  },
  tabItem: {
    alignItems: 'center',
    gap: 2,
  },
  emoji: { fontSize: 22, opacity: 0.5 },
  emojiActive: { opacity: 1 },
  label: {
    fontFamily: Fonts.medium,
    fontSize: 10,
    color: Colors.text.muted,
  },
  labelActive: { color: Colors.purple },
});
