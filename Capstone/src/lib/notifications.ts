import Constants from 'expo-constants'
import * as Device from 'expo-device'
import type * as ExpoNotifications from 'expo-notifications'
import { Platform } from 'react-native'

import { supabase, supabaseConfig } from './supabase'

export const MULTIVENT_NOTIFICATION_CHANNEL = 'multivent-updates'

export type PushRegistrationResult = {
  ok: boolean
  message?: string
  token?: string
}

export type NotificationRouteData = {
  notificationId?: string
  resourceId?: string
  resourceType?: string
}

// Expo Go on Android supports local notifications, but SDK 53+ intentionally
// throws when remote push-token APIs are used. Check all Expo Go signals
// because expoGoConfig can be undefined rather than null in some clients.
export const isRunningInExpoGo =
  Constants.appOwnership === 'expo'
  || Constants.expoGoConfig != null
  || typeof Constants.expoVersion === 'string'

// Remote notifications are a development/production-build feature. Avoid even
// importing expo-notifications in Expo Go: some Android Expo Go releases omit
// ExpoTopicSubscriptionModule, and the package requires it during import.
export const supportsRemotePushNotifications =
  Platform.OS !== 'web' && !isRunningInExpoGo

type NotificationsModule = typeof ExpoNotifications
declare const require: (moduleName: 'expo-notifications') => NotificationsModule

export const Notifications: NotificationsModule | null =
  supportsRemotePushNotifications ? require('expo-notifications') : null

// This app's notification handler is for remote booking and account updates.
// Do not initialize that native runtime inside Android Expo Go, where the
// remote-notification module is deliberately unavailable from SDK 53 onward.
if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  })
}

const getProjectId = () =>
  Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId

const ensureAndroidChannel = async () => {
  if (Platform.OS !== 'android' || !Notifications) return

  await Notifications.setNotificationChannelAsync(MULTIVENT_NOTIFICATION_CHANNEL, {
    name: 'MULTIVENT updates',
    description: 'Booking, payment, message, review, and event updates.',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 180, 250],
    lightColor: '#6B1E2E',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: 'default',
  })
}

export const registerCurrentDeviceForPush = async (): Promise<PushRegistrationResult> => {
  if (Platform.OS === 'web') {
    return { ok: true, message: 'Native push registration is not required on web.' }
  }
  if (!supportsRemotePushNotifications || !Notifications) {
    return {
      ok: false,
      message: 'Remote push notifications require a development build on Android.',
    }
  }
  if (!supabase || !supabaseConfig.isConfigured) {
    return { ok: false, message: 'Supabase is not configured.' }
  }
  if (!Device.isDevice) {
    return {
      ok: false,
      message: 'Remote push notifications require a physical device or supported native simulator.',
    }
  }

  try {
    await ensureAndroidChannel()

    const currentPermission = await Notifications.getPermissionsAsync()
    let finalStatus = currentPermission.status
    if (finalStatus !== 'granted') {
      const requestedPermission = await Notifications.requestPermissionsAsync()
      finalStatus = requestedPermission.status
    }
    if (finalStatus !== 'granted') {
      return { ok: false, message: 'Notification permission was not granted.' }
    }

    const projectId = getProjectId()
    if (!projectId) {
      return { ok: false, message: 'The Expo EAS project ID is missing.' }
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data
    const { error } = await supabase.rpc('register_my_push_token', {
      target_app_version: Constants.expoConfig?.version ?? null,
      target_device_name: Device.deviceName ?? Device.modelName ?? null,
      target_expo_push_token: token,
      target_platform: Platform.OS,
    })

    if (error) {
      return { ok: false, message: error.message }
    }

    return { ok: true, token }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Unable to register this device.',
    }
  }
}

export const revokeCurrentDevicePushToken = async () => {
  if (
    Platform.OS === 'web'
    || !supportsRemotePushNotifications
    || !Notifications
    || !supabase
    || !supabaseConfig.isConfigured
  ) return true

  try {
    const projectId = getProjectId()
    if (!projectId) return false
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data
    const { error } = await supabase.rpc('revoke_my_push_token', {
      target_expo_push_token: token,
    })
    return !error
  } catch {
    return false
  }
}

const stringValue = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined

export const readNotificationRouteData = (
  notification: ExpoNotifications.Notification
): NotificationRouteData => {
  const data = notification.request.content.data ?? {}
  return {
    notificationId: stringValue(data.notificationId ?? data.notification_id),
    resourceId: stringValue(data.resourceId ?? data.resource_id),
    resourceType: stringValue(data.resourceType ?? data.resource_type),
  }
}

export const setApplicationBadgeFromUnreadCount = async (unreadCount: number) => {
  if (Platform.OS === 'web' || !supportsRemotePushNotifications || !Notifications) return
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, unreadCount))
  } catch {
    // Some Android launchers do not expose application badge support.
  }
}
