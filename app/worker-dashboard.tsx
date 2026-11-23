import Feather from "@expo/vector-icons/Feather";
import { BlurTargetView, BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Href, useLocalSearchParams, useRouter } from "expo-router";
import { type ComponentRef, useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, Modal, Pressable, RefreshControl, ScrollView, type ScrollViewInstance, StyleSheet, useWindowDimensions, View } from "react-native";
import { AppText as Text } from "../src/components/AppText";
import { AppHeader } from "../src/components/AppHeader";
import { CompactJobCard } from "../src/components/CompactJobCard";
import { interactiveCardShadow } from "../src/styles";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import LocationMap from "../src/components/LocationMap";
import { StatusBadge } from "../src/components/StatusBadge";
import { TaskMapPreview } from "../src/components/TaskMapPreview";
import { VerificationOnboarding, VerificationReminder } from "../src/components/VerificationOnboarding";
import { useApp } from "../src/context/AppContext";
import { usePullToRefresh } from "../src/hooks/usePullToRefresh";
import { formatTaskPrice, getScheduleBasedAvailability } from "../src/domain/taskMarketplace";
import { rankTasksForWorker } from "../src/domain/matching";
import { Task } from "../src/types";
import { isTaskOpenForApplications } from "../src/domain/taskExpiry";

const palette = {
  background: "#F7FAF8",
  surface: "#FFFFFF",
  surfaceLow: "#F1F4F3",
  surfaceContainer: "#EBEFED",
  primary: "#005C55",
  secondary: "#855300",
  secondaryContainer: "#FEA619",
  text: "#181C1C",
  textStrong: "#111827",
  muted: "#3E4947",
  outline: "#6E7977",
  outlineVariant: "#BDC9C6",
  success: "#10B981",
  white: "#FFFFFF"
};

const TAB_ROW_PADDING = 4;
const TAB_ROW_GAP = 8;
const TOP_OPPORTUNITY_PAGE_SIZE = 5;
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);
type MapOverlayRect = { x: number; y: number; width: number; height: number };

