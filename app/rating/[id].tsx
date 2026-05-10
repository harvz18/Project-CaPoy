import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { AppButton } from "../../src/components/AppButton";
import { AppCard } from "../../src/components/AppCard";
import { AppInput } from "../../src/components/AppInput";
import { EmptyState } from "../../src/components/EmptyState";
import { ScreenContainer } from "../../src/components/ScreenContainer";
import { useApp } from "../../src/context/AppContext";
import { styles } from "../../src/styles";

export default function RatingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { submitRating, ratings, currentUser } = useApp();
  const [score, setScore] = useState("5");
  const [feedback, setFeedback] = useState("");
  const taskRatings = ratings.filter((rating) => rating.taskId === id);

  async function handleSubmit() {
    const numericScore = Math.max(1, Math.min(5, Number(score) || 5));
    await submitRating(id, numericScore, feedback || "Good transaction.");
    router.back();
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.heading}>Rating and Feedback</Text>
      <Text style={styles.muted}>Rate punctuality, work quality, or payment reliability in the feedback.</Text>
      <AppCard>
        <AppInput
          label="Score"
          value={score}
          onChangeText={setScore}
          keyboardType="numeric"
          placeholder="Score 1 to 5"
        />
        <AppInput
          label="Feedback"
          value={feedback}
          onChangeText={setFeedback}
          placeholder="Feedback"
          multiline
        />
        <AppButton title="Submit Rating" onPress={handleSubmit} />
      </AppCard>
      <View style={styles.sectionHeader}>
        <Text style={styles.subheading}>Submitted Ratings</Text>
      </View>
      {taskRatings.length === 0 ? <EmptyState title="No ratings yet" message="Ratings will appear after submission." /> : null}
      {taskRatings.map((rating) => (
        <AppCard key={rating.id}>
          <Text style={styles.text}>Score: {rating.score}/5</Text>
          <Text style={styles.text}>{rating.feedback}</Text>
          <Text style={styles.muted}>
            {rating.reviewerId === currentUser?.id ? "Submitted by you" : "Submitted by other user"}
          </Text>
        </AppCard>
      ))}
    </ScreenContainer>
  );
}
