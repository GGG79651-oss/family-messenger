import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

// ВАЖНО: Замените эти значения на свои из Firebase Console
// Инструкция как получить их — в файле ИНСТРУКЦИЯ.md
const firebaseConfig = {
  apiKey: "AIzaSyAnyteTxrRBdhFRP3q3Hsd80c0BE86ilLE",
  authDomain: "family-messenger-e42a4.firebaseapp.com",
  projectId: "family-messenger-e42a4",
  storageBucket: "family-messenger-e42a4.firebasestorage.app",
  messagingSenderId: "667623082228",
  appId: "1:667623082228:web:5b7fcd3bccb090f534b6a1"
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
