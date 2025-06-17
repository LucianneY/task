import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 替换为你的Firebase配置
const firebaseConfig = {
  apiKey: "AIzaSyCjcHcVix9wT1kh6-K9Lsu1yVJROjyu4i8",
  authDomain: "mytasknotes-33235.firebaseapp.com",
  projectId: "mytasknotes-33235",
  storageBucket: "mytasknotes-33235.firebasestorage.app",
  messagingSenderId: "725758947795",
  appId: "1:725758947795:web:be0e14fcba103dca48bf26",
  measurementId: "G-7PXPCL6YP2"
};

// 初始化Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);