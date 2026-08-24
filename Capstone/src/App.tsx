import React from 'react'
import { SafeAreaView, StyleSheet } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { colors } from './theme/tokens'
import { HomeScreen } from './screens/HomeScreen'
import { OnboardingScreen } from './screens/OnboardingScreen'
import { RoleSelectionScreen } from './screens/RoleSelectionScreen'

export const App: React.FC = () => {
  const [showOnboarding, setShowOnboarding] = React.useState(true)
  const [showRoleSelection, setShowRoleSelection] = React.useState(false)

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container}>
        {showOnboarding ? (
          <OnboardingScreen
            onComplete={() => {
              setShowOnboarding(false)
              setShowRoleSelection(true)
            }}
          />
        ) : showRoleSelection ? (
          <RoleSelectionScreen onSelectRole={() => setShowRoleSelection(false)} />
        ) : (
          <HomeScreen />
        )}
      </SafeAreaView>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
})
