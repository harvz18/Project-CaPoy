import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText as Text, AppTextInput as TextInput } from "../src/components/AppText";
import { AppButton } from "../src/components/AppButton";
import { AppCard } from "../src/components/AppCard";
import { AppInput } from "../src/components/AppInput";
import { BacolodBarangayPicker } from "../src/components/BacolodBarangayPicker";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { useApp } from "../src/context/AppContext";
import { styles } from "../src/styles";
import { PublicRole } from "../src/types";
import { sanitizePhoneNumberInput } from "../src/utils/numericInput";

export default function RegistrationScreen() {
  const router = useRouter();
  const { actionLoading, error, register } = useApp();
  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [registrationError, setRegistrationError] = useState("");
  const [role, setRole] = useState<PublicRole>("client");

  async function handleRegister() {
    if (password !== confirmPassword) {
      setRegistrationError("Passwords do not match.");
      return;
    }
    setRegistrationError("");
    try {
      await register({
        role,
        fullName,
        mobileNumber,
        password,
        address
      });
      router.replace(role === "client" ? "/client-dashboard" : "/worker-dashboard");
    } catch {
      // AppContext exposes the readable error message.
    }
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.heading}>Registration</Text>
      <AppCard>
        <Text style={styles.subheading}>Create your account</Text>
        <Text style={styles.inputLabel}>Account type</Text>
        <View style={styles.twoColumn}>
          <AppButton title="Employer" variant={role === "client" ? "secondary" : "outline"} onPress={() => setRole("client")} style={styles.flex} />
          <AppButton title="Tasker" variant={role === "worker" ? "secondary" : "outline"} onPress={() => setRole("worker")} style={styles.flex} />
        </View>
        <AppInput label="Full name" value={fullName} onChangeText={setFullName} placeholder="Full name" />
        <AppInput
          label="Mobile number"
          value={mobileNumber}
          onChangeText={(value) => setMobileNumber(sanitizePhoneNumberInput(value))}
          keyboardType="phone-pad"
          maxLength={24}
          placeholder="+63 917 000 0001"
        />
        <BacolodBarangayPicker value={address} onChange={setAddress} />
        <PasswordInput label="Create password" value={password} onChangeText={setPassword} placeholder="Create password" />
        <PasswordInput label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter password" />
        <Text style={styles.muted}>Your password must contain at least 6 characters.</Text>
        {registrationError ? <Text accessibilityRole="alert" style={styles.errorText}>{registrationError}</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <AppButton title={actionLoading ? "Registering..." : "Register"} onPress={handleRegister} disabled={actionLoading} />
      </AppCard>
    </ScreenContainer>
  );
}

type PasswordInputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
};

function PasswordInput({ label, value, onChangeText, placeholder }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={localStyles.passwordWrap}>
        <TextInput
          accessibilityLabel={label}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          secureTextEntry={!visible}
          style={[styles.input, localStyles.passwordInput]}
          value={value}
        />
        <Pressable
          accessibilityLabel={visible ? `Hide ${label}` : `Show ${label}`}
          accessibilityRole="button"
          onPress={() => setVisible((current) => !current)}
          style={localStyles.visibilityButton}
        >
          <Feather accessibilityElementsHidden color="#475569" name={visible ? "eye-off" : "eye"} size={20} />
        </Pressable>
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  passwordWrap: { position: "relative", justifyContent: "center" },
  passwordInput: { paddingRight: 50 },
  visibilityButton: { position: "absolute", right: 0, width: 48, height: "100%", alignItems: "center", justifyContent: "center" }
});
