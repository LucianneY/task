import { useState, useEffect } from "react";
import { auth } from "./config/firebase";
import Auth from "./components/Auth";
import Tasks from "./components/Tasks";

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="App">
      {user ? (
        <div>
          <h1>欢迎, {user.email}</h1>
          <button onClick={() => auth.signOut()}>退出登录</button>
          <Tasks />
        </div>
      ) : (
        <Auth />
      )}
    </div>
  );
}

export default App;