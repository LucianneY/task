import { useState, useEffect } from "react";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc, 
  doc 
} from "firebase/firestore";
import { db, auth } from "../config/firebase";

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState("");

  useEffect(() => {
    if (auth.currentUser) {
      const q = query(
        collection(db, "tasks"),
        where("userId", "==", auth.currentUser.uid)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const tasksData = [];
        snapshot.forEach((doc) => {
          tasksData.push({ id: doc.id, ...doc.data() });
        });
        setTasks(tasksData);
      });
      return () => unsubscribe();
    }
  }, []);

  const addTask = async () => {
    if (newTask.trim() === "") return;
    try {
      await addDoc(collection(db, "tasks"), {
        title: newTask,
        completed: false,
        userId: auth.currentUser.uid,
        createdAt: new Date()
      });
      setNewTask("");
    } catch (err) {
      alert(err.message);
    }
  };

  const deleteTask = async (id) => {
    try {
      await deleteDoc(doc(db, "tasks", id));
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={{ maxWidth: "600px", margin: "auto", padding: "20px" }}>
      <h2>我的任务</h2>
      <div>
        <input
          type="text"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          placeholder="添加新任务"
        />
        <button onClick={addTask}>添加</button>
      </div>
      <ul>
        {tasks.map((task) => (
          <li key={task.id}>
            {task.title}
            <button onClick={() => deleteTask(task.id)}>删除</button>
          </li>
        ))}
      </ul>
    </div>
  );
}