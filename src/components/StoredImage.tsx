import { ReactNode, useEffect, useState } from "react";
import { Image, ImageStyle, StyleProp } from "react-native";
import { resolveProfilePhotoUri } from "../services/fileUploadService";

export function StoredImage({
  accessibilityLabel,
  fallback = null,
  sourceUri,
  style
}: {
  accessibilityLabel?: string;
  fallback?: ReactNode;
  sourceUri?: string;
  style: StyleProp<ImageStyle>;
}) {
  const [uri, setUri] = useState<string>();

  useEffect(() => {
    let active = true;
    if (!sourceUri) {
      setUri(undefined);
      return () => { active = false; };
    }

    void resolveProfilePhotoUri(sourceUri)
      .then((nextUri) => {
        if (active) setUri(nextUri);
      })
      .catch(() => {
        if (active) setUri(undefined);
      });
    return () => { active = false; };
  }, [sourceUri]);

  if (!uri) return <>{fallback}</>;
  return <Image accessibilityLabel={accessibilityLabel} source={{ uri }} style={style} />;
}