export default function WorkerDashboardScreen() {
  const router = useRouter();
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const [selectedTab, setSelectedTab] = useState<"active" | "finished">("active");
  const [applicationsOverlayOpen, setApplicationsOverlayOpen] = useState(false);
  const [applicationsOverlayClosing, setApplicationsOverlayClosing] = useState(false);
  const [finishedExpanded, setFinishedExpanded] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [mapOverlayClosing, setMapOverlayClosing] = useState(false);
  const [mapOverlayMapReady, setMapOverlayMapReady] = useState(false);
  const [mapOverlayOrigin, setMapOverlayOrigin] = useState<MapOverlayRect>();
  const [mapOverlayViewport, setMapOverlayViewport] = useState<{ width: number; height: number }>();
  const [selectedMapTaskId, setSelectedMapTaskId] = useState<string>();
  const [actionMessage, setActionMessage] = useState("");
  const [tabRowWidth, setTabRowWidth] = useState(0);
  const [bestFitCardHeight, setBestFitCardHeight] = useState(0);
  const [visibleTopOpportunityCount, setVisibleTopOpportunityCount] = useState(TOP_OPPORTUNITY_PAGE_SIZE);
  const tabPosition = useRef(new Animated.Value(0)).current;
  const bestFitBorderRotation = useRef(new Animated.Value(0)).current;
  const bestFitBadgeRotation = useRef(new Animated.Value(0)).current;
  const applicationsOverlayScale = useRef(new Animated.Value(0.82)).current;
  const applicationsOverlayClosingRef = useRef(false);
  const mapOverlayClosingRef = useRef(false);
  const mapOverlayProgress = useRef(new Animated.Value(0)).current;
  const mapPanelRef = useRef<ComponentRef<typeof View>>(null);
  const applicationBlurTargetRef = useRef<ComponentRef<typeof View>>(null);
  const homeScrollRef = useRef<ScrollViewInstance>(null);
  const { height: viewportHeight, width: viewportWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { actionLoading, currentUser, tasks, ratings, acceptTask, retryDataSync } = useApp();
  const { onRefresh, refreshing } = usePullToRefresh(retryDataSync);
  const postedTasks = tasks.filter(isTaskOpenForApplications);
  const rankedPostedTasks = currentUser ? rankTasksForWorker(postedTasks, currentUser) : [];
  const acceptedTasks = tasks.filter(
    (task) =>
      task.applicantIds?.includes(currentUser?.id ?? "") &&
      (task.status === "Applied" || task.workerId === currentUser?.id) &&
      task.status !== "Finished" &&
      task.status !== "Archived"
  );
  const finishedTasks = tasks.filter(
    (task) => task.workerId === currentUser?.id && (task.status === "Finished" || task.status === "Archived")
  );
  const smartMatches = rankedPostedTasks.filter(({ match }) => match.eligible);
  const bestFitJobs = rankedPostedTasks.filter(({ match }) => match.eligible && match.score >= 90);
  const bestFitTaskIds = new Set(bestFitJobs.map(({ task }) => task.id));
  const topOpportunityJobs = rankedPostedTasks.filter(({ task }) => !bestFitTaskIds.has(task.id));
  const visibleTopOpportunityJobs = topOpportunityJobs.slice(0, visibleTopOpportunityCount);
  const bestFitCardWidth = Math.min(312, Math.max(240, viewportWidth - 86));
  const bestFitLayoutKey = bestFitJobs.map(({ task, match }) => `${task.id}:${task.title}:${task.category}:${match.score}`).join("|");
  const visibleFinishedTasks = finishedExpanded ? finishedTasks : finishedTasks.slice(0, 3);
  const tabWidth = Math.max(0, (tabRowWidth - TAB_ROW_PADDING * 2 - TAB_ROW_GAP) / 2);
  const mapOverlayViewportWidth = mapOverlayViewport?.width ?? viewportWidth;
  const mapOverlayViewportHeight = mapOverlayViewport?.height ?? viewportHeight;
  const mapOverlayTargetWidth = Math.min(720, Math.max(0, mapOverlayViewportWidth - 32));
  const mapOverlayTargetHeight = Math.min(640, Math.max(320, mapOverlayViewportHeight - 64));
  const mapOverlayTarget: MapOverlayRect = {
    x: (mapOverlayViewportWidth - mapOverlayTargetWidth) / 2,
    y: (mapOverlayViewportHeight - mapOverlayTargetHeight) / 2,
    width: mapOverlayTargetWidth,
    height: mapOverlayTargetHeight
  };
  const mapOverlayTranslateX = mapOverlayOrigin
    ? mapOverlayOrigin.x + mapOverlayOrigin.width / 2 - (mapOverlayTarget.x + mapOverlayTarget.width / 2)
    : 0;
  const mapOverlayTranslateY = mapOverlayOrigin
    ? mapOverlayOrigin.y + mapOverlayOrigin.height / 2 - (mapOverlayTarget.y + mapOverlayTarget.height / 2)
    : 0;
  const mapOverlayScaleX = mapOverlayOrigin && mapOverlayTarget.width > 0
    ? mapOverlayOrigin.width / mapOverlayTarget.width
    : 1;
  const mapOverlayScaleY = mapOverlayOrigin && mapOverlayTarget.height > 0
    ? mapOverlayOrigin.height / mapOverlayTarget.height
    : 1;

  useEffect(() => {
    setBestFitCardHeight(0);
  }, [bestFitCardWidth, bestFitLayoutKey]);

  useEffect(() => {
    const animation = Animated.timing(tabPosition, {
      toValue: selectedTab === "active" ? 0 : 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    });
    animation.start();
    return () => animation.stop();
  }, [selectedTab, tabPosition]);

  useEffect(() => {
    if (!bestFitJobs.length) {
      bestFitBorderRotation.setValue(0);
      bestFitBadgeRotation.setValue(0);
      return () => undefined;
    }
    bestFitBorderRotation.setValue(0);
    bestFitBadgeRotation.setValue(0);
    const cardBorderAnimation = Animated.loop(
      Animated.timing(bestFitBorderRotation, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true
      })
    );
    const badgeBorderAnimation = Animated.loop(
      Animated.timing(bestFitBadgeRotation, {
        toValue: 1,
        duration: 2200,
        easing: Easing.linear,
        useNativeDriver: true
      })
    );
    cardBorderAnimation.start();
    badgeBorderAnimation.start();
    return () => {
      cardBorderAnimation.stop();
      badgeBorderAnimation.stop();
    };
  }, [bestFitBadgeRotation, bestFitBorderRotation, bestFitJobs.length]);

  useEffect(() => {
    if (!applicationsOverlayOpen) return;
    applicationsOverlayScale.setValue(0.82);
    const animation = Animated.sequence([
      Animated.timing(applicationsOverlayScale, {
        toValue: 1.045,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.spring(applicationsOverlayScale, {
        toValue: 1,
        friction: 5,
        tension: 140,
        useNativeDriver: true
      })
    ]);
    animation.start();
    return () => animation.stop();
  }, [applicationsOverlayOpen, applicationsOverlayScale]);

  useEffect(() => () => applicationsOverlayScale.stopAnimation(), [applicationsOverlayScale]);

  useEffect(() => {
    if (!mapFullscreen || !mapOverlayOrigin || !mapOverlayViewport) return;
    let animation: Animated.CompositeAnimation | undefined;
    const frame = requestAnimationFrame(() => {
      animation = Animated.timing(mapOverlayProgress, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      });
      animation.start(({ finished }) => {
        if (finished && !mapOverlayClosingRef.current) setMapOverlayMapReady(true);
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      animation?.stop();
    };
  }, [mapFullscreen, mapOverlayOrigin, mapOverlayProgress, mapOverlayViewport]);

  useEffect(() => () => mapOverlayProgress.stopAnimation(), [mapOverlayProgress]);

  function openApplicationsOverlay() {
    if (applicationsOverlayClosingRef.current) return;
    applicationsOverlayClosingRef.current = false;
    setApplicationsOverlayClosing(false);
    setApplicationsOverlayOpen(true);
  }

  function closeApplicationsOverlay(onClosed?: () => void) {
    if (applicationsOverlayClosingRef.current) return;
    applicationsOverlayClosingRef.current = true;
    setApplicationsOverlayClosing(true);
    applicationsOverlayScale.stopAnimation();
    Animated.sequence([
      Animated.timing(applicationsOverlayScale, {
        toValue: 1.035,
        duration: 80,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(applicationsOverlayScale, {
        toValue: 0.82,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true
      })
    ]).start(({ finished }) => {
      if (!finished) return;
      setApplicationsOverlayOpen(false);
      setApplicationsOverlayClosing(false);
      applicationsOverlayClosingRef.current = false;
      onClosed?.();
    });
  }

  function refreshHomepage() {
    homeScrollRef.current?.scrollTo({ animated: true, y: 0 });
    onRefresh();
  }

  function openMapOverlay() {
    if (mapOverlayClosingRef.current) return;
    const showOverlay = (origin: MapOverlayRect) => {
      mapOverlayClosingRef.current = false;
      setMapOverlayClosing(false);
      setMapOverlayMapReady(false);
      setMapOverlayViewport(undefined);
      setMapOverlayOrigin(origin);
      mapOverlayProgress.setValue(0);
      setMapFullscreen(true);
    };
    const fallbackOrigin: MapOverlayRect = {
      x: 16,
      y: Math.max(insets.top + 16, (viewportHeight - 208) / 2),
      width: Math.max(0, viewportWidth - 32),
      height: 208
    };
    if (!mapPanelRef.current) {
      showOverlay(fallbackOrigin);
      return;
    }
    mapPanelRef.current.measureInWindow((x, y, width, height) => {
      showOverlay(width > 0 && height > 0 ? { x, y, width, height } : fallbackOrigin);
    });
  }

  function closeMapOverlay() {
    if (mapOverlayClosingRef.current) return;
    mapOverlayClosingRef.current = true;
    setMapOverlayClosing(true);
    setMapOverlayMapReady(false);
    mapOverlayProgress.stopAnimation();
    Animated.timing(mapOverlayProgress, {
      toValue: 0,
      duration: 240,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true
    }).start(({ finished }) => {
      if (!finished) return;
      setMapFullscreen(false);
      setMapOverlayOrigin(undefined);
      setMapOverlayViewport(undefined);
      setMapOverlayClosing(false);
      mapOverlayClosingRef.current = false;
    });
  }
  const workerMapCenter = currentUser?.serviceAreaLatitude !== undefined && currentUser.serviceAreaLongitude !== undefined
    ? { latitude: currentUser.serviceAreaLatitude, longitude: currentUser.serviceAreaLongitude }
    : currentUser?.currentLatitude !== undefined && currentUser.currentLongitude !== undefined
      ? { latitude: currentUser.currentLatitude, longitude: currentUser.currentLongitude }
      : undefined;
  const workerMapMarkers = postedTasks.flatMap((task) => task.latitude !== undefined && task.longitude !== undefined
    ? [{ id: task.id, latitude: task.latitude, longitude: task.longitude, title: task.title }]
    : []);
  const selectedMapTask = postedTasks.find((task) => task.id === selectedMapTaskId);

  async function handleQuickApply(task: Task) {
    try {
      setActionMessage("");
      await acceptTask(task.id);
      router.push(`/task-status/${task.id}`);
    } catch (applyError) {
      setActionMessage(applyError instanceof Error ? applyError.message : "Unable to submit this application.");
    }
  }

  return (
    <>
      <BlurTargetView ref={applicationBlurTargetRef} style={styles.blurTarget}>
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <AppHeader onHomeRefresh={refreshHomepage} />
      <ScrollView
        ref={homeScrollRef}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl colors={[palette.primary]} onRefresh={onRefresh} refreshing={refreshing} tintColor={palette.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.welcomeRow}>
          <View style={styles.welcomeCopy}>
            <Text numberOfLines={1} style={styles.welcomeTitle} variant="screenTitle">Welcome back, {currentUser?.fullName?.split(" ")[0] ?? "there"}.</Text>
            <Text numberOfLines={1} style={styles.welcomeLocation} variant="metadata">{currentUser?.address || "Location not set"}</Text>
          </View>
          <View accessible accessibilityLabel={`Availability: ${currentUser ? getScheduleBasedAvailability(tasks, currentUser.id) : "Not set"}`} style={styles.availabilityPill}>
            <Text style={styles.availabilityText} variant="badge">{currentUser ? getScheduleBasedAvailability(tasks, currentUser.id) : "Not set"}</Text>
          </View>
        </View>

        <VerificationReminder
          user={currentUser}
          onContinue={() => router.push("/profile-manage?section=verification" as Href)}
        />

        <View style={styles.statsGrid}>
          <StatCard label="Open Jobs" value={String(postedTasks.length).padStart(2, "0")} />
          <StatCard label="Applications" value={String(acceptedTasks.length).padStart(2, "0")} />
        </View>

        <View onLayout={(event) => setTabRowWidth(event.nativeEvent.layout.width)} style={styles.tabRow}>
          {tabWidth > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.tabHighlight,
                {
                  left: TAB_ROW_PADDING,
                  width: tabWidth,
                  transform: [{
                    translateX: tabPosition.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, tabWidth + TAB_ROW_GAP]
                    })
                  }]
                }
              ]}
            />
          ) : null}
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: selectedTab === "active" }}
            onPress={() => setSelectedTab("active")}
            style={styles.tabButton}
          >
            <Text style={[styles.tabButtonText, selectedTab === "active" && styles.tabButtonTextActive]}>Active</Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: selectedTab === "finished" }}
            onPress={() => setSelectedTab("finished")}
            style={styles.tabButton}
          >
            <Text style={[styles.tabButtonText, selectedTab === "finished" && styles.tabButtonTextActive]}>Finished</Text>
          </Pressable>
        </View>

        {selectedTab === "active" ? (
          <View style={styles.applicationSection}>
            <Pressable
              accessibilityLabel={`Open My Applications, ${acceptedTasks.length} active`}
              accessibilityRole="button"
              accessibilityState={{ expanded: applicationsOverlayOpen }}
              onPress={openApplicationsOverlay}
              style={({ pressed }) => [styles.applicationHeader, pressed && styles.pressed]}
            >
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionTitle}>My Applications</Text>
                <Text style={styles.sectionSubtitle}>{acceptedTasks.length} active</Text>
              </View>
              <Feather accessibilityElementsHidden color={palette.primary} name="chevron-right" size={24} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.historyPanel}>
            <View style={styles.historyHeader}>
              <View>
                <Text style={styles.historyTitle}>Finished Jobs</Text>
                <Text style={styles.historyMeta}>{finishedTasks.length} completed</Text>
              </View>
              {finishedTasks.length > 3 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: finishedExpanded }}
                  onPress={() => setFinishedExpanded((expanded) => !expanded)}
                  style={({ pressed }) => [styles.historyViewAllButton, pressed && styles.pressed]}
                >
                  <Text style={styles.viewAllText}>{finishedExpanded ? "Show Less" : "View All"}</Text>
                </Pressable>
              ) : null}
            </View>
            {finishedTasks.length ? (
              <View style={styles.historyList}>
                {visibleFinishedTasks.map((task) => (
                    <HistoryRow
                      key={task.id}
                      task={task}
                      rated={ratings.some((rating) => rating.taskId === task.id && rating.reviewerId === currentUser?.id)}
                      onOpen={() => router.push(`/task-status/${task.id}`)}
                      onChat={() => router.push(`/chat/${task.id}`)}
                      onRate={() => router.push(`/rating/${task.id}`)}
                    />
                ))}
              </View>
            ) : (
              <View style={styles.emptyHistoryRow}>
                <Text style={styles.emptyApplicationText}>Finished jobs will appear here after both sides confirm completion.</Text>
              </View>
            )}
          </View>
        )}

        <View collapsable={false} ref={mapPanelRef} style={styles.mapPanel}>
          <LocationMap
            center={workerMapCenter}
            interactive
            markers={workerMapMarkers}
            onMarkerPress={(marker) => setSelectedMapTaskId(marker.id)}
            showLayerSwitcher={false}
            height={208}
          />
          <View style={styles.locationBadge}>
            <Text style={styles.locationText}>{smartMatches.length} job matches near you</Text>
          </View>
          <Pressable accessibilityLabel="Open expanded map" accessibilityRole="button" hitSlop={6} onPress={openMapOverlay} style={styles.expandMapButton}>
            <Image
              accessibilityIgnoresInvertColors
              source={require("../assets/full-screen.png")}
              style={styles.expandMapIcon}
            />
          </Pressable>
          <TaskMapPreview
            onDismiss={() => setSelectedMapTaskId(undefined)}
            onViewTask={(task) => router.push(`/task/${task.id}`)}
            style={styles.mapTaskPreview}
            task={selectedMapTask}
          />
        </View>

        {bestFitJobs.length ? (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionTitle}>Fits You Best</Text>
                <Text style={styles.sectionSubtitle}>Jobs matching 90% or more of your profile</Text>
              </View>
            </View>
            <ScrollView
              contentContainerStyle={styles.bestFitRow}
              horizontal
              removeClippedSubviews={false}
              showsHorizontalScrollIndicator={false}
              style={styles.bestFitScroll}
            >
              {bestFitJobs.map(({ task, match }) => (
                <View
                  key={task.id}
                  onLayout={(event) => {
                    const measuredHeight = Math.ceil(event.nativeEvent.layout.height);
                    setBestFitCardHeight((currentHeight) => measuredHeight > currentHeight ? measuredHeight : currentHeight);
                  }}
                  style={[styles.bestFitCardFrame, { minHeight: bestFitCardHeight || undefined, width: bestFitCardWidth }]}
                >
                  <View style={styles.bestFitCrystalShadow}>
                    <View style={styles.bestFitCrystalFrame}>
                      <AnimatedLinearGradient
                        colors={["#003F3B", "#5BEBD9", "#FFFFFF", "#00D8C2", "#7C8F95", "#FFFFFF", "#00BFA9", "#264E55", "#FFFFFF", "#003F3B"]}
                        end={{ x: 1, y: 1 }}
                        locations={[0, 0.1, 0.18, 0.3, 0.42, 0.5, 0.64, 0.74, 0.86, 1]}
                        pointerEvents="none"
                        start={{ x: 0, y: 0 }}
                        style={[
                          styles.bestFitCrystalGradient,
                          {
                            transform: [
                              { scale: 4 },
                              {
                                rotate: bestFitBorderRotation.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: ["0deg", "360deg"]
                                })
                              }
                            ]
                          }
                        ]}
                      />
                      <CompactJobCard
                        task={task}
                        match={match}
                        showMatchBadge
                        onOpen={() => router.push(`/task/${task.id}`)}
                        onQuickApply={() => task.pricingMode === "bidding" ? router.push(`/task/${task.id}`) : handleQuickApply(task)}
                        onApplicationStatus={() => router.push(`/task-status/${task.id}`)}
                        applying={actionLoading}
                        hasApplied={task.applicantIds?.includes(currentUser?.id ?? "") ?? false}
                        style={styles.bestFitCard}
                      />
                    </View>
                    <View accessibilityLabel="Best Match" accessible pointerEvents="none" style={styles.bestFitBadgeAnchor}>
                      <View style={styles.bestFitBadgeGlow}>
                        <View style={styles.bestFitBadgeFrame}>
                          <AnimatedLinearGradient
                            colors={["#003F3B", "#51F0DE", "#FFFFFF", "#7C8F95", "#FFFFFF", "#00C7B2", "#003F3B"]}
                            end={{ x: 1, y: 1 }}
                            pointerEvents="none"
                            start={{ x: 0, y: 0 }}
                            style={[
                              styles.bestFitBadgeBorderGradient,
                              {
                                transform: [
                                  { scale: 4 },
                                  {
                                    rotate: bestFitBadgeRotation.interpolate({
                                      inputRange: [0, 1],
                                      outputRange: ["0deg", "360deg"]
                                    })
                                  }
                                ]
                              }
                            ]}
                          />
                          <View style={styles.bestFitBadgeInner}>
                            <AnimatedLinearGradient
                              colors={["#F8FFFF", "#A9F5EA", "#FFFFFF", "#8DE7DC", "#F8FFFF"]}
                              end={{ x: 0.5, y: 1 }}
                              pointerEvents="none"
                              start={{ x: 0.5, y: 0 }}
                              style={[
                                styles.bestFitBadgeBackgroundGradient,
                                {
                                  transform: [
                                    { scale: 4 },
                                    {
                                      rotate: bestFitBadgeRotation.interpolate({
                                      inputRange: [0, 1],
                                        outputRange: ["0deg", "360deg"]
                                      })
                                    }
                                  ]
                                }
                              ]}
                            />
                            <Feather accessibilityElementsHidden color={palette.primary} name="award" size={13} />
                            <Text style={styles.bestFitFloatingBadgeText}>Best Match</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          </>
        ) : null}

        <LinearGradient
          colors={["rgba(0,92,85,0.16)", "rgba(0,92,85,0.06)", "rgba(0,92,85,0)"]}
          end={{ x: 0.5, y: 1 }}
          locations={[0, 0.58, 1]}
          start={{ x: 0.5, y: 0 }}
          style={[styles.topOpportunitiesSection, bestFitJobs.length ? styles.topOpportunitiesAfterBestFit : undefined]}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>Top Opportunities</Text>
              <Text style={styles.sectionSubtitle}>More open jobs ranked for you</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => router.push("/jobs")} style={styles.viewAllButton}>
              <Text style={styles.viewAllText}>View All</Text>
            </Pressable>
          </View>

          <View style={styles.jobGrid}>
            {visibleTopOpportunityJobs.length ? (
              visibleTopOpportunityJobs.map(({ task, match }) => (
                <CompactJobCard
                  key={task.id}
                  task={task}
                  match={match}
                  showMatchBadge={match.eligible}
                  onOpen={() => router.push(`/task/${task.id}`)}
                  onQuickApply={() => task.pricingMode === "bidding" ? router.push(`/task/${task.id}`) : handleQuickApply(task)}
                  onApplicationStatus={() => router.push(`/task-status/${task.id}`)}
                  applying={actionLoading}
                  hasApplied={task.applicantIds?.includes(currentUser?.id ?? "") ?? false}
                />
              ))
            ) : (
              <View style={styles.emptyApplicationCard}>
                <Text style={styles.emptyApplicationTitle}>{bestFitJobs.length ? "Your strongest matches are shown above" : "No open opportunities yet"}</Text>
                <Text style={styles.emptyApplicationText}>{bestFitJobs.length ? "More opportunities will appear here as employers post new tasks." : "New tasks near you will appear here as employers post them."}</Text>
              </View>
            )}
          </View>

          {topOpportunityJobs.length > visibleTopOpportunityJobs.length ? (
            <View style={styles.loadMoreDividerRow}>
              <View style={styles.loadMoreDividerLine} />
              <Pressable
                accessibilityLabel={`Load ${Math.min(TOP_OPPORTUNITY_PAGE_SIZE, topOpportunityJobs.length - visibleTopOpportunityJobs.length)} more opportunities`}
                accessibilityRole="button"
                onPress={() => setVisibleTopOpportunityCount((count) => count + TOP_OPPORTUNITY_PAGE_SIZE)}
                style={({ pressed }) => [styles.loadMoreButton, pressed && styles.pressed]}
              >
                <Text style={styles.loadMoreText}>Load more</Text>
              </Pressable>
              <View style={styles.loadMoreDividerLine} />
            </View>
          ) : null}
        </LinearGradient>

        {actionMessage ? <Text accessibilityRole="alert" style={styles.actionMessage}>{actionMessage}</Text> : null}

      </ScrollView>
        </SafeAreaView>
      </BlurTargetView>
      <VerificationOnboarding
        autoOpen={onboarding === "verification"}
        user={currentUser}
        onDismiss={() => router.replace("/worker-dashboard")}
        onContinue={() => router.replace("/profile-manage?section=verification" as Href)}
      />
      <Modal
        animationType="none"
        onRequestClose={closeMapOverlay}
        statusBarTranslucent
        transparent
        visible={mapFullscreen}
      >
        <View
          accessibilityViewIsModal
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setMapOverlayViewport((current) => current?.width === width && current.height === height ? current : { width, height });
          }}
          pointerEvents={mapOverlayClosing ? "none" : "auto"}
          style={styles.mapOverlayRoot}
        >
          <Animated.View
            pointerEvents="none"
            style={[styles.mapOverlayFill, { opacity: mapOverlayProgress }]}
          >
            <BlurView
              blurMethod="dimezisBlurViewSdk31Plus"
              blurReductionFactor={1}
              blurTarget={applicationBlurTargetRef}
              intensity={42}
              style={styles.mapOverlayFill}
              tint="dark"
            />
          </Animated.View>
          <Animated.View style={[styles.mapOverlayBackdrop, { opacity: mapOverlayProgress }]}>
            <Pressable
              accessibilityLabel="Close expanded map"
              accessibilityRole="button"
              onPress={closeMapOverlay}
              style={styles.mapOverlayFill}
            />
          </Animated.View>
          {mapOverlayOrigin ? (
            <Animated.View
              accessibilityLabel="Expanded nearby jobs map"
              accessibilityRole="summary"
              style={[
                styles.mapOverlaySurface,
                {
                  left: mapOverlayTarget.x,
                  top: mapOverlayTarget.y,
                  width: mapOverlayTarget.width,
                  height: mapOverlayTarget.height,
                  transform: [
                    {
                      translateX: mapOverlayProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [mapOverlayTranslateX, 0]
                      })
                    },
                    {
                      translateY: mapOverlayProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [mapOverlayTranslateY, 0]
                      })
                    },
                    {
                      scaleX: mapOverlayProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [mapOverlayScaleX, 1]
                      })
                    },
                    {
                      scaleY: mapOverlayProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [mapOverlayScaleY, 1]
                      })
                    }
                  ]
                }
              ]}
            >
              {mapOverlayMapReady ? (
                <>
                  <LocationMap
                    center={workerMapCenter}
                    fitToMarkers
                    interactive
                    markers={workerMapMarkers}
                    onMarkerPress={(marker) => setSelectedMapTaskId(marker.id)}
                    expandedControls
                    height={mapOverlayTarget.height}
                  />
                  <View style={styles.mapOverlayCloseWrap}>
                    <Pressable
                      accessibilityLabel="Close expanded map"
                      accessibilityRole="button"
                      onPress={closeMapOverlay}
                      style={({ pressed }) => [styles.closeMapButton, pressed && styles.closeMapButtonPressed]}
                    >
                      <Feather accessibilityElementsHidden color="#BA1A1A" name="x" size={25} />
                    </Pressable>
                  </View>
                  <TaskMapPreview
                    onDismiss={() => setSelectedMapTaskId(undefined)}
                    onViewTask={(task) => {
                      closeMapOverlay();
                      router.push(`/task/${task.id}`);
                    }}
                    style={styles.mapOverlayTaskPreview}
                    task={selectedMapTask}
                  />
                </>
              ) : (
                <View accessibilityLabel="Expanding map" accessibilityRole="progressbar" style={styles.mapOverlayPlaceholder} />
              )}
            </Animated.View>
          ) : null}
        </View>
      </Modal>
      <Modal
        animationType="none"
        onRequestClose={() => closeApplicationsOverlay()}
        statusBarTranslucent
        transparent
        visible={applicationsOverlayOpen}
      >
        <View
          accessibilityViewIsModal
          pointerEvents={applicationsOverlayClosing ? "none" : "auto"}
          style={styles.applicationsOverlayRoot}
        >
          <BlurView
            blurMethod="dimezisBlurViewSdk31Plus"
            blurReductionFactor={1}
            blurTarget={applicationBlurTargetRef}
            intensity={42}
            pointerEvents="none"
            style={styles.applicationsOverlayFill}
            tint="dark"
          />
          <Pressable
            accessibilityLabel="Close My Applications"
            accessibilityRole="button"
            onPress={() => closeApplicationsOverlay()}
            style={styles.applicationsOverlayBackdrop}
          />
          <Animated.View
            style={[
              styles.applicationsOverlaySurface,
              {
                opacity: applicationsOverlayScale.interpolate({
                  inputRange: [0.82, 1],
                  outputRange: [0, 1],
                  extrapolate: "clamp"
                }),
                transform: [{ scale: applicationsOverlayScale }]
              }
            ]}
          >
            <View style={styles.applicationsOverlayHeader}>
              <View style={styles.applicationsOverlayTitleGroup}>
                <Text style={styles.applicationsOverlayTitle}>My Applications</Text>
                <Text style={styles.applicationsOverlayMeta}>{acceptedTasks.length} active</Text>
              </View>
              <Pressable
                accessibilityLabel="Close My Applications"
                accessibilityRole="button"
                onPress={() => closeApplicationsOverlay()}
                style={({ pressed }) => [styles.applicationsOverlayClose, pressed && styles.applicationsOverlayClosePressed]}
              >
                <Feather accessibilityElementsHidden color="#BA1A1A" name="x" size={24} />
              </Pressable>
            </View>
            <View style={styles.applicationsOverlayBody}>
              <ScrollView
                contentContainerStyle={styles.applicationsOverlayList}
                showsVerticalScrollIndicator={false}
                style={styles.applicationsOverlayScroll}
              >
                {acceptedTasks.length ? (
                  acceptedTasks.map((task) => (
                    <ApplicationCard
                      key={task.id}
                      task={task}
                      onOpen={() => closeApplicationsOverlay(() => router.push(`/task-status/${task.id}`))}
                    />
                  ))
                ) : (
                  <View style={styles.emptyApplicationCard}>
                    <Text style={styles.emptyApplicationTitle}>No applications yet</Text>
                    <Text style={styles.emptyApplicationText}>Apply to a job and it will appear here while the client reviews it.</Text>
                  </View>
                )}
              </ScrollView>
              <View pointerEvents="none" style={styles.applicationsOverlayTopFade}>
                <LinearGradient
                  colors={["rgba(233,237,240,0.98)", "rgba(233,237,240,0.58)", "rgba(233,237,240,0)"]}
                  locations={[0, 0.42, 1]}
                  pointerEvents="none"
                  style={styles.applicationsOverlayFill}
                />
              </View>
              <View pointerEvents="none" style={styles.applicationsOverlayBottomFade}>
                <LinearGradient
                  colors={["rgba(233,237,240,0)", "rgba(233,237,240,0.58)", "rgba(233,237,240,0.98)"]}
                  locations={[0, 0.58, 1]}
                  pointerEvents="none"
                  style={styles.applicationsOverlayFill}
                />
              </View>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

