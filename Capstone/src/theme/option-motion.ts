import { LayoutAnimation } from 'react-native'

export const optionSelectionMotionDuration = 220

export const optionSelectionLayoutAnimation = {
  duration: optionSelectionMotionDuration,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: {
    type: LayoutAnimation.Types.easeInEaseOut,
  },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
} as const

export const animateOptionLayout = () => {
  LayoutAnimation.configureNext(optionSelectionLayoutAnimation)
}
