import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { AppButton } from "../src/components/AppButton";
import { AppCard } from "../src/components/AppCard";
import { AppInput } from "../src/components/AppInput";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { useApp } from "../src/context/AppContext";
import { styles } from "../src/styles";
import { PublicRole } from "../src/types";
import { sanitizePhoneNumberInput } from "../src/utils/numericInput";
import { AppText as Text } from "../src/components/AppText";

export default function RegistrationScreen() {
  const router = useRouter();
  const { actionLoading, error, register } = useApp();
  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<PublicRole>("client");
  const [attempted, setAttempted] = useState(false);
  const nameInvalid = fullName.trim().length < 2;
  const mobileInvalid = !/^\+?[\d\s()-]{10,24}$/.test(mobileNumber.trim());
  const addressInvalid = !address.trim();
  const passwordInvalid = password.length < 6;
  const nameError = attempted && nameInvalid ? "Enter your full name." : undefined;
  const mobileError = attempted && mobileInvalid ? "Enter a valid mobile number." : undefined;
  const addressError = attempted && addressInvalid ? "Enter your barangay." : undefined;
  const passwordError = attempted && passwordInvalid ? "Password must contain at least 6 characters." : undefined;

  async function handleRegister() {
    setAttempted(true);
    if (nameInvalid || mobileInvalid || addressInvalid || passwordInvalid) return;
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
          <AppButton title="Employer" selected={role === "client"} variant={role === "client" ? "secondary" : "outline"} onPress={() => setRole("client")} style={styles.flex} />
          <AppButton title="Tasker" selected={role === "worker"} variant={role === "worker" ? "secondary" : "outline"} onPress={() => setRole("worker")} style={styles.flex} />
        </View>
        <AppInput autoComplete="name" error={nameError} label="Full name" required returnKeyType="next" value={fullName} onChangeText={setFullName} placeholder="Full name" />
        <AppInput
          label="Mobile number"
          value={mobileNumber}
          onChangeText={(value) => setMobileNumber(sanitizePhoneNumberInput(value))}
          keyboardType="phone-pad"
          autoComplete="tel"
          error={mobileError}
          maxLength={24}
          placeholder="+63 917 000 0001"
          required
        />
        <AppInput error={addressError} label="Barangay" required value={address} onChangeText={setAddress} placeholder="e.g. Barangay Alijis" />
        <AppInput
          label="Password"
          autoComplete="new-password"
          error={passwordError}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Create password"
          required
        />
        <Text style={styles.muted}>SMS verification is not enabled yet. Your password must contain at least 6 characters.</Text>
        {error ? <Text accessibilityLiveRegion="assertive" style={styles.errorText}>{error}</Text> : null}
        <AppButton title="Register" loading={actionLoading} loadingTitle="Registering..." onPress={handleRegister} />
      </AppCard>
    </ScreenContainer>
  );
}
