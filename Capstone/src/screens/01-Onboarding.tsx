import { Text } from '../components/AppText'
import React, { useRef, useState } from 'react'
import {
  Animated,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  
  useWindowDimensions,
  View,
} from 'react-native'
import { colors, radius, spacing } from '../theme/tokens'
import { typography as typographyScale } from '../theme/typography'

interface OnboardingScreenProps {
  onComplete: () => void
}

const slides = [
  {
    title: 'Plan Your Whole Wedding in One Place',
    description: 'From venues to florals, manage every detail without juggling apps.',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBsdBg1PW_svZQ2AFBSxF6XttAa5X6_BRDdjWfoBxC_0YdtLZe4IlRfE4FZBzCG1zc6xSYULV1aCz549NSIJEXjR_YUkFLr7uYIPOAkXUVxEEBvoSoBC8Y1YaVhk9FjX1ZkvnTXoNMS-ZwGovyfArVFunubev3FvkNf1C2aZXHin3Se4xCXf52HWaR4zbK8ScWBpZGBr82aO-RTdZpHHs5ifedTgiI7qNpWZzCSNVEV20xHGoC_UfPaw',
  },
  {
    title: 'Compare & Book Trusted Providers',
    description: 'Browse real reviews and pricing from vetted vendors in Bacolod City.',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAGoegvKB9hAsbm3MMaJ5QxTavJ_MqcBoSqZyk4shuzOUeQgCLrYUXGDSsTjwaACi2K7ftvd-9OlC01GtToJQBG2rWm8YcRV3s7xt14b0OYD6fnLiBpl_lPhXMEIOpV5Yy-3dwMRCUjcKegvnbwOjWrZERw45rg_TlKjfYsSUsRmh9K7IAnEWxzukPeydt8eKU7JkaGHamAfj0dpjZVIddIV8U4cJFsSjw3-IXgm3ys6aFS1jwWO976OA',
  },
  {
    title: 'Stay on Budget, Automatically',
    description: 'Allocate your spending across services and track every peso in real time.',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDLLTKNNucEC_-ym8T_LMmbJeGjP5ZdfJ08qy4KWR2l_AEo_NVlLseVtYrR6_CSdq-BwhPC4Va0bLPi6RVxfzs5qpwpl377HRw47I1ka_kf0ZKkm0syWQZNqu5vaw1YU_LpertX9N1D-3uwHjfu3nuoDmwr_x44wCvkXxktimYHAWhj7Q3ypti26FAxlzLLougJxIRwr5748QkJimH2tud34FnQ5-M6hNUSdrMED1vT_ALQhvFJOPRwBA',
  },
  {
    title: 'Get Smart, Data-Backed Recommendations',
    description: 'See AI-powered insights from real customer feedback before you decide.',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBexEEXtWJC2bbk7l4vfXPL13xTvnT3Q5-br2UYpcHl7rR6Kagn4iHlapDiVCn_ypavii4jTfSP0QXyEnjHWKz-aDtNgQ15ana0ZTzSbsD3eOTLOQrUW4xsriUhDjfkaT0Z9VbY2fmJdkUKO89bxHE6Zzzuq7_iqxPPWgUoDazfVkCOUYve0IRnXvtl390uQ5Wju-F4Cps3d1V56gL4JiViOe_3DOvrB-2F0aXjqQ8owd_UK6xT1RuJ9w',
  },
] as const

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const { width, height } = useWindowDimensions()
  const scrollViewRef = useRef<ScrollView>(null)
  const scrollX = useRef(new Animated.Value(0)).current
  const [currentSlide, setCurrentSlide] = useState(0)
  const isLastSlide = currentSlide === slides.length - 1

  const moveToSlide = (slideIndex: number) => {
    scrollViewRef.current?.scrollTo({ x: slideIndex * width, animated: true })
    setCurrentSlide(slideIndex)
  }

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / width)
    setCurrentSlide(Math.max(0, Math.min(slideIndex, slides.length - 1)))
  }

  const handleNext = () => {
    if (isLastSlide) {
      onComplete()
      return
    }
    moveToSlide(currentSlide + 1)
  }

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        decelerationRate="fast"
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: true,
        })}
        onMomentumScrollEnd={handleScrollEnd}
        style={styles.carousel}
      >
        {slides.map((slide, index) => (
          <Animated.View
            key={slide.title}
            style={[
              styles.slide,
              { width },
              {
                opacity: scrollX.interpolate({
                  inputRange: [(index - 1) * width, index * width, (index + 1) * width],
                  outputRange: [0.72, 1, 0.72],
                  extrapolate: 'clamp',
                }),
                transform: [
                  {
                    scale: scrollX.interpolate({
                      inputRange: [(index - 1) * width, index * width, (index + 1) * width],
                      outputRange: [0.96, 1, 0.96],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              },
            ]}
          >
            <Image source={{ uri: slide.image }} style={[styles.image, { height: height * 0.42 }]} />
            <View style={styles.copy}>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.description}>{slide.description}</Text>
            </View>
          </Animated.View>
        ))}
      </Animated.ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((slide, index) => (
            <Pressable
              key={slide.title}
              accessibilityRole="button"
              accessibilityLabel={`Go to slide ${index + 1}`}
              onPress={() => moveToSlide(index)}
              style={[styles.dot, index === currentSlide ? styles.activeDot : styles.inactiveDot]}
            />
          ))}
        </View>

        <View
          style={[
            styles.footerActions,
            currentSlide === 0 && styles.firstSlideFooterActions,
            isLastSlide && styles.lastSlideFooterActions,
          ]}
        >
          {currentSlide !== 0 && !isLastSlide && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip onboarding"
              onPress={onComplete}
              style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
            >
              <Text style={styles.skipText}>SKIP</Text>
            </Pressable>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={handleNext}
            style={({ pressed }) => [
              styles.nextButton,
              currentSlide === 0 && styles.getStartedButton,
              pressed && styles.nextButtonPressed,
            ]}
          >
            <Text style={styles.nextText}>
              {currentSlide === 0 ? 'Get Started' : isLastSlide ? 'Continue' : 'NEXT'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  skipButton: {
    padding: spacing.sm,
    marginLeft: spacing.xl,
  },
  skipText: {
    color: '#5E5E5E',
    fontSize: typographyScale.caption,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  carousel: {
    flex: 1,
  },
  slide: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  image: {
    width: '100%',
    maxHeight: 400,
    borderRadius: radius.large,
    borderWidth: 1,
    borderColor: '#E2E2E2',
    resizeMode: 'cover',
    marginBottom: spacing.xl,
  },
  copy: {
    width: '100%',
    alignItems: 'center',
  },
  title: {
    color: '#6B1E2E',
    fontSize: typographyScale.h1,
    lineHeight: 40,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  description: {
    color: '#5E5E5E',
    fontSize: typographyScale.body,
    lineHeight: 26,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: '#FFFFFF',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  dot: {
    borderRadius: radius.pill,
  },
  activeDot: {
    width: 10,
    height: 10,
    backgroundColor: '#6B1E2E',
  },
  inactiveDot: {
    width: 8,
    height: 8,
    backgroundColor: '#E2E2E2',
  },
  footerActions: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  firstSlideFooterActions: {
    justifyContent: 'center',
  },
  lastSlideFooterActions: {
    justifyContent: 'flex-end',
  },
  nextButton: {
    minWidth: 132,
    minHeight: 44,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: '#6B1E2E',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  getStartedButton: {
    minWidth: 220,
  },
  nextButtonPressed: {
    backgroundColor: '#4E061A',
  },
  nextText: {
    color: colors.textInverse,
    fontSize: typographyScale.body,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  pressed: {
    opacity: 0.7,
  },
})