function ApplicationCard({ task, onOpen }: { task: Task; onOpen: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.applicationCard, pressed && styles.pressed]}>
      <View style={styles.applicationTop}>
        <View style={styles.applicationCopy}>
          <Text style={styles.applicationTitle}>{task.title}</Text>
          <Text style={styles.applicationMeta}>{getApplicationMessage(task.status)}</Text>
        </View>
        <Text style={styles.applicationPrice}>{formatTaskPrice(task)}</Text>
      </View>
      <View style={styles.applicationFooter}>
        <StatusBadge status={task.status} />
        <Text style={styles.applicationAction}>{getApplicationAction(task.status)}</Text>
      </View>
    </Pressable>
  );
}

function getApplicationMessage(status: Task["status"]) {
  if (status === "Applied") {
    return "Waiting for the client to accept your application.";
  }

  if (status === "Accepted") {
    return "Application accepted. You can start this task.";
  }

  if (status === "In Progress") {
    return "Task is in progress.";
  }

  if (status === "Pending Approval") {
    return "Waiting for client completion approval.";
  }

  return "Open this task for details.";
}

function getApplicationAction(status: Task["status"]) {
  if (status === "Accepted") {
    return "Start Task";
  }

  if (status === "In Progress") {
    return "Mark Finished";
  }

  if (status === "Pending Approval") {
    return "Pending Approval";
  }

  return "View Status";
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function HistoryRow({
  task,
  rated,
  onOpen,
  onChat,
  onRate
}: {
  task: Task;
  rated?: boolean;
  onOpen: () => void;
  onChat?: () => void;
  onRate?: () => void;
}) {
  return (
    <View style={styles.historyCard}>
      <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}>
        <View style={styles.historyIcon}>
          <Text style={styles.historyIconText}>OK</Text>
        </View>
        <View style={styles.historyCopy}>
          <Text style={styles.historyJobTitle}>{task.title}</Text>
          <Text style={styles.historyJobMeta}>{task.location}</Text>
        </View>
        <Text style={styles.historyAmount}>{formatTaskPrice(task)}</Text>
      </Pressable>
      <View style={styles.historyDivider} />
      {onChat || onRate ? (
        <View style={styles.historyActions}>
          {onChat ? (
            <Pressable accessibilityRole="button" onPress={onChat} style={styles.historyActionButton}>
              <Text style={styles.historyActionButtonText}>Chat</Text>
            </Pressable>
          ) : null}
          {onRate ? (
            <Pressable
              accessibilityRole="button"
              disabled={rated}
              onPress={onRate}
              style={({ pressed }) => [
                styles.historyActionButtonPrimary,
                rated && styles.historyActionButtonDisabled,
                pressed && !rated && styles.pressed
              ]}
            >
              <Text style={[styles.historyActionButtonPrimaryText, rated && styles.historyActionButtonPrimaryTextDisabled]}>
                {rated ? "Client Rated" : "Rate Client"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  blurTarget: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { padding: 16, paddingBottom: 110, gap: 14 },
  welcomeRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12 },
  welcomeCopy: { flex: 1, minWidth: 0, gap: 3 },
  welcomeTitle: { color: palette.textStrong },
  welcomeLocation: { color: palette.muted },
  availabilityPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "#A3FAEF" },
  availabilityText: { color: palette.primary },
  statsGrid: { flexDirection: "row", gap: 12 },
  statCard: { flex: 1, borderRadius: 12, padding: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.outlineVariant },
  statValue: { color: palette.primary, fontSize: 24, lineHeight: 32, fontWeight: "900" },
  statLabel: { color: palette.muted, fontSize: 12, lineHeight: 16, marginTop: 4 },
  mapPanel: { height: 208, borderRadius: 12, overflow: "hidden", position: "relative", backgroundColor: "#DDEDEA", elevation: 2 },
  mapTaskPreview: { position: "absolute", left: 12, right: 116, top: 12, zIndex: 3 },
  mapOverlayRoot: { flex: 1 },
  mapOverlayFill: { position: "absolute", inset: 0 },
  mapOverlayBackdrop: { position: "absolute", inset: 0, backgroundColor: "rgba(35,43,48,0.14)" },
  mapOverlaySurface: { position: "absolute", overflow: "hidden", borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.72)", backgroundColor: "#FFFFFF", shadowColor: "#111827", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 10 },
  mapOverlayPlaceholder: { flex: 1, backgroundColor: "#FFFFFF" },
  mapOverlayCloseWrap: { position: "absolute", right: 12, top: 12 },
  mapOverlayTaskPreview: { position: "absolute", bottom: 16, left: 16, right: 76, zIndex: 3 },
  mapGrid: { flex: 1, backgroundColor: "#E7F3F0" },
  mapLineHorizontal: { position: "absolute", left: -20, right: -20, top: 58, height: 14, backgroundColor: "#C8DBD7", transform: [{ rotate: "-10deg" }] },
  mapLineVertical: { position: "absolute", top: -20, bottom: -20, left: "56%", width: 16, backgroundColor: "#D6C29E", transform: [{ rotate: "18deg" }] },
  mapPin: { position: "absolute", width: 16, height: 16, borderRadius: 8, backgroundColor: palette.secondary, borderWidth: 3, borderColor: palette.white },
  mapPinOne: { left: "24%", top: 42 },
  mapPinTwo: { left: "62%", top: 72, backgroundColor: palette.primary },
  locationBadge: { position: "absolute", left: 12, bottom: 12, borderRadius: 12, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: "rgba(255,255,255,0.92)", paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  locationIcon: { color: palette.primary, fontSize: 18, fontWeight: "900" },
  locationText: { color: palette.text, fontSize: 12, fontWeight: "800" },
  expandMapButton: { position: "absolute", right: 12, top: 12, width: 36, height: 36, borderRadius: 7, backgroundColor: palette.white, borderWidth: 1, borderColor: palette.primary, alignItems: "center", justifyContent: "center", shadowColor: "#0F172A", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.16, shadowRadius: 4, elevation: 3 },
  expandMapIcon: { width: 18, height: 18, tintColor: palette.primary },
  closeMapButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.96)", borderWidth: 1, borderColor: "rgba(186,26,26,0.22)" },
  closeMapButtonPressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sectionCopy: { flex: 1 },
  sectionTitle: { color: palette.textStrong, fontSize: 20, lineHeight: 28, fontWeight: "900" },
  sectionSubtitle: { color: palette.muted, fontSize: 12, lineHeight: 16 },
  tabRow: { flexDirection: "row", gap: TAB_ROW_GAP, padding: TAB_ROW_PADDING, borderRadius: 12, backgroundColor: "#D4DBD9" },
  tabHighlight: { position: "absolute", top: TAB_ROW_PADDING, bottom: TAB_ROW_PADDING, borderRadius: 10, backgroundColor: palette.primary, elevation: 5, shadowColor: "#0F2F2B", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.28, shadowRadius: 5 },
  tabButton: { flex: 1, zIndex: 1, minHeight: 42, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  tabButtonText: { color: palette.muted, fontSize: 13, lineHeight: 18, fontWeight: "900" },
  tabButtonTextActive: { color: palette.white },
  viewAllButton: { minHeight: 44, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
  viewAllText: { color: palette.primary, fontSize: 12, fontWeight: "900" },
  bestFitScroll: { marginHorizontal: -6, overflow: "visible" },
  bestFitRow: { alignItems: "stretch", gap: 12, paddingHorizontal: 6, paddingTop: 14, paddingBottom: 8 },
  bestFitCardFrame: { alignSelf: "stretch" },
  bestFitCrystalShadow: { flex: 1, position: "relative", borderRadius: 18, shadowColor: "#16E8D0", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.46, shadowRadius: 8, elevation: 7 },
  bestFitCrystalFrame: { flex: 1, borderRadius: 18, padding: 3, overflow: "hidden", backgroundColor: "#B9E9E4" },
  bestFitCrystalGradient: { position: "absolute", inset: 0 },
  bestFitBadgeAnchor: { position: "absolute", top: -10, left: 0, right: 0, zIndex: 4, alignItems: "center" },
  bestFitBadgeGlow: { borderRadius: 15, shadowColor: "#16E8D0", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.52, shadowRadius: 5, elevation: 6 },
  bestFitBadgeFrame: { padding: 2, borderRadius: 15, overflow: "hidden", backgroundColor: "#5BEBD9" },
  bestFitBadgeBorderGradient: { position: "absolute", inset: 0 },
  bestFitBadgeInner: { minHeight: 24, paddingHorizontal: 10, borderRadius: 12, overflow: "hidden", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: "#F8FFFF" },
  bestFitBadgeBackgroundGradient: { position: "absolute", inset: 0 },
  bestFitFloatingBadgeText: { color: palette.primary, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  bestFitCard: { flex: 1, paddingTop: 20, borderWidth: 0, borderRadius: 16, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
  topOpportunitiesSection: { marginHorizontal: -16, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 14 },
  topOpportunitiesAfterBestFit: { marginTop: 8 },
  jobGrid: { gap: 12 },
  loadMoreDividerRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4 },
  loadMoreDividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: palette.outlineVariant },
  loadMoreButton: { minHeight: 44, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  loadMoreText: { color: palette.primary, fontSize: 13, lineHeight: 18, fontWeight: "900" },
  applicationSection: { borderRadius: 12, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surface, overflow: "hidden", ...interactiveCardShadow },
  applicationHeader: { minHeight: 68, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  applicationsOverlayRoot: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  applicationsOverlayFill: { position: "absolute", inset: 0 },
  applicationsOverlayBackdrop: { position: "absolute", inset: 0, backgroundColor: "rgba(35,43,48,0.14)" },
  applicationsOverlaySurface: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "82%",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
    backgroundColor: "#E9EDF0",
    overflow: "hidden",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10
  },
  applicationsOverlayHeader: { position: "relative", minHeight: 72, paddingHorizontal: 18, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  applicationsOverlayTitleGroup: { flex: 1, gap: 2 },
  applicationsOverlayTitle: { color: palette.textStrong, fontSize: 20, lineHeight: 28, fontWeight: "900" },
  applicationsOverlayMeta: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: "700" },
  applicationsOverlayClose: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#BA1A1A" },
  applicationsOverlayClosePressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  applicationsOverlayBody: { flexShrink: 1, position: "relative", width: "100%" },
  applicationsOverlayScroll: { flexShrink: 1, width: "100%" },
  applicationsOverlayList: { gap: 10, padding: 16, paddingBottom: 16 },
  applicationsOverlayTopFade: { position: "absolute", left: 0, right: 0, top: 0, height: 36, overflow: "hidden" },
  applicationsOverlayBottomFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 36, overflow: "hidden" },
  applicationCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(189,201,198,0.45)",
    backgroundColor: palette.surface,
    gap: 14,
    ...interactiveCardShadow
  },
  applicationTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  applicationCopy: { flex: 1, gap: 4 },
  applicationTitle: { color: palette.textStrong, fontSize: 16, lineHeight: 22, fontWeight: "900" },
  applicationMeta: { color: palette.muted, fontSize: 12, lineHeight: 16 },
  applicationPrice: { color: palette.primary, fontSize: 18, lineHeight: 24, fontWeight: "900" },
  applicationFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(189,201,198,0.45)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  applicationAction: { color: palette.primary, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  emptyApplicationCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    backgroundColor: palette.surfaceLow,
    gap: 4
  },
  emptyApplicationTitle: { color: palette.textStrong, fontSize: 16, lineHeight: 22, fontWeight: "900" },
  emptyApplicationText: { color: palette.muted, fontSize: 12, lineHeight: 16 },
  actionMessage: { color: "#BA1A1A", fontSize: 13, lineHeight: 18, fontWeight: "700" },
  historyPanel: { padding: 16, borderRadius: 12, backgroundColor: palette.surfaceLow, gap: 12 },
  historyHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  historyViewAllButton: { minHeight: 44, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
  historyList: { gap: 10 },
  historyCard: {
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    ...interactiveCardShadow
  },
  historyTitle: { color: palette.textStrong, fontSize: 18, lineHeight: 26, fontWeight: "900" },
  historyMeta: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: "800" },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAF8F1"
  },
  historyIconText: { color: palette.success, fontSize: 10, fontWeight: "900" },
  historyCopy: { flex: 1 },
  historyJobTitle: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: "900" },
  historyJobMeta: { color: palette.muted, fontSize: 12, lineHeight: 16 },
  historyAmount: { color: palette.primary, fontSize: 14, fontWeight: "900" },
  historyDivider: { height: 1, backgroundColor: "rgba(189,201,198,0.65)" },
  historyActions: { flexDirection: "row", gap: 10 },
  historyActionButton: { flex: 1, minHeight: 40, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: palette.surfaceLow, borderWidth: 1, borderColor: palette.outlineVariant },
  historyActionButtonText: { color: palette.primary, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  historyActionButtonPrimary: { flex: 1, minHeight: 40, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: palette.primary },
  historyActionButtonPrimaryText: { color: palette.white, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  historyActionButtonPrimaryTextDisabled: { color: palette.textStrong },
  historyActionButtonDisabled: { backgroundColor: palette.surfaceContainer, borderWidth: 1, borderColor: palette.outlineVariant },
  emptyHistoryRow: { padding: 12, borderRadius: 8, backgroundColor: palette.surface },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] }
});
