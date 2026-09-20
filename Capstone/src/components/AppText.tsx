import React from 'react'
import { Text as NativeText, TextProps } from 'react-native'

export const Text = React.forwardRef<React.ElementRef<typeof NativeText>, TextProps>(
  ({ style, ...props }, ref) => (
    <NativeText ref={ref} style={[{ fontFamily: 'Inter_400Regular' }, style]} {...props} />
  )
)

Text.displayName = 'Text'
