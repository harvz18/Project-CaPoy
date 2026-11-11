import { useState } from "react";
import { TextInputProps, View } from "react-native";
import { styles } from "../styles";
import { colors } from "../theme";
import { AppText as Text, AppTextInput as TextInput } from "./AppText";

type AppInputProps = TextInputProps & {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
};

type InputFocusEvent = Parameters<NonNullable<TextInputProps["onFocus"]>>[0];

export function AppInput({ error, helperText, label, multiline, required, style, ...props }: AppInputProps) {
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
      {label ? <Text style={styles.inputLabel}>{label}{required ? <Text style={styles.requiredMark}> *</Text> : null}</Text> : null}
      <TextInput
        accessibilityLabel={props.accessibilityLabel ?? label}
        accessibilityHint={error ? `${error}${props.accessibilityHint ? `. ${props.accessibilityHint}` : ""}` : props.accessibilityHint}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        style={[styles.input, focused && styles.inputFocused, error && styles.inputError, multiline && styles.inputMultiline, style]}
        {...props}
        onBlur={handleBlur}
        onFocus={handleFocus}
      />
      {error ? <Text accessibilityLiveRegion="polite" style={styles.inputErrorText}>{error}</Text> : helperText ? <Text style={styles.inputHelperText}>{helperText}</Text> : null}
    </View>
  );
}
