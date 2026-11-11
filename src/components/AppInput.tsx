import { useState } from "react";
import { Text, TextInput, TextInputProps, View } from "react-native";
import { styles } from "../styles";
import { colors } from "../theme";

type AppInputProps = TextInputProps & {
  label?: string;
};

type InputFocusEvent = Parameters<NonNullable<TextInputProps["onFocus"]>>[0];

export function AppInput({ label, multiline, style, ...props }: AppInputProps) {
  const [focused, setFocused] = useState(false);
  const handleFocus = (event: InputFocusEvent) => {
    setFocused(true);
    props.onFocus?.(event);
  };
  const handleBlur = (event: InputFocusEvent) => {
    setFocused(false);
    props.onBlur?.(event);
  };

  return (
    <View style={styles.inputGroup}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <TextInput
        accessibilityLabel={props.accessibilityLabel ?? label}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        style={[styles.input, focused && styles.inputFocused, multiline && styles.inputMultiline, style]}
        {...props}
        onBlur={handleBlur}
        onFocus={handleFocus}
      />
    </View>
  );
}
