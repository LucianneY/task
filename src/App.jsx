import { useState, useEffect } from "react";
import { auth } from "./config/firebase";
import Auth from "./components/Auth";
import Tasks from "./components/Tasks";
import './App.css';
import CalendarView from "./components/CalendarView"; // This line is crucial!

function App() {
  const [user, setUser] = useState(null);

    // For now, adding some dummy tasks for calendar testing.
  const [tasks, setTasks] = useState([
    { id: '1', name: 'Finish project report', dueDate: '2025-06-25T10:00:00', completed: false },
    { id: '2', name: 'Team meeting', dueDate: '2025-06-28T14:30:00', completed: false },
    { id: '3', name: 'Buy groceries', dueDate: '2025-07-01T18:00:00', completed: true },
  ]);


  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Function to update tasks. This will be passed to Tasks component later.
  const handleUpdateTasks = (newTasks) => {
    setTasks(newTasks);
  };

  return (
    <div className="App">
      {user ? (
        <div className="app-container">
          {/* 左侧任务区 - 保留原有功能 */}
          <div className="task-sidebar">
            <div className="user-header">
              <h2>欢迎, {user.email.split('@')[0]}</h2>
              <button onClick={() => auth.signOut()} className="logout-btn">
                退出登录
              </button>
            </div>
            <Tasks /> {/* 原有任务组件 */}
          </div>

          {/* 右侧日历占位区 */}
          <div className="calendar-main">
            <h2>日历视图</h2>
            <CalendarView tasks={tasks} />
          </div>
        </div>
      ) : (
        <Auth />
      )}
    </div>
  );
}

export default App;