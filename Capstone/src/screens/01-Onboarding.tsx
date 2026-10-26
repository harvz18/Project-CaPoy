import { Text } from '../components/AppText'
import React, { useRef, useState } from 'react'
import {
  Animated,
  Easing,
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

const ONBOARDING_TRANSITION_DURATION = 900
type ScrollViewInstance = React.ComponentRef<typeof ScrollView>

const slides = [
  {
    title: 'Plan Your Event,\nAll in One Place',
    description: 'Discover trusted service providers, organize your plans, and bring every detail together effortlessly.',
    image: require('../../images/Onboard1.jpg'),
  },
  {
    title: 'Compare & Book Verified Service Providers',
    description: 'Browse real reviews and pricing from vetted vendors in Bacolod City.',
    image: require('../../images/Onboard2.jpg'),
  },
  {
    title: 'Keep Your Event Budget on Track',
    description: 'Set your budget, allocate funds to each service, and monitor every peso you spend.',
    image: require('../../images/Onboard3.jpg'),
  },
  {
    title: 'Find the Right Service Providers with Confidence',
    description: 'Discover AI-powered recommendations informed by customer reviews to help you choose the best services for your event.',
    image: require('../../images/Onboard4.jpg'),
  },
] as const

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const { width, height } = useWindowDimensions()
  const scrollViewRef = useRef<ScrollViewInstance>(null)
  const scrollX = useRef(new Animated.Value(0)).current
  const transitionIdRef = useRef(0)
  const transitionFrameRef = useRef<number | null>(null)
  const [currentSlide, setCurrentSlide] = useState(0)
  const isLastSlide = currentSlide === slides.length - 1

  const stopSlideTransition = () => {
    transitionIdRef.current += 1
    if (transitionFrameRef.current !== null) {
      cancelAnimationFrame(transitionFrameRef.current)
      transitionFrameRef.current = null
    }
  }

  const moveToSlide = (slideIndex: number) => {
    const targetSlide = Math.max(0, Math.min(slideIndex, slides.length - 1))
    const transitionId = transitionIdRef.current + 1
    const targetX = targetSlide * width

    if (transitionFrameRef.current !== null) {
      cancelAnimationFrame(transitionFrameRef.current)
      transitionFrameRef.current = null
    }
    transitionIdRef.current = transitionId
    setCurrentSlide(targetSlide)

    scrollX.stopAnimation((startX) => {
      if (transitionId !== transitionIdRef.current) return

      const ease = Easing.inOut(Easing.cubic)
      let startTime: number | null = null

      const animate = (timestamp: number) => {
        if (transitionId !== transitionIdRef.current) return

        startTime ??= timestamp
        const progress = Math.min((timestamp - startTime) / ONBOARDING_TRANSITION_DURATION, 1)
        const nextX = startX + (targetX - startX) * ease(progress)

        scrollX.setValue(nextX)
        scrollViewRef.current?.scrollTo({ x: nextX, animated: false })

        if (progress < 1) {
          transitionFrameRef.current = requestAnimationFrame(animate)
        } else {
          transitionFrameRef.current = null
        }
      }

      transitionFrameRef.current = requestAnimationFrame(animate)
    })
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
      <View style={styles.carousel}>
        <View style={styles.imageSection}>
          <View style={[styles.imageFrame, { height: Math.min(height * 0.42, 400) }]}>
            {slides.map((slide, index) => (
              <Animated.View
                key={slide.title}
                style={[
                  styles.imageLayer,
                  {
                    opacity: scrollX.interpolate({
                      inputRange: [(index - 1) * width, index * width, (index + 1) * width],
                      outputRange: [0, 1, 0],
                      extrapolate: 'clamp',
                    }),
                  },
                ]}
              >
                <Image
                  source={typeof slide.image === 'string' ? { uri: slide.image } : slide.image}
                  resizeMode="cover"
                  style={styles.image}
                />
              </Animated.View>
            ))}
          </View>
        </View>

        <Animated.ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          decelerationRate="normal"
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
          onScrollBeginDrag={stopSlideTransition}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
            useNativeDriver: false,
          })}
          onMomentumScrollEnd={handleScrollEnd}
          style={styles.copyCarousel}
        >
          {slides.map((slide) => (
            <View key={slide.title} style={[styles.copySlide, { width }]}>
              <View style={styles.copy}>
                <Text style={styles.title}>{slide.title}</Text>
                <Text style={styles.description}>{slide.description}</Text>
              </View>
            </View>
          ))}
        </Animated.ScrollView>
      </View>

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
  imageSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  imageFrame: {
    width: '100%',
    maxHeight: 400,
    borderRadius: radius.large,
    borderWidth: 1,
    borderColor: '#E2E2E2',
    backgroundColor: '#F8F8F8',
    overflow: 'hidden',
  },
  imageLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  copyCarousel: {
    flex: 1,
  },
  copySlide: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
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
