import { MaterialCommunityIcons } from '@expo/vector-icons'
import React from 'react'
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native'

export type InboxSelectionState = 'checked' | 'mixed' | 'unchecked'

interface InboxSelectionBoxProps {
  color?: string
  size?: number
  state: InboxSelectionState
}

interface InboxTrashButtonProps {
  accessibilityLabel: string
  color?: string
  disabled?: boolean
  onPress?: () => void
  size?: number
  style?: StyleProp<ViewStyle>
}

export const InboxSelectionBox: React.FC<InboxSelectionBoxProps> = ({
  color = '#6B1E2E',
  size = 18,
  state,
}) => {
  const isChecked = state === 'checked'
  const isMixed = state === 'mixed'
  return (
    <View
      pointerEvents="none"
      style={[
        styles.selectionBox,
        { borderColor: color, height: size, width: size },
        isChecked && { backgroundColor: color },
      ]}
    >
      {isChecked ? <View style={[styles.checkedMark, { borderColor: '#FFFFFF' }]} /> : null}
      {isMixed ? <View style={[styles.mixedMark, { backgroundColor: color }]} /> : null}
    </View>
  )
}

export const InboxTrashButton: React.FC<InboxTrashButtonProps> = ({
  accessibilityLabel,
  color = '#6B1E2E',
  disabled = false,
  onPress,
  size = 22,
  style,
}) => (
  <Pressable
    accessibilityLabel={accessibilityLabel}
    accessibilityRole="button"
    disabled={disabled}
    hitSlop={8}
    onPress={onPress}
    style={({ pressed }) => [styles.trashButton, style, pressed && !disabled && styles.pressed, disabled && styles.disabled]}
  >
    <MaterialCommunityIcons color={color} name="trash-can-outline" size={size} />
  </Pressable>
)

const styles = StyleSheet.create({
  trashButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 },
  pressed: { opacity: 0.62 },
  disabled: { opacity: 0.42 },
  selectionBox: { alignItems: 'center', justifyContent: 'center', borderRadius: 2, borderWidth: 1.5 },
  checkedMark: { width: '46%', height: '25%', marginTop: -1, borderBottomWidth: 1.5, borderLeftWidth: 1.5, transform: [{ rotate: '-45deg' }] },
  mixedMark: { width: '56%', height: 2, borderRadius: 1 },
})
