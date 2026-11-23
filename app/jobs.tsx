import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { ComponentRef, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, Keyboard, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput as NativeTextInput, useWindowDimensions, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText as Text } from "../src/components/AppText";
import { AppHeader } from "../src/components/AppHeader";
import { BOTTOM_NAV_MIN_HEIGHT } from "../src/components/AnimatedBottomNav";
import { CompactJobCard } from "../src/components/CompactJobCard";
import LocationMap from "../src/components/LocationMap";
import { usePrefersReducedMotion } from "../src/components/RouteTransition";
import { StatusBadge } from "../src/components/StatusBadge";
import { TaskMapPreview } from "../src/components/TaskMapPreview";
import { useApp } from "../src/context/AppContext";
import { filterAndSortRankedJobs, getAvailableJobs, getJobCategories, type JobSort } from "../src/domain/jobDiscovery";
import { rankTasksForWorker } from "../src/domain/matching";
import { usePullToRefresh } from "../src/hooks/usePullToRefresh";
import type { Task } from "../src/types";
import { typography } from "../src/typography";
import { getDiscoveryLocationIssue } from "../src/utils/location";
import { isTaskOpenForApplications } from "../src/domain/taskExpiry";

const palette = {
  background: "#F7FAF8",
  surface: "#FFFFFF",
  surfaceHigh: "#E5E9E7",
  primary: "#005C55",
  text: "#181C1C",
  textStrong: "#111827",
  muted: "#3E4947",
  outline: "#6E7977",
  outlineVariant: "#BDC9C6"
};

const sortOptions: Array<{ label: string; value: JobSort }> = [
  { label: "Skill Match + Newest", value: "recommended" },
  { label: "Nearest", value: "nearest" },
  { label: "Newest", value: "newest" },
  { label: "Highest pay", value: "highest-pay" }
];

const JOB_PAGE_SIZE = 5;
const MAP_HEIGHT = 176;
const APPLICATION_PREVIEW_SIZE = 3;
const RECOMMENDATION_PREVIEW_SIZE = 2;
const SEARCH_SUGGESTION_LIMIT = 8;
const RECENT_SEARCH_LIMIT = 5;

type SearchSuggestion = {
  kind: "category" | "query";
  label: string;
};

