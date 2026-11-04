import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../../constants/theme';
import { QuickTalkButton } from '../../components/ui/QuickTalkButton';

function TabEmoji({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={[styles.emoji, focused && styles.emojiActive]}>{emoji}</Text>;
}

export default function TabsLayout() {
  return (
    <View style={styles.flex}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.label,
          tabBarActiveTintColor: Colors.purple,
          tabBarInactiveTintColor: Colors.text.muted,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarLabel: 'Today',
            tabBarIcon: ({ focused }) => <TabEmoji emoji="🏠" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="goals/index"
          options={{
            tabBarLabel: 'Goals',
            tabBarIcon: ({ focused }) => <TabEmoji emoji="🎯" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="dashboard"
          options={{
            tabBarLabel: 'Growth',
            tabBarIcon: ({ focused }) => <TabEmoji emoji="📊" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="community/index"
          options={{
            tabBarLabel: 'Community',
            tabBarIcon: ({ focused }) => <TabEmoji emoji="👥" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            tabBarLabel: 'Profile',
            tabBarIcon: ({ focused }) => <TabEmoji emoji="👤" focused={focused} />,
          }}
        />
      </Tabs>
      <QuickTalkButton />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabBar: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    height: 80,
    paddingBottom: 12,
    paddingTop: 8,
  },
  emoji: { fontSize: 22, opacity: 0.5 },
  emojiActive: { opacity: 1 },
  label: {
    fontFamily: Fonts.medium,
    fontSize: 10,
  },
});
