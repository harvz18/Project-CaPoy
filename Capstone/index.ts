import { registerRootComponent } from 'expo'
import { Blob } from 'expo-blob'

import { App } from './src/App'

// Use Expo's native Blob implementation so file uploads avoid RN's slow base64 path.
globalThis.Blob = Blob as typeof globalThis.Blob

registerRootComponent(App)