function dedupeSuggestions(suggestions: SearchSuggestion[]) {
  const seen = new Set<string>();
  return suggestions.filter((suggestion) => {
    const key = suggestion.label.trim().toLocaleLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function matchingSuggestions(suggestions: SearchSuggestion[], query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return [];
  return suggestions
    .filter((suggestion) => suggestion.label.toLocaleLowerCase().includes(normalizedQuery))
    .sort((left, right) => {
      const leftStarts = left.label.toLocaleLowerCase().startsWith(normalizedQuery);
      const rightStarts = right.label.toLocaleLowerCase().startsWith(normalizedQuery);
      if (leftStarts !== rightStarts) return leftStarts ? -1 : 1;
      return left.label.length - right.label.length || left.label.localeCompare(right.label);
    })
    .slice(0, SEARCH_SUGGESTION_LIMIT);
}

export default function JobsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: viewportHeight } = useWindowDimensions();
  const reduceMotion = usePrefersReducedMotion();
  const mapExpansion = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef<ComponentRef<typeof NativeTextInput>>(null);
  const searchPanelProgress = useRef(new Animated.Value(0)).current;
  const searchPanelOpacity = useRef(new Animated.Value(0)).current;
  const searchClosingRef = useRef(false);
  const resultsTouchStartYRef = useRef<number | null>(null);
  const outsideScrollStartOffsetRef = useRef<number | null>(null);
  const searchInteractionRef = useRef(false);
  const { tasks, acceptTask, currentUser, actionLoading, error, retryDataSync } = useApp();
  const { onRefresh, refreshing } = usePullToRefresh(retryDataSync);
  const [activeFilter, setActiveFilter] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<JobSort>("recommended");
  const [actionMessage, setActionMessage] = useState("");
  const [applicationsExpanded, setApplicationsExpanded] = useState(false);
  const [showAllApplications, setShowAllApplications] = useState(false);
  const [showAllRecommendations, setShowAllRecommendations] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [openSelector, setOpenSelector] = useState<"sort">();
  const [visibleJobCount, setVisibleJobCount] = useState(JOB_PAGE_SIZE);
  const [selectedMapTaskId, setSelectedMapTaskId] = useState<string>();
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchClosing, setSearchClosing] = useState(false);
  const [recentSearches, setRecentSearches] = useState<SearchSuggestion[]>([]);

  const postedTasks = tasks.filter(isTaskOpenForApplications);
  const availableTasks = getAvailableJobs(postedTasks, currentUser?.id ?? "");
  const appliedTasks = tasks.filter(
    (task) =>
      task.applicantIds?.includes(currentUser?.id ?? "") &&
      (task.status === "Applied" || task.workerId === currentUser?.id) &&
      task.status !== "Finished" &&
      task.status !== "Archived"
  );
  const categories = getJobCategories(availableTasks);
  const suggestionCatalog = useMemo(() => {
    const categorySuggestions = categories.map((label) => ({ kind: "category" as const, label }));
    const taskCapabilities = availableTasks.flatMap((task) =>
      task.requiredCapabilities?.length
        ? task.requiredCapabilities
        : task.requiredCapability
          ? [task.requiredCapability]
          : []
    );
    const workerCapabilities = [
      ...(currentUser?.capabilities ?? []),
      ...(currentUser?.skills ?? [])
    ];
    const querySuggestions = dedupeSuggestions([
      ...workerCapabilities.map((label) => ({ kind: "query" as const, label })),
      ...taskCapabilities.map((label) => ({ kind: "query" as const, label })),
      ...availableTasks.map((task) => ({ kind: "query" as const, label: task.title }))
    ]);

    return {
      all: dedupeSuggestions([...categorySuggestions, ...querySuggestions]),
      categories: categorySuggestions.slice(0, 6),
      suggested: querySuggestions.slice(0, 6)
    };
  }, [tasks, currentUser]);
  const typedSuggestions = useMemo(
    () => matchingSuggestions(suggestionCatalog.all, query),
    [query, suggestionCatalog]
  );
  const rankedAvailableJobs = currentUser ? rankTasksForWorker(availableTasks, currentUser) : [];
  const forYouJobs = rankedAvailableJobs.filter(({ match }) => match.eligible).slice(0, 3);
  const visibleForYouJobs = showAllRecommendations
    ? forYouJobs
    : forYouJobs.slice(0, RECOMMENDATION_PREVIEW_SIZE);
  const forYouTaskIds = new Set(forYouJobs.map(({ task }) => task.id));
  const rankedJobs = currentUser
    ? filterAndSortRankedJobs(rankedAvailableJobs, { category: activeFilter, query, sort })
      .filter(({ task }) => !forYouTaskIds.has(task.id))
    : [];
  const visibleJobs = rankedJobs.slice(0, visibleJobCount);
  const discoveryLocationIssue = getDiscoveryLocationIssue(currentUser);
  const mapTasks = availableTasks.filter((task) => task.latitude !== undefined && task.longitude !== undefined);
  const selectedMapTask = mapTasks.find((task) => task.id === selectedMapTaskId);
  const recommendedWithinRadius = rankedAvailableJobs.filter(({ match }) => match.eligible).length;
  const selectedSortLabel = sortOptions.find((option) => option.value === sort)?.label ?? "Sort";
  const hasDiscoveryFilters = Boolean(query || activeFilter || sort !== "recommended");
  const bottomContentPadding = BOTTOM_NAV_MIN_HEIGHT + Math.max(insets.bottom, 8) + 16;
  const outsideScrollDismissThreshold = 140;
  const fullscreenMapHeight = Math.min(640, Math.max(320, viewportHeight - insets.top - insets.bottom - 48));
  const mapCenter = currentUser?.serviceAreaLatitude !== undefined && currentUser.serviceAreaLongitude !== undefined
    ? { latitude: currentUser.serviceAreaLatitude, longitude: currentUser.serviceAreaLongitude }
    : currentUser?.currentLatitude !== undefined && currentUser.currentLongitude !== undefined
      ? { latitude: currentUser.currentLatitude, longitude: currentUser.currentLongitude }
      : undefined;

  useEffect(() => {
    setVisibleJobCount(JOB_PAGE_SIZE);
  }, [activeFilter, query, sort]);

  useEffect(() => {
    setRecentSearches([]);
  }, [currentUser?.id]);

  useEffect(() => {
    const animation = Animated.timing(mapExpansion, {
      toValue: mapExpanded ? 1 : 0,
      duration: reduceMotion ? 0 : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false
    });
    animation.start();
    return () => animation.stop();
  }, [mapExpanded, mapExpansion, reduceMotion]);

  useEffect(() => {
    if (!searchFocused) return;
    searchClosingRef.current = false;
    setSearchClosing(false);
    searchPanelProgress.stopAnimation();
    searchPanelOpacity.stopAnimation();
    searchPanelProgress.setValue(reduceMotion ? 1 : 0);
    searchPanelOpacity.setValue(reduceMotion ? 1 : 0);
    const animation = Animated.parallel([
      Animated.timing(searchPanelProgress, {
        toValue: 1,
        duration: reduceMotion ? 0 : 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(searchPanelOpacity, {
        toValue: 1,
        duration: reduceMotion ? 0 : 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    ]);
    animation.start();
    return () => animation.stop();
  }, [reduceMotion, searchFocused, searchPanelOpacity, searchPanelProgress]);

  useEffect(() => () => {
    searchPanelProgress.stopAnimation();
    searchPanelOpacity.stopAnimation();
  }, [searchPanelOpacity, searchPanelProgress]);

  async function handleQuickApply(task: Task) {
    try {
      setActionMessage("");
      await acceptTask(task.id);
      router.push(`/task-status/${task.id}`);
    } catch (applyError) {
      setActionMessage(applyError instanceof Error ? applyError.message : "Unable to submit this application.");
    }
  }

  function resetDiscoveryControls() {
    setActiveFilter("");
    setQuery("");
    setSort("recommended");
    setOpenSelector(undefined);
  }

  function rememberSearch(suggestion: SearchSuggestion) {
    const normalizedSuggestion = { ...suggestion, label: suggestion.label.trim() };
    if (!normalizedSuggestion.label) return;
    setRecentSearches((current) => [
      normalizedSuggestion,
      ...current.filter((item) =>
        item.label.toLocaleLowerCase() !== normalizedSuggestion.label.toLocaleLowerCase()
      )
    ].slice(0, RECENT_SEARCH_LIMIT));
  }

  function submitSearch() {
    const trimmedQuery = query.trim();
    if (trimmedQuery) {
      setQuery(trimmedQuery);
      const selectedCategory = activeFilter.trim().toLocaleLowerCase() === trimmedQuery.toLocaleLowerCase();
      rememberSearch({ kind: selectedCategory ? "category" : "query", label: trimmedQuery });
    }
    closeSearchSuggestions();
  }

  function openSearchSuggestions() {
    if (searchClosingRef.current || searchFocused) return;
    setSearchFocused(true);
  }

  function dismissSearchKeyboard() {
    searchInputRef.current?.blur();
    Keyboard.dismiss();
  }

  function closeSearchSuggestions() {
    if (!searchFocused || searchClosingRef.current) return;
    searchInteractionRef.current = false;
    resultsTouchStartYRef.current = null;
    outsideScrollStartOffsetRef.current = null;
    searchClosingRef.current = true;
    setSearchClosing(true);
    dismissSearchKeyboard();
    searchPanelProgress.stopAnimation();
    searchPanelOpacity.stopAnimation();
    searchPanelOpacity.setValue(1);

    const finishClose = () => {
      dismissSearchKeyboard();
      searchClosingRef.current = false;
      setSearchClosing(false);
      setSearchFocused(false);
    };

    if (reduceMotion) {
      searchPanelProgress.setValue(0);
      searchPanelOpacity.setValue(0);
      finishClose();
      return;
    }

    Animated.timing(searchPanelProgress, {
      toValue: 0,
      duration: 240,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true
    }).start(({ finished }) => {
      if (finished) finishClose();
      else {
        searchClosingRef.current = false;
        setSearchClosing(false);
      }
    });
  }

  function selectSuggestion(suggestion: SearchSuggestion) {
    const selectedLabel = suggestion.label.trim();
    if (!selectedLabel) return;
    setQuery(selectedLabel);
    setActiveFilter(suggestion.kind === "category" ? selectedLabel : "");
    rememberSearch({ ...suggestion, label: selectedLabel });
    closeSearchSuggestions();
  }

  function selectRecentSearch(suggestion: SearchSuggestion) {
    selectSuggestion(suggestion);
  }

  function removeRecentSearch(suggestion: SearchSuggestion) {
    setRecentSearches((current) => current.filter((item) =>
      item.kind !== suggestion.kind || item.label !== suggestion.label
    ));
  }

  function toggleApplications() {
    setApplicationsExpanded((expanded) => {
      if (expanded) setShowAllApplications(false);
      return !expanded;
    });
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.headerRegion}>
        <AppHeader />
        {searchFocused ? (
          <Animated.View
            pointerEvents={searchClosing ? "none" : "auto"}
            style={[styles.headerSearchScrim, { opacity: searchPanelProgress }]}
          >
            <Pressable
              accessible={false}
              focusable={false}
              onPressIn={dismissSearchKeyboard}
              onPress={() => closeSearchSuggestions()}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomContentPadding }]}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        onMomentumScrollEnd={() => {
          outsideScrollStartOffsetRef.current = null;
        }}
        onScroll={(event) => {
          const scrollStartOffset = outsideScrollStartOffsetRef.current;
          if (!searchFocused || scrollStartOffset === null) return;
          const scrollDistance = Math.abs(event.nativeEvent.contentOffset.y - scrollStartOffset);
          if (scrollDistance < outsideScrollDismissThreshold) return;
          outsideScrollStartOffsetRef.current = null;
          closeSearchSuggestions();
        }}
        onScrollBeginDrag={(event) => {
          if (!searchFocused || searchInteractionRef.current) return;
          resultsTouchStartYRef.current = null;
          outsideScrollStartOffsetRef.current = event.nativeEvent.contentOffset.y;
        }}
        onTouchCancel={() => {
          searchInteractionRef.current = false;
          resultsTouchStartYRef.current = null;
          outsideScrollStartOffsetRef.current = null;
        }}
        onTouchEnd={() => {
          const startedInsideSearch = searchInteractionRef.current;
          const shouldDismissFromTap = searchFocused && !startedInsideSearch && resultsTouchStartYRef.current !== null;
          searchInteractionRef.current = false;
          resultsTouchStartYRef.current = null;
          if (shouldDismissFromTap) closeSearchSuggestions();
        }}
        onTouchMove={(event) => {
          if (searchInteractionRef.current) return;
          const touchStartY = resultsTouchStartYRef.current;
          if (touchStartY === null) return;
          if (Math.abs(event.nativeEvent.pageY - touchStartY) >= 10) {
            resultsTouchStartYRef.current = null;
          }
        }}
        onTouchStart={(event) => {
          if (!searchFocused || searchInteractionRef.current) {
            resultsTouchStartYRef.current = null;
            outsideScrollStartOffsetRef.current = null;
            return;
          }
          resultsTouchStartYRef.current = event.nativeEvent.pageY;
          outsideScrollStartOffsetRef.current = null;
        }}
        refreshControl={<RefreshControl colors={[palette.primary]} onRefresh={onRefresh} refreshing={refreshing} tintColor={palette.primary} />}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        style={styles.resultsScroll}
      >
        {searchFocused ? (
          <Animated.View
            pointerEvents={searchClosing ? "none" : "auto"}
            style={[styles.searchContentScrim, { opacity: searchPanelProgress }]}
          >
            <Pressable
              accessible={false}
              focusable={false}
              onPressIn={dismissSearchKeyboard}
              onPress={() => closeSearchSuggestions()}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        ) : null}

        <Pressable
          disabled={!searchFocused || searchClosing}
          onPressIn={dismissSearchKeyboard}
          onPress={() => closeSearchSuggestions()}
          style={styles.pageIntro}
        >
          <Text accessibilityRole="header" style={styles.pageTitle}>Find Jobs</Text>
        </Pressable>

        <View
          onTouchStart={() => {
            searchInteractionRef.current = true;
          }}
          style={[styles.searchSection, searchFocused && styles.searchSectionOpen]}
        >
          <View
            pointerEvents={searchClosing ? "none" : "auto"}
            style={[styles.searchBar, searchFocused && styles.searchBarFocused]}
          >
            <Feather accessibilityElementsHidden color={palette.muted} name="search" size={18} />
            <NativeTextInput
              accessible={searchFocused && !searchClosing}
              accessibilityLabel="Search jobs, skills, or location"
              editable={searchFocused && !searchClosing}
              onChangeText={(value) => {
                setQuery(value);
                setActiveFilter("");
                if (!searchFocused) openSearchSuggestions();
              }}
              onFocus={openSearchSuggestions}
              onSubmitEditing={submitSearch}
              placeholder="Search jobs, skills, or location"
              placeholderTextColor={palette.outline}
              ref={searchInputRef}
              returnKeyType="search"
              showSoftInputOnFocus={searchFocused && !searchClosing}
              style={[typography.inputText, styles.searchInput]}
              value={query}
            />
            {query ? (
              <Pressable
                accessibilityLabel="Clear job search"
                accessibilityRole="button"
                hitSlop={8}
                onPressIn={dismissSearchKeyboard}
                onPress={() => {
                  setQuery("");
                  setActiveFilter("");
                  openSearchSuggestions();
                }}
                style={styles.searchClearButton}
              >
                <Feather accessibilityElementsHidden color={palette.muted} name="x" size={17} />
              </Pressable>
            ) : null}
            {!searchFocused ? (
              <Pressable
                accessibilityHint="Opens suggestions without showing the keyboard"
                accessibilityLabel="Open job search"
                accessibilityRole="button"
                onPress={openSearchSuggestions}
                style={styles.searchBarOpenTarget}
              />
            ) : null}
          </View>
          {searchFocused ? (
            <Animated.View
              accessibilityLabel="Job search suggestions"
              pointerEvents={searchClosing ? "none" : "auto"}
              style={[
                styles.searchSuggestionMotion,
                {
                  opacity: searchPanelOpacity,
                  transform: [{
                    translateY: searchPanelProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-24, 0]
                    })
                  }]
                }
              ]}
            >
              <View
                style={[styles.suggestionPanel, styles.suggestionContent]}
              >
              {query.trim() ? (
                <View style={styles.suggestionGroup}>
                  <Text style={styles.suggestionTitle}>Suggested Matches</Text>
                  {typedSuggestions.length ? (
                    <View style={styles.suggestionChips}>
                      {typedSuggestions.map((suggestion) => (
                        <Pressable
                          accessibilityLabel={`Search for ${suggestion.label}`}
                          accessibilityRole="button"
                          hitSlop={4}
                          key={`${suggestion.kind}-${suggestion.label}`}
                          onPressIn={dismissSearchKeyboard}
                          onPress={() => selectSuggestion(suggestion)}
                          style={({ pressed }) => [
                            styles.suggestionChip,
                            suggestion.kind === "category" && styles.categorySuggestionChip,
                            pressed && styles.pressed
                          ]}
                        >
                          <Feather
                            accessibilityElementsHidden
                            color={palette.primary}
                            name={suggestion.kind === "category" ? "tag" : "search"}
                            size={14}
                          />
                          <Text numberOfLines={1} style={styles.suggestionChipText}>{suggestion.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.suggestionEmptyText}>No suggestions match “{query.trim()}”.</Text>
                  )}
                </View>
              ) : (
                <>
                  {suggestionCatalog.suggested.length ? (
                    <View style={styles.suggestionGroup}>
                      <Text style={styles.suggestionTitle}>Suggested Searches</Text>
                      <View style={styles.suggestionChips}>
                        {suggestionCatalog.suggested.map((suggestion) => (
                          <Pressable
                            accessibilityLabel={`Search for ${suggestion.label}`}
                            accessibilityRole="button"
                            hitSlop={4}
                            key={`suggested-${suggestion.label}`}
                            onPressIn={dismissSearchKeyboard}
                            onPress={() => selectSuggestion(suggestion)}
                            style={({ pressed }) => [styles.suggestionChip, pressed && styles.pressed]}
                          >
                            <Feather accessibilityElementsHidden color={palette.primary} name="search" size={14} />
                            <Text numberOfLines={1} style={styles.suggestionChipText}>{suggestion.label}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ) : null}

                  {suggestionCatalog.categories.length ? (
                    <View style={styles.suggestionGroup}>
                      <Text style={styles.suggestionTitle}>Popular Categories</Text>
                      <View style={styles.suggestionChips}>
                        {suggestionCatalog.categories.map((suggestion) => (
                          <Pressable
                            accessibilityLabel={`Filter by ${suggestion.label}`}
                            accessibilityRole="button"
                            hitSlop={4}
                            key={`category-${suggestion.label}`}
                            onPressIn={dismissSearchKeyboard}
                            onPress={() => selectSuggestion(suggestion)}
                            style={({ pressed }) => [styles.suggestionChip, styles.categorySuggestionChip, pressed && styles.pressed]}
                          >
                            <Feather accessibilityElementsHidden color={palette.primary} name="tag" size={14} />
                            <Text numberOfLines={1} style={styles.suggestionChipText}>{suggestion.label}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ) : null}

                  {recentSearches.length ? (
                    <View style={styles.suggestionGroup}>
                      <View style={styles.suggestionHeaderRow}>
                        <Text style={styles.suggestionTitle}>Recent Searches</Text>
                        <Pressable
                          accessibilityLabel="Clear all recent searches"
                          accessibilityRole="button"
                          onPressIn={dismissSearchKeyboard}
                          onPress={() => setRecentSearches([])}
                          style={styles.clearRecentButton}
                        >
                          <Text style={styles.clearRecentText}>Clear all</Text>
                        </Pressable>
                      </View>
                      <View style={styles.suggestionChips}>
                        {recentSearches.slice(0, RECENT_SEARCH_LIMIT).map((recentSearch) => (
                          <View key={`recent-${recentSearch.kind}-${recentSearch.label}`} style={styles.recentSearchChip}>
                            <Pressable
                              accessibilityLabel={`Search again for ${recentSearch.label}`}
                              accessibilityRole="button"
                              onPressIn={dismissSearchKeyboard}
                              onPress={() => selectRecentSearch(recentSearch)}
                              style={styles.recentSearchAction}
                            >
                              <Feather accessibilityElementsHidden color={palette.muted} name={recentSearch.kind === "category" ? "tag" : "clock"} size={14} />
                              <Text numberOfLines={1} style={styles.recentSearchText}>{recentSearch.label}</Text>
                            </Pressable>
                            <Pressable
                              accessibilityLabel={`Remove ${recentSearch.label} from recent searches`}
                              accessibilityRole="button"
                              hitSlop={4}
                              onPressIn={dismissSearchKeyboard}
                              onPress={() => removeRecentSearch(recentSearch)}
                              style={styles.removeRecentButton}
                            >
                              <Feather accessibilityElementsHidden color={palette.muted} name="x" size={14} />
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}
                </>
              )}
              </View>
            </Animated.View>
          ) : null}
        </View>

        <View style={[styles.resultsStack, searchFocused && styles.searchBackgroundBlur]}>
          <View style={styles.searchBackgroundTarget}>
        <View style={styles.nearbySection}>
          <Pressable
            accessibilityLabel={`${mapExpanded ? "Hide" : "View"} nearby jobs map`}
            accessibilityRole="button"
            accessibilityState={{ expanded: mapExpanded }}
            onPress={() => setMapExpanded((expanded) => !expanded)}
            style={({ pressed }) => [styles.nearbySummary, pressed && styles.pressed]}
          >
            <View style={styles.nearbyIcon}>
              <Feather accessibilityElementsHidden color={palette.primary} name="map-pin" size={18} />
            </View>
            <View style={styles.nearbyCopy}>
              <Text style={styles.nearbyTitle}>Nearby Jobs</Text>
              <Text numberOfLines={2} style={styles.nearbyMeta}>
                {discoveryLocationIssue ?? `${recommendedWithinRadius} recommended within your radius`}
              </Text>
            </View>
            <View style={styles.nearbyAction}>
              <Text style={styles.nearbyActionText}>{mapExpanded ? "Hide map" : "View map"}</Text>
              <Feather accessibilityElementsHidden color={palette.primary} name={mapExpanded ? "chevron-up" : "chevron-down"} size={17} />
            </View>
          </Pressable>
          <Animated.View
            pointerEvents={mapExpanded ? "auto" : "none"}
            style={[
              styles.mapExpansion,
              {
                height: mapExpansion.interpolate({ inputRange: [0, 1], outputRange: [0, MAP_HEIGHT] }),
                opacity: mapExpansion
              }
            ]}
          >
            <View style={styles.mapPanel}>
              <LocationMap
                center={mapCenter}
                markers={mapTasks.map((task) => ({ id: task.id, latitude: task.latitude as number, longitude: task.longitude as number, title: task.title }))}
                onMarkerPress={(marker) => setSelectedMapTaskId(marker.id)}
                radiusMeters={(currentUser?.preferredRadiusKm ?? 0) * 1000 || undefined}
                height={MAP_HEIGHT}
              />
              <Pressable
                accessibilityLabel="Open expanded map"
                accessibilityRole="button"
                hitSlop={6}
                onPress={() => setMapFullscreen(true)}
                style={({ pressed }) => [styles.expandMapButton, pressed && styles.pressed]}
              >
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
          </Animated.View>
        </View>

        <View style={styles.filterSection}>
          <View style={styles.controlRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: openSelector === "sort" }}
              onPress={() => setOpenSelector((open) => open === "sort" ? undefined : "sort")}
              style={[styles.controlButton, sort !== "recommended" ? styles.controlButtonActive : undefined]}
            >
              <Text numberOfLines={1} style={[styles.controlText, sort !== "recommended" ? styles.controlTextActive : undefined]}>{selectedSortLabel}</Text>
              <Feather accessibilityElementsHidden color={sort !== "recommended" ? palette.primary : palette.muted} name="chevron-down" size={15} />
            </Pressable>
            {hasDiscoveryFilters ? (
              <Pressable accessibilityLabel="Reset job search and filters" accessibilityRole="button" onPress={resetDiscoveryControls} style={styles.resetButton}>
                <Feather accessibilityElementsHidden color={palette.primary} name="rotate-ccw" size={16} />
              </Pressable>
            ) : null}
          </View>

          {openSelector === "sort" ? (
            <View accessibilityLabel="Job sorting options" style={styles.selectorMenu}>
              {sortOptions.map((option) => {
                const selected = sort === option.value;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={option.value}
                    onPress={() => { setSort(option.value); setOpenSelector(undefined); }}
                    style={[styles.selectorOption, selected && styles.selectorOptionSelected]}
                  >
                    <Text style={[styles.selectorOptionText, selected && styles.selectorOptionTextSelected]}>{option.label}</Text>
                    {selected ? <Feather accessibilityElementsHidden color={palette.primary} name="check" size={15} /> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>

        <View style={styles.applicationSection}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: applicationsExpanded }}
            onPress={toggleApplications}
            style={({ pressed }) => [styles.applicationHeader, pressed && styles.pressed]}
          >
            <View style={styles.applicationIcon}>
              <Feather accessibilityElementsHidden color={palette.primary} name="briefcase" size={17} />
            </View>
            <View style={styles.applicationHeaderCopy}>
              <Text style={styles.applicationSectionTitle}>Your Applications</Text>
              <Text style={styles.applicationSectionMeta}>{appliedTasks.length} active application{appliedTasks.length === 1 ? "" : "s"}</Text>
            </View>
            <Feather accessibilityElementsHidden color={palette.muted} name={applicationsExpanded ? "chevron-up" : "chevron-down"} size={20} />
          </Pressable>
          {applicationsExpanded ? (
            appliedTasks.length ? (
              <View style={styles.applicationGrid}>
                {appliedTasks.slice(0, showAllApplications ? appliedTasks.length : APPLICATION_PREVIEW_SIZE).map((task) => (
                  <ApplicationCard key={task.id} task={task} onOpen={() => router.push(`/task-status/${task.id}`)} />
                ))}
                {appliedTasks.length > APPLICATION_PREVIEW_SIZE ? (
                  <Pressable accessibilityRole="button" onPress={() => setShowAllApplications((showAll) => !showAll)} style={styles.applicationViewAll}>
                    <Text style={styles.applicationViewAllText}>{showAllApplications ? "Show fewer" : `View all ${appliedTasks.length}`}</Text>
                    <Feather accessibilityElementsHidden color={palette.primary} name={showAllApplications ? "chevron-up" : "chevron-down"} size={16} />
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <View style={styles.emptyApplicationCard}>
                <Text style={styles.emptyApplicationText}>You do not have any active applications.</Text>
              </View>
            )
          ) : null}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>For You</Text>
          {forYouJobs.length > RECOMMENDATION_PREVIEW_SIZE ? (
            <Pressable accessibilityRole="button" onPress={() => setShowAllRecommendations((showAll) => !showAll)} style={styles.sectionAction}>
              <Text style={styles.sectionActionText}>{showAllRecommendations ? "Show less" : "See all"}</Text>
              <Feather accessibilityElementsHidden color={palette.primary} name={showAllRecommendations ? "chevron-up" : "chevron-right"} size={16} />
            </Pressable>
          ) : null}
        </View>
        {forYouJobs.length ? (
          <View style={styles.jobGrid}>
            {visibleForYouJobs.map(({ task, match }) => (
              <CompactJobCard
                key={task.id}
                match={match}
                isBestMatch={task.id === forYouJobs[0]?.task.id}
                onOpen={() => router.push(`/task/${task.id}`)}
                onQuickApply={() => task.pricingMode === "bidding" ? router.push(`/task/${task.id}`) : handleQuickApply(task)}
                onApplicationStatus={() => router.push(`/task-status/${task.id}`)}
                applying={actionLoading}
                hasApplied={task.applicantIds?.includes(currentUser?.id ?? "") ?? false}
                showPostedTime={false}
                task={task}
              />
            ))}
          </View>
        ) : (
          <View style={styles.forYouEmptyCard}>
            <Text style={styles.emptyTitle}>No smart matches yet</Text>
            <Text style={styles.emptyText}>Save your service-area pin and complete your profile to see recommendations here.</Text>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Job Board</Text>
          <Text style={styles.sectionMeta}>{rankedJobs.length} available task{rankedJobs.length === 1 ? "" : "s"}</Text>
        </View>
        <View style={styles.jobGrid}>
          {rankedJobs.length ? (
            visibleJobs.map(({ task, match }) => (
              <CompactJobCard
                key={task.id}
                task={task}
                match={match}
                onOpen={() => router.push(`/task/${task.id}`)}
                onQuickApply={() => task.pricingMode === "bidding" ? router.push(`/task/${task.id}`) : handleQuickApply(task)}
                onApplicationStatus={() => router.push(`/task-status/${task.id}`)}
                applying={actionLoading}
                hasApplied={task.applicantIds?.includes(currentUser?.id ?? "") ?? false}
                showPostedTime={false}
              />
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No nearby jobs</Text>
              <Text style={styles.emptyText}>{query || activeFilter ? "No open tasks match these filters." : "Eligible open tasks will appear here after your profile and location are ready."}</Text>
              {hasDiscoveryFilters ? (
                <Pressable accessibilityRole="button" onPress={resetDiscoveryControls} style={styles.emptyResetButton}>
                  <Text style={styles.emptyResetText}>Clear search and filters</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
        {rankedJobs.length > visibleJobs.length ? (
          <Pressable accessibilityRole="button" onPress={() => setVisibleJobCount((count) => count + JOB_PAGE_SIZE)} style={styles.loadMoreButton}>
            <View style={styles.loadMoreLine} />
            <Text style={styles.loadMoreText}>Load more ({visibleJobs.length} of {rankedJobs.length})</Text>
            <View style={styles.loadMoreLine} />
          </Pressable>
        ) : rankedJobs.length > JOB_PAGE_SIZE ? <Text style={styles.listCount}>Showing all {rankedJobs.length} matching jobs</Text> : null}
        {actionMessage ? <Text accessibilityRole="alert" style={styles.errorMessage}>{actionMessage}</Text> : null}
        {error ? <Text accessibilityRole="alert" style={styles.locationMessage}>{error}</Text> : null}
          </View>
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={() => setMapFullscreen(false)}
        statusBarTranslucent
        transparent
        visible={mapFullscreen}
      >
        <View accessibilityViewIsModal style={styles.mapOverlayRoot}>
          <Pressable
            accessibilityLabel="Close expanded map"
            accessibilityRole="button"
            onPress={() => setMapFullscreen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View accessibilityLabel="Expanded nearby jobs map" style={[styles.mapOverlaySurface, { height: fullscreenMapHeight }]}>
            <LocationMap
              center={mapCenter}
              expandedControls
              fitToMarkers
              interactive
              markers={mapTasks.map((task) => ({ id: task.id, latitude: task.latitude as number, longitude: task.longitude as number, title: task.title }))}
              onMarkerPress={(marker) => setSelectedMapTaskId(marker.id)}
              radiusMeters={(currentUser?.preferredRadiusKm ?? 0) * 1000 || undefined}
              height={fullscreenMapHeight}
            />
            <Pressable
              accessibilityLabel="Close expanded map"
              accessibilityRole="button"
              onPress={() => setMapFullscreen(false)}
              style={({ pressed }) => [styles.closeMapButton, pressed && styles.pressed]}
            >
              <Feather accessibilityElementsHidden color="#BA1A1A" name="x" size={24} />
            </Pressable>
            <TaskMapPreview
              onDismiss={() => setSelectedMapTaskId(undefined)}
              onViewTask={(task) => {
                setMapFullscreen(false);
                router.push(`/task/${task.id}`);
              }}
              style={styles.mapOverlayTaskPreview}
              task={selectedMapTask}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ApplicationCard({ task, onOpen }: { task: Task; onOpen: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.applicationCard, pressed && styles.pressed]}>
      <View style={styles.applicationCopy}>
        <Text numberOfLines={1} style={styles.applicationTitle}>{task.title}</Text>
        <Text numberOfLines={2} style={styles.applicationMeta}>{getApplicationMessage(task.status)}</Text>
      </View>
      <View style={styles.applicationStatus}>
        <StatusBadge status={task.status} />
        <Feather accessibilityElementsHidden color={palette.primary} name="chevron-right" size={18} />
      </View>
    </Pressable>
  );
}

function getApplicationMessage(status: Task["status"]) {
  if (status === "Applied") return "Waiting for the client to accept your application.";
  if (status === "Accepted") return "Application accepted. You can start this task.";
  if (status === "Pending Approval") return "Waiting for client completion approval.";
  return "Track this task status.";
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { position: "relative", paddingBottom: 104 },
  headerRegion: { position: "relative" },
  headerSearchScrim: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 2 },
  searchContentScrim: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 3 },
  searchBackgroundBlur: { filter: [{ blur: 4 }] },
  pageIntro: { paddingHorizontal: 16, paddingTop: 14 },
  pageTitle: { color: palette.textStrong, fontSize: 20, lineHeight: 28, fontWeight: "800" },
  searchSection: { paddingHorizontal: 16, paddingTop: 12, position: "relative", zIndex: 4 },
  searchSectionOpen: { zIndex: 30, elevation: 30 },
  searchBar: { minHeight: 48, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 9, borderWidth: 1, borderColor: palette.outlineVariant, borderRadius: 12, backgroundColor: palette.surface },
  searchBarFocused: { borderColor: palette.primary, shadowColor: palette.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 5, elevation: 2 },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 0, color: palette.text },
  searchBarOpenTarget: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 2, borderRadius: 12 },
  searchClearButton: { width: 32, height: 32, zIndex: 3, alignItems: "center", justifyContent: "center", borderRadius: 16 },
  searchSuggestionMotion: { position: "absolute", top: 68, right: 16, left: 16, zIndex: 31, elevation: 31 },
  suggestionPanel: { borderWidth: 1, borderColor: palette.outlineVariant, borderRadius: 14, backgroundColor: palette.surface, shadowColor: "#0F172A", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 9, elevation: 4 },
  suggestionContent: { padding: 12, paddingBottom: 18, gap: 14 },
  suggestionGroup: { gap: 8 },
  suggestionHeaderRow: { minHeight: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  suggestionTitle: { color: palette.textStrong, fontSize: 13, lineHeight: 18, fontWeight: "800" },
  suggestionChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  suggestionChip: { maxWidth: "100%", minHeight: 36, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#B8D7D2", borderRadius: 18, backgroundColor: "#EDF7F5" },
  categorySuggestionChip: { borderColor: "#8FC8BF", backgroundColor: "#E1F2EF" },
  suggestionChipText: { flexShrink: 1, color: palette.primary, fontSize: 12, lineHeight: 16, fontWeight: "700" },
  suggestionEmptyText: { paddingVertical: 7, color: palette.muted, fontSize: 12, lineHeight: 17 },
  clearRecentButton: { minHeight: 44, marginVertical: -8, paddingHorizontal: 4, justifyContent: "center" },
  clearRecentText: { color: palette.primary, fontSize: 12, lineHeight: 16, fontWeight: "800" },
  recentSearchChip: { maxWidth: "100%", minHeight: 44, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: palette.outlineVariant, borderRadius: 22, backgroundColor: palette.background, overflow: "hidden" },
  recentSearchAction: { minWidth: 0, minHeight: 44, paddingLeft: 12, paddingRight: 7, flexDirection: "row", alignItems: "center", gap: 7 },
  recentSearchText: { flexShrink: 1, color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: "600" },
  removeRecentButton: { width: 38, height: 44, alignItems: "center", justifyContent: "center" },
  resultsScroll: { flex: 1 },
  resultsStack: { position: "relative" },
  searchBackgroundTarget: { width: "100%" },
  nearbySection: { marginHorizontal: 16, marginTop: 14, borderWidth: 1, borderColor: palette.outlineVariant, borderRadius: 14, backgroundColor: palette.surface, overflow: "hidden" },
  nearbySummary: { minHeight: 64, paddingHorizontal: 12, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 10 },
  nearbyIcon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#E5F1EE" },
  nearbyCopy: { flex: 1, minWidth: 0 },
  nearbyTitle: { color: palette.textStrong, fontSize: 15, lineHeight: 20, fontWeight: "700" },
  nearbyMeta: { color: palette.muted, fontSize: 12, lineHeight: 16 },
  nearbyAction: { flexDirection: "row", alignItems: "center", gap: 3 },
  nearbyActionText: { color: palette.primary, fontSize: 12, lineHeight: 16, fontWeight: "700" },
  mapExpansion: { overflow: "hidden", borderTopWidth: 1, borderTopColor: "rgba(189,201,198,0.55)" },
  mapPanel: { height: MAP_HEIGHT, position: "relative", backgroundColor: "#DDEDEA" },
  mapTaskPreview: { position: "absolute", left: 10, right: 10, bottom: 10, zIndex: 3 },
  expandMapButton: { position: "absolute", top: 10, right: 10, width: 34, height: 34, borderRadius: 7, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: palette.primary, backgroundColor: "rgba(255,255,255,0.96)", shadowColor: "#0F172A", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.16, shadowRadius: 4, elevation: 3 },
  expandMapIcon: { width: 17, height: 17, tintColor: palette.primary },
  mapOverlayRoot: { flex: 1, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(17,24,39,0.42)" },
  mapOverlaySurface: { width: "100%", maxWidth: 720, position: "relative", overflow: "hidden", borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.78)", backgroundColor: palette.surface, shadowColor: "#111827", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.24, shadowRadius: 12, elevation: 12 },
  closeMapButton: { position: "absolute", top: 12, right: 12, width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(186,26,26,0.3)", backgroundColor: "rgba(255,255,255,0.96)" },
  mapOverlayTaskPreview: { position: "absolute", left: 16, right: 72, bottom: 16, zIndex: 3 },
  filterSection: { marginHorizontal: 16, marginTop: 10, gap: 8 },
  controlRow: { minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 },
  controlButton: { flex: 1, minWidth: 0, minHeight: 38, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, borderRadius: 19, backgroundColor: palette.surfaceHigh, borderWidth: 1, borderColor: "transparent" },
  controlButtonActive: { borderColor: "#9CCBC4", backgroundColor: "#E5F1EE" },
  controlText: { flex: 1, minWidth: 0, color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: "700" },
  controlTextActive: { color: palette.primary },
  resetButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#9CCBC4", backgroundColor: palette.surface },
  selectorMenu: { borderRadius: 12, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surface, overflow: "hidden" },
  selectorOption: { minHeight: 42, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, borderBottomWidth: 1, borderBottomColor: "rgba(189,201,198,0.35)" },
  selectorOptionSelected: { backgroundColor: "#E5F1EE" },
  selectorOptionText: { flex: 1, minWidth: 0, color: palette.muted, fontSize: 13, lineHeight: 18, fontWeight: "600" },
  selectorOptionTextSelected: { color: palette.primary, fontWeight: "800" },
  applicationSection: { marginHorizontal: 16, marginTop: 14, borderRadius: 14, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surface, overflow: "hidden" },
  applicationHeader: { minHeight: 64, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  applicationIcon: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#E5F1EE" },
  applicationHeaderCopy: { flex: 1, minWidth: 0 },
  applicationSectionTitle: { color: palette.textStrong, fontSize: 15, lineHeight: 20, fontWeight: "700" },
  applicationSectionMeta: { color: palette.muted, fontSize: 12, lineHeight: 16 },
  applicationGrid: { padding: 10, paddingTop: 0, gap: 8 },
  applicationCard: { minHeight: 68, padding: 11, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 10, borderWidth: 1, borderColor: "rgba(189,201,198,0.55)", backgroundColor: palette.background },
  applicationCopy: { flex: 1, minWidth: 0, gap: 2 },
  applicationTitle: { color: palette.textStrong, fontSize: 14, lineHeight: 19, fontWeight: "700" },
  applicationMeta: { color: palette.muted, fontSize: 11, lineHeight: 15 },
  applicationStatus: { flexShrink: 0, alignItems: "flex-end", gap: 5 },
  applicationViewAll: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  applicationViewAllText: { color: palette.primary, fontSize: 12, lineHeight: 16, fontWeight: "800" },
  emptyApplicationCard: { margin: 10, marginTop: 0, padding: 14, borderRadius: 10, backgroundColor: palette.background, alignItems: "center" },
  emptyApplicationText: { color: palette.muted, fontSize: 12, lineHeight: 17, textAlign: "center" },
  sectionHeader: { marginTop: 18, paddingHorizontal: 16, paddingBottom: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sectionTitle: { color: palette.textStrong, fontSize: 17, lineHeight: 23, fontWeight: "700" },
  sectionMeta: { maxWidth: "52%", color: palette.muted, fontSize: 12, lineHeight: 16, textAlign: "right" },
  sectionAction: { minHeight: 36, paddingLeft: 10, flexDirection: "row", alignItems: "center", gap: 2 },
  sectionActionText: { color: palette.primary, fontSize: 12, lineHeight: 16, fontWeight: "800" },
  forYouEmptyCard: { marginHorizontal: 16, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surface, gap: 5 },
  jobGrid: { paddingHorizontal: 16, gap: 10 },
  loadMoreButton: { minHeight: 46, marginHorizontal: 16, marginTop: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  loadMoreLine: { flex: 1, height: 1, backgroundColor: palette.outlineVariant },
  loadMoreText: { color: palette.primary, fontSize: 12, lineHeight: 16, fontWeight: "800" },
  listCount: { color: palette.muted, fontSize: 12, lineHeight: 16, fontWeight: "600", textAlign: "center", paddingTop: 12 },
  emptyCard: { padding: 18, borderRadius: 14, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.outlineVariant, alignItems: "center", gap: 6 },
  emptyTitle: { color: palette.textStrong, fontSize: 16, lineHeight: 22, fontWeight: "800" },
  emptyText: { color: palette.muted, fontSize: 13, lineHeight: 18, textAlign: "center" },
  emptyResetButton: { minHeight: 38, marginTop: 4, paddingHorizontal: 12, justifyContent: "center" },
  emptyResetText: { color: palette.primary, fontSize: 12, lineHeight: 16, fontWeight: "800" },
  errorMessage: { color: "#BA1A1A", fontSize: 13, lineHeight: 18, fontWeight: "700", paddingHorizontal: 16, paddingTop: 10 },
  locationMessage: { color: palette.primary, fontSize: 12, lineHeight: 17, fontWeight: "700", paddingHorizontal: 16, paddingTop: 8 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.995 }] }
});
