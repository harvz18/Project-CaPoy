import { Text, TextInput, TextInputProps, View } from "react-native";
import { styles } from "../styles";

type AppInputProps = TextInputProps & {
  label?: string;
};

export function AppInput({ label, multiline, style, ...props }: AppInputProps) {
  return (
    <View style={styles.inputGroup}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor="#94A3B8"
        multiline={multiline}
        style={[styles.input, multiline && styles.inputMultiline, style]}
        {...props}
      />
    </View>
  );
}
