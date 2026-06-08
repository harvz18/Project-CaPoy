import { useRouter } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { AppButton } from "../src/components/AppButton";
import { AppCard } from "../src/components/AppCard";
import { AppInput } from "../src/components/AppInput";
import { ScreenContainer } from "../src/components/ScreenContainer";
import { useApp } from "../src/context/AppContext";
import { styles } from "../src/styles";

export default function RegistrationScreen() {
  const router = useRouter();
  const { actionLoading, error, register } = useApp();
  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [address, setAddress] = useState("Bacolod City");
  const [password, setPassword] = useState("");

  async function handleRegister() {
    try {
      await register({
        role: "worker",
        fullName: fullName || "TaskLink User",
        mobileNumber: mobileNumber || "09170000000",
        password,
        address
      });
      router.replace("/role-selection");
    } catch {
      // AppContext exposes the readable error message.
    }
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.heading}>Registration</Text>
      <AppCard>
        <Text style={styles.subheading}>Create your account</Text>
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
        <AppInput label="Mobile verification code" value="123456" editable={false} placeholder="Mobile verification code" />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <AppButton title={actionLoading ? "Registering..." : "Register"} onPress={handleRegister} disabled={actionLoading} />
      </AppCard>
    </ScreenContainer>
  );
}
