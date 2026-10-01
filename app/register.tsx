import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { AppButton } from "../src/components/AppButton";
import { AppCard } from "../src/components/AppCard";
import { AppInput } from "../src/components/AppInput";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { useApp } from "../src/context/AppContext";
import { styles } from "../src/styles";
import { PublicRole } from "../src/types";

export default function RegistrationScreen() {
  const router = useRouter();
  const { actionLoading, error, register } = useApp();
  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<PublicRole>("client");

  async function handleRegister() {
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
          onChangeText={setMobileNumber}
          keyboardType="phone-pad"
          placeholder="Mobile number"
        />
        <AppInput label="Address/location" value={address} onChangeText={setAddress} placeholder="Address/location" />
        <AppInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Create password"
        />
        <Text style={styles.muted}>SMS verification is not enabled yet. Your password must contain at least 6 characters.</Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <AppButton title={actionLoading ? "Registering..." : "Register"} onPress={handleRegister} disabled={actionLoading} />
      </AppCard>
    </ScreenContainer>
  );
}
