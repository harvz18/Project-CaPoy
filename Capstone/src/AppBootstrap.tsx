import React from 'react'
import { ActivityIndicator, StyleSheet } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'

import { OnboardingScreen } from './screens/01-Onboarding'
import { supabase } from './lib/supabase'
import { colors } from './theme/tokens'

const FullApp = React.lazy(async () => ({
  default: (await import('./App')).App,
}))

type LaunchState =
  | { kind: 'onboarding' }
  | { kind: 'loading-session' }
  | { kind: 'app'; hasKnownSession: boolean; initialScreen?: 'roleSelection' }

const BootstrapFallback: React.FC = () => (
  <SafeAreaProvider>
    <StatusBar style="dark" />
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.loadingScreen}>
      <ActivityIndicator accessibilityLabel="Loading MULTIVENT" color={colors.primary} size="small" />
    </SafeAreaView>
  </SafeAreaProvider>
)

/**
 * Keeps anonymous web startup limited to the onboarding experience. The
 * authenticated application is intentionally imported only after a visitor
 * starts authentication or a stored session is found. This preserves the
 * existing App screen state and workflows while avoiding their initial bundle
 * cost for landing-page visitors.
 */
export const AppBootstrap: React.FC = () => {
  const [launchState, setLaunchState] = React.useState<LaunchState>({ kind: 'onboarding' })
  const hasEnteredAppRef = React.useRef(false)

  React.useEffect(() => {
    if (!supabase) return undefined

    let isMounted = true
    void supabase.auth.getSession()
      .then(({ data }) => {
        if (!isMounted || hasEnteredAppRef.current || !data.session?.user) return
        setLaunchState({ hasKnownSession: true, kind: 'app' })
      })
      .catch(() => {
        // A missing or temporarily unavailable stored session simply leaves
        // the visitor on onboarding. The full App retains its existing auth
        // error handling after the user begins authentication.
      })

    return () => {
      isMounted = false
    }
  }, [])

  const beginAuthentication = React.useCallback(() => {
    hasEnteredAppRef.current = true
    setLaunchState({ kind: 'loading-session' })
    // Updating on the next frame allows the onboarding button feedback to
    // paint before the deferred application module begins parsing.
    requestAnimationFrame(() => {
      setLaunchState({ hasKnownSession: false, initialScreen: 'roleSelection', kind: 'app' })
    })
  }, [])

  if (launchState.kind === 'onboarding') {
    return <OnboardingScreen onComplete={beginAuthentication} />
  }

  if (launchState.kind === 'loading-session') return <BootstrapFallback />

  return (
    <React.Suspense fallback={<BootstrapFallback />}>
      <FullApp
        initialScreen={launchState.initialScreen}
        skipInitialAuthRestore={!launchState.hasKnownSession}
      />
    </React.Suspense>
  )
}

const styles = StyleSheet.create({
  loadingScreen: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flex: 1,
    justifyContent: 'center',
  },
})
