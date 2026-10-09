import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
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

if (Platform.OS !== 'web') {
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
  if (Platform.OS !== 'android') return

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
  if (Platform.OS === 'web' || !supabase || !supabaseConfig.isConfigured) return true

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
  notification: Notifications.Notification
): NotificationRouteData => {
  const data = notification.request.content.data ?? {}
  return {
    notificationId: stringValue(data.notificationId ?? data.notification_id),
    resourceId: stringValue(data.resourceId ?? data.resource_id),
    resourceType: stringValue(data.resourceType ?? data.resource_type),
  }
}

export const setApplicationBadgeFromUnreadCount = async (unreadCount: number) => {
  if (Platform.OS === 'web') return
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, unreadCount))
  } catch {
    // Some Android launchers do not expose application badge support.
  }
}

export { Notifications }
