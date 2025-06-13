import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom/client'; // Import ReactDOM for rendering
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query } from 'firebase/firestore';

// Helper for date formatting
const formatDate = (date, formatStr) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');

  switch (formatStr) {
    case 'yyyy-MM-dd': return `${year}-${month}-${day}`;
    case "yyyy-MM-dd'T'HH:mm": return `${year}-${month}-${day}T${hours}:${minutes}`;
    case 'MMM dd,YYYY':
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${monthNames[d.getMonth()]} ${day}, ${year}`;
    case 'HH:mm': return `${hours}:${minutes}`;
    default: return d.toDateString();
  }
};

// Custom Calendar Component
const CustomCalendar = ({ events, onSelectSlot, onSelectEvent, currentView, onCurrentViewChange, formatTime }) => {
  const [displayDate, setDisplayDate] = useState(new Date());

  // Define time slots for daily/weekly views
  const timeSlots = Array.from({ length: 24 }, (_, i) => i); // 0 to 23 hours

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay(); // 0 for Sunday, 1 for Monday...
  };

  const renderMonthView = useMemo(() => {
    const year = displayDate.getFullYear();
    const month = displayDate.getMonth();
    const numDays = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month); // Day of the week (0-6)

    const days = [];
    // Add empty cells for days before the 1st
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="p-2 border border-gray-200"></div>);
    }

    // Add actual days
    for (let i = 1; i <= numDays; i++) {
      const day = new Date(year, month, i);
      const dayEvents = events.filter(event =>
        event.start && event.start.toDateString() === day.toDateString()
      );

      days.push(
        <div
          key={i}
          className="p-2 border border-gray-200 h-28 flex flex-col cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => onSelectSlot({ start: day, end: day })}
        >
          <div className="font-semibold text-gray-800">{i}</div>
          <div className="flex-grow overflow-y-auto space-y-1 mt-1">
            {dayEvents.map(event => (
              <div
                key={event.id}
                className={`text-white text-xs rounded-md p-1 truncate ${
                  event.resource.priority === 'high' ? 'bg-red-500' :
                  event.resource.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                onClick={(e) => { e.stopPropagation(); onSelectEvent(event); }}
                title={`${event.title} - ${event.resource.description || ''}`}
              >
                {event.title}
              </div>
            ))}
          </div>
        </div>
      );
    }
    return days;
  }, [displayDate, events, onSelectSlot, onSelectEvent]);

  const handlePrev = () => {
    if (currentView === 'month') {
      setDisplayDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    } else if (currentView === 'week') {
      setDisplayDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7));
    } else if (currentView === 'day') {
      setDisplayDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 1));
    } else if (currentView === 'agenda') {
      setDisplayDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7)); // Agenda also moves by a week for practical purposes
    }
  };

  const handleNext = () => {
    if (currentView === 'month') {
      setDisplayDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    } else if (currentView === 'week') {
      setDisplayDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7));
    } else if (currentView === 'day') {
      setDisplayDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 1));
    } else if (currentView === 'agenda') {
      setDisplayDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7)); // Agenda also moves by a week for practical purposes
    }
  };

  const getWeekStart = (date) => {
    const d = new Date(date);
    const day = d.getDay(); // 0 for Sunday, 1 for Monday
    return new Date(d.setDate(d.getDate() - day));
  };

  const renderWeekView = useMemo(() => {
    const startOfWeekDate = getWeekStart(displayDate);
    const dayHeaders = [];

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeekDate);
      day.setDate(startOfWeekDate.getDate() + i);
      dayHeaders.push(
        <div key={`day-header-${i}`} className="flex-1 text-center font-semibold text-gray-700 min-w-[120px] max-w-[calc(100%/7)] p-2">
          {formatDate(day, 'MMM dd,YYYY')}
        </div>
      );
    }

    const rows = timeSlots.map(hour => (
      <div key={`hour-row-${hour}`} className="flex border-t border-gray-200 min-h-[50px] last:border-b">
        <div className="w-16 text-right pr-2 text-sm text-gray-600 border-r border-gray-200 flex-shrink-0">
          {hour.toString().padStart(2, '0')}:00
        </div>
        {Array.from({ length: 7 }).map((_, i) => {
          const currentDay = new Date(startOfWeekDate);
          currentDay.setDate(startOfWeekDate.getDate() + i);
          const slotStart = new Date(currentDay.getFullYear(), currentDay.getMonth(), currentDay.getDate(), hour, 0);
          const slotEnd = new Date(currentDay.getFullYear(), currentDay.getMonth(), currentDay.getDate(), hour + 1, 0);

          const slotEvents = events.filter(event =>
            event.start && event.end &&
            event.start.toDateString() === currentDay.toDateString() &&
            event.start.getHours() === hour
          );

          return (
            <div
              key={`day-hour-cell-${i}-${hour}`}
              className="flex-1 p-1 border-l border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors relative"
              onClick={() => onSelectSlot({ start: slotStart, end: slotEnd })}
            >
              {slotEvents.map(event => (
                <div
                  key={event.id}
                  className={`text-white text-xs rounded-md p-1 truncate mb-1 ${
                    event.resource.priority === 'high' ? 'bg-red-500' :
                    event.resource.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  onClick={(e) => { e.stopPropagation(); onSelectEvent(event); }}
                  title={`${event.title} (${formatDate(event.start, 'HH:mm')} - ${formatDate(event.end, 'HH:mm')})`}
                >
                  {event.title}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    ));

    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex justify-between items-center mb-2">
          <button onClick={handlePrev} className="px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300">Prev</button>
          <span className="font-semibold text-lg">{formatDate(startOfWeekDate, 'MMM dd,YYYY')} - {formatDate(new Date(startOfWeekDate.setDate(startOfWeekDate.getDate() + 6)), 'MMM dd,YYYY')}</span>
          <button onClick={handleNext} className="px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300">Next</button>
        </div>
        <div className="flex flex-col flex-grow border border-gray-200 rounded-md overflow-y-auto">
          <div className="flex bg-gray-100 border-b border-gray-200">
            <div className="w-16 flex-shrink-0"></div> {/* Empty corner for time column */}
            {dayHeaders}
          </div>
          <div className="flex-grow overflow-y-auto">
            {rows}
          </div>
        </div>
      </div>
    );
  }, [displayDate, events, onSelectSlot, onSelectEvent, timeSlots]);

  const renderDayView = useMemo(() => {
    // Grid for time slots and events
    const rows = timeSlots.map(hour => {
      const slotStart = new Date(displayDate.getFullYear(), displayDate.getMonth(), displayDate.getDate(), hour, 0);
      const slotEnd = new Date(displayDate.getFullYear(), displayDate.getMonth(), displayDate.getDate(), hour + 1, 0);

      const slotEvents = events.filter(event =>
        event.start && event.end &&
        event.start.toDateString() === displayDate.toDateString() &&
        event.start.getHours() === hour
      );

      return (
        <div key={`day-hour-row-${hour}`} className="flex border-t border-gray-200 min-h-[50px] last:border-b">
          <div className="w-16 text-right pr-2 text-sm text-gray-600 border-r border-gray-200 flex-shrink-0">
            {hour.toString().padStart(2, '0')}:00
          </div>
          <div
            className="flex-1 p-1 cursor-pointer hover:bg-gray-50 transition-colors relative"
            onClick={() => onSelectSlot({ start: slotStart, end: slotEnd })}
          >
            {slotEvents.map(event => (
              <div
                key={event.id}
                className={`text-white text-xs rounded-md p-1 truncate mb-1 ${
                  event.resource.priority === 'high' ? 'bg-red-500' :
                  event.resource.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                onClick={(e) => { e.stopPropagation(); onSelectEvent(event); }}
                title={`${event.title} (${formatDate(event.start, 'HH:mm')} - ${formatDate(event.end, 'HH:mm')})`}
              >
                {event.title}
              </div>
            ))}
          </div>
        </div>
      );
    });

    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex justify-between items-center mb-2">
          <button onClick={handlePrev} className="px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300">Prev</button>
          <span className="font-semibold text-lg">{formatDate(displayDate, 'MMM dd,YYYY')}</span>
          <button onClick={handleNext} className="px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300">Next</button>
        </div>
        <div className="flex flex-col flex-grow border border-gray-200 rounded-md overflow-y-auto">
          <div className="flex-grow overflow-y-auto">
            {rows}
          </div>
        </div>
      </div>
    );
  }, [displayDate, events, onSelectSlot, onSelectEvent, timeSlots]);

  const renderAgendaView = useMemo(() => {
    const sortedEvents = [...events].sort((a, b) => a.start - b.start);
    const agendaEvents = sortedEvents.filter(event => event.end >= displayDate); // Show events from current date onwards

    return (
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-center mb-2">
          <button onClick={handlePrev} className="px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300">Prev</button>
          <span className="font-semibold text-lg">Agenda from {formatDate(displayDate, 'MMM dd,YYYY')}</span>
          <button onClick={handleNext} className="px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300">Next</button>
        </div>
        <div className="flex-grow p-4 border border-gray-200 rounded-md overflow-y-auto">
          {agendaEvents.length === 0 ? (
            <p className="text-gray-500">No upcoming tasks in agenda.</p>
          ) : (
            <ul className="space-y-3">
              {agendaEvents.map(event => (
                <li key={event.id} className="bg-gray-50 p-3 rounded-md shadow-sm">
                  <div className="font-semibold text-gray-900">{event.title}</div>
                  <div className="text-sm text-gray-600">{event.resource.description}</div>
                  <div className="text-xs text-gray-700">
                    {formatDate(event.start, 'MMM dd,YYYY HH:mm')} - {formatDate(event.end, 'HH:mm')}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-white text-xs mt-1 inline-block ${
                    event.resource.priority === 'high' ? 'bg-red-500' :
                    event.resource.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                  }`}>
                    {event.resource.priority.charAt(0).toUpperCase() + event.resource.priority.slice(1)} Priority
                  </span>
                  {event.resource.deadline && (
                    <span className="text-gray-700 text-xs ml-2">Deadline: {formatDate(new Date(event.resource.deadline), 'MMM dd,YYYY')}</span>
                  )}
                  {event.resource.timeSpent > 0 && formatTime && ( // Check if formatTime exists before calling
                    <span className="text-gray-700 text-xs ml-2">Time: {formatTime(event.resource.timeSpent)}</span>
                  )}
                  <button
                    onClick={() => onSelectEvent(event)}
                    className="ml-3 px-2 py-0.5 bg-gray-200 text-gray-800 rounded-md text-xs hover:bg-gray-300 transition-colors"
                  >
                    Edit
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }, [displayDate, events, onSelectEvent, formatTime]);

  // Handle current view change from parent component
  useEffect(() => {
    // This effect ensures displayDate aligns with the first day of the current month/week/day
    // when the view changes from the parent component (e.g. via view buttons)
    const today = new Date();
    if (currentView === 'month') {
      setDisplayDate(new Date(today.getFullYear(), today.getMonth(), 1));
    } else if (currentView === 'week') {
      setDisplayDate(getWeekStart(today));
    } else if (currentView === 'day' || currentView === 'agenda') {
      setDisplayDate(today);
    }
  }, [currentView]);


  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <button onClick={handlePrev} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors">
          Previous
        </button>
        <h3 className="text-xl font-semibold text-gray-800">
          {currentView === 'month' && `${displayDate.toLocaleString('en-US', { month: 'long' })} ${displayDate.getFullYear()}`}
          {currentView === 'week' && `Week of ${formatDate(getWeekStart(displayDate), 'MMM dd,YYYY')}`}
          {currentView === 'day' && formatDate(displayDate, 'MMM dd,YYYY')}
          {currentView === 'agenda' && `Agenda from ${formatDate(displayDate, 'MMM dd,YYYY')}`}
        </h3>
        <button onClick={handleNext} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors">
          Next
        </button>
      </div>

      <div className="flex-grow">
        {currentView === 'month' && (
          <div className="grid grid-cols-7 text-center font-bold text-gray-700 mb-2">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>
        )}
        <div className={`flex-grow h-full ${currentView === 'month' ? 'grid grid-cols-7 grid-rows-6 auto-rows-fr gap-px bg-gray-200 p-px' : ''}`}>
          {currentView === 'month' && renderMonthView}
          {currentView === 'week' && renderWeekView}
          {currentView === 'day' && renderDayView}
          {currentView === 'agenda' && renderAgendaView}
        </div>
      </div>
    </div>
  );
};


function App() {
  // State for Firebase and user authentication
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // State for tasks and events
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [currentView, setCurrentView] = useState('month'); // State to control calendar view

  // State for new task/event form
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalDescription, setModalDescription] = useState('');
  const [modalStart, setModalStart] = useState(new Date());
  const [modalEnd, setModalEnd] = useState(new Date());
  const [modalPriority, setModalPriority] = useState('medium');
  const [modalDeadline, setModalDeadline] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Initialize Firebase and set up authentication listener
  useEffect(() => {
    try {
      // Provide a default/dummy Firebase config for local development
      const firebaseConfig = typeof __firebase_config !== 'undefined'
        ? JSON.parse(__firebase_config)
        : {
            apiKey: "dummy-api-key",
            authDomain: "dummy-project.firebaseapp.com",
            projectId: "dummy-project", // Added projectId for local testing
            storageBucket: "dummy-project.appspot.com",
            messagingSenderId: "dummy-sender-id",
            appId: "dummy-app-id"
          };

      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const firebaseAuth = getAuth(app);

      setDb(firestore);
      setAuth(firebaseAuth);

      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        if (user) {
          setUserId(user.uid);
        } else {
          // Sign in anonymously if no user is authenticated
          try {
            if (typeof __initial_auth_token !== 'undefined') {
              await signInWithCustomToken(firebaseAuth, __initial_auth_token);
            } else {
              await signInAnonymously(firebaseAuth);
            }
            setUserId(firebaseAuth.currentUser?.uid || crypto.randomUUID()); // Ensure userId is set
          } catch (error) {
            console.error("Error during anonymous sign-in:", error);
            setUserId(crypto.randomUUID()); // Fallback to random UUID if sign-in fails
          }
        }
        setIsAuthReady(true); // Mark authentication as ready
      });

      return () => unsubscribe(); // Cleanup auth listener on unmount
    } catch (error) {
      console.error("Error initializing Firebase:", error);
      // Fallback to anonymous user if firebase config is not available or invalid
      setUserId(crypto.randomUUID());
      setIsAuthReady(true);
    }
  }, []);

  // Fetch tasks and events from Firestore
  useEffect(() => {
    if (db && userId && isAuthReady) {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const tasksCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/tasks`);
      const q = query(tasksCollectionRef);

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedTasks = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            start: data.start ? new Date(data.start.seconds * 1000) : new Date(), // Convert Firestore Timestamp to Date object
            end: data.end ? new Date(data.end.seconds * 1000) : new Date(),     // Convert Firestore Timestamp to Date object
            deadline: data.deadline || '', // Ensure deadline exists
          };
        });

        // Sort tasks by creation time on the client side
        fetchedTasks.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));

        setTasks(fetchedTasks);

        // Map tasks to calendar events
        const calendarEvents = fetchedTasks.map(task => ({
          id: task.id,
          title: task.title,
          start: task.start,
          end: task.end,
          resource: {
            description: task.description,
            priority: task.priority,
            deadline: task.deadline,
            timeSpent: task.timeSpent || 0, // Initialize timeSpent if not present
            isTracking: task.isTracking || false, // Initialize isTracking if not present
          },
        }));
        setEvents(calendarEvents);
      }, (error) => {
        console.error("Error fetching tasks:", error);
      });

      return () => unsubscribe(); // Cleanup listener on unmount
    }
  }, [db, userId, isAuthReady]);

  // Handle slot selection on the calendar
  const handleSelectSlot = useCallback(({ start, end }) => {
    setModalTitle('');
    setModalDescription('');
    setModalStart(start);
    setModalEnd(end);
    setModalPriority('medium');
    setModalDeadline('');
    setSelectedEvent(null); // Clear selected event
    setShowModal(true);
  }, []);

  // Handle event selection on the calendar
  const handleSelectEvent = useCallback((event) => {
    setSelectedEvent(event);
    setModalTitle(event.title);
    setModalDescription(event.resource.description || '');
    setModalStart(event.start);
    setModalEnd(event.end);
    setModalPriority(event.resource.priority || 'medium');
    setModalDeadline(event.resource.deadline || '');
    setShowModal(true);
  }, []);

  // Save or update task/event
  const handleSaveTask = async () => {
    if (!db || !userId) {
      console.error("Firestore not initialized or user not authenticated.");
      return;
    }
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const tasksCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/tasks`);

    const taskData = {
      title: modalTitle,
      description: modalDescription,
      start: modalStart,
      end: modalEnd,
      priority: modalPriority,
      deadline: modalDeadline,
      timestamp: new Date(), // Add a timestamp for client-side sorting
      timeSpent: selectedEvent ? selectedEvent.resource.timeSpent : 0, // Preserve time spent on update
      isTracking: selectedEvent ? selectedEvent.resource.isTracking : false, // Preserve tracking state on update
    };

    try {
      if (selectedEvent) {
        // Update existing event
        const docRef = doc(db, `artifacts/${appId}/users/${userId}/tasks`, selectedEvent.id);
        await updateDoc(docRef, taskData);
      } else {
        // Add new event
        await addDoc(tasksCollectionRef, taskData);
      }
      setShowModal(false);
    } catch (error) {
      console.error("Error saving task:", error);
    }
  };

  // Delete task/event
  const handleDeleteTask = async () => {
    if (!db || !userId || !selectedEvent) {
      console.error("Cannot delete: Firestore not initialized, user not authenticated, or no event selected.");
      return;
    }
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const docRef = doc(db, `artifacts/${appId}/users/${userId}/tasks`, selectedEvent.id);
    try {
      await deleteDoc(docRef);
      setShowModal(false);
      setSelectedEvent(null); // Clear selected event after deletion
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  // Time tracking functions
  // This effect will run every second to update time spent for active tasks
  useEffect(() => {
    const interval = setInterval(() => {
      setTasks(prevTasks =>
        prevTasks.map(task => {
          if (task.isTracking && task.trackingStartTime) {
            const now = new Date();
            const startTime = task.trackingStartTime.seconds * 1000;
            const elapsed = (now.getTime() - startTime) / 1000; // time in seconds
            return { ...task, timeSpent: (task.timeSpent || 0) + elapsed };
          }
          return task;
        })
      );
    }, 1000); // Update every second

    return () => clearInterval(interval); // Cleanup interval
  }, []); // Empty dependency array means this runs once on mount

  const startTracking = async (taskId) => {
    if (!db || !userId) return;
    const task = tasks.find(t => t.id === taskId);
    if (task && !task.isTracking) {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const docRef = doc(db, `artifacts/${appId}/users/${userId}/tasks`, taskId);
      await updateDoc(docRef, { isTracking: true, trackingStartTime: new Date() });
    }
  };

  const stopTracking = async (taskId) => {
    if (!db || !userId) return;
    const task = tasks.find(t => t.id === taskId);
    if (task && task.isTracking && task.trackingStartTime) {
      const timeSpent = task.timeSpent + (new Date().getTime() - task.trackingStartTime.seconds * 1000) / 1000; // total time in seconds
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const docRef = doc(db, `artifacts/${appId}/users/${userId}/tasks`, taskId);
      await updateDoc(docRef, { isTracking: false, timeSpent: timeSpent, trackingStartTime: null });
    }
  };

  // Format time spent for display
  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Filter tasks for the todo list
  const todoTasks = useMemo(() => {
    return tasks
      .filter(task => task.end >= new Date() || task.isTracking) // Show future/current tasks or tasks being tracked
      .sort((a, b) => {
        // Prioritize actively tracking tasks
        if (a.isTracking && !b.isTracking) return -1;
        if (!a.isTracking && b.isTracking) return 1;

        // Then by deadline
        if (a.deadline && b.deadline) {
          const dateA = new Date(a.deadline);
          const dateB = new Date(b.deadline);
          if (dateA.getTime() !== dateB.getTime()) {
            return dateA.getTime() - dateB.getTime();
          }
        } else if (a.deadline) {
          return -1; // a has deadline, b doesn't
        } else if (b.deadline) {
          return 1; // b has deadline, a doesn't
        }

        // Then by priority
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
      });
  }, [tasks]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="text-lg font-semibold text-gray-700">Loading application...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 font-inter flex flex-col lg:flex-row">
      {/* Sidebar for Todo List */}
      <div className="lg:w-1/3 bg-white p-6 shadow-md rounded-lg m-4 lg:m-6 flex flex-col">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Your Tasks ({userId})</h2>
        <div className="flex-grow overflow-y-auto">
          {todoTasks.length === 0 ? (
            <p className="text-gray-500">No tasks planned yet. Add one!</p>
          ) : (
            <ul className="space-y-3">
              {todoTasks.map(task => (
                <li key={task.id} className="bg-gray-50 p-4 rounded-md shadow-sm border border-gray-200">
                  <h3 className="font-semibold text-lg text-gray-900">{task.title}</h3>
                  <p className="text-gray-600 text-sm mt-1">{task.description}</p>
                  <div className="flex items-center space-x-2 mt-2 text-sm">
                    {task.priority && (
                      <span className={`px-2 py-0.5 rounded-full text-white text-xs ${
                        task.priority === 'high' ? 'bg-red-500' :
                        task.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                      }`}>
                        {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority
                      </span>
                    )}
                    {task.deadline && (
                      <span className="text-gray-700">Deadline: {formatDate(new Date(task.deadline), 'MMM dd,YYYY')}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-sm font-medium text-gray-800">
                      Time Spent: {formatTime(task.timeSpent || 0)}
                    </span>
                    <div className="space-x-2">
                      {!task.isTracking ? (
                        <button
                          onClick={() => startTracking(task.id)}
                          className="px-3 py-1 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition-colors shadow"
                        >
                          Start
                        </button>
                      ) : (
                        <button
                          onClick={() => stopTracking(task.id)}
                          className="px-3 py-1 bg-orange-500 text-white rounded-md text-sm hover:bg-orange-600 transition-colors shadow"
                        >
                          Stop
                        </button>
                      )}
                      <button
                        onClick={() => handleSelectEvent(events.find(e => e.id === task.id))}
                        className="px-3 py-1 bg-gray-200 text-gray-800 rounded-md text-sm hover:bg-gray-300 transition-colors shadow"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          onClick={() => {
            setSelectedEvent(null);
            setModalTitle('');
            setModalDescription('');
            setModalStart(new Date());
            setModalEnd(new Date());
            setModalPriority('medium');
            setModalDeadline('');
            setShowModal(true);
          }}
          className="mt-4 w-full bg-indigo-600 text-white py-3 rounded-md shadow-lg hover:bg-indigo-700 transition-colors duration-200 text-lg font-semibold"
        >
          Add New Task
        </button>
      </div>

      {/* Main content area for Calendar */}
      <div className="lg:w-2/3 bg-white p-6 shadow-md rounded-lg m-4 lg:m-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Calendar View</h2>
          <div className="space-x-2">
            <button
              onClick={() => setCurrentView('month')}
              className={`px-4 py-2 rounded-md transition-colors ${currentView === 'month' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
            >
              Month
            </button>
            <button
              onClick={() => setCurrentView('week')}
              className={`px-4 py-2 rounded-md transition-colors ${currentView === 'week' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
            >
              Week
            </button>
            <button
              onClick={() => setCurrentView('day')}
              className={`px-4 py-2 rounded-md transition-colors ${currentView === 'day' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
            >
              Day
            </button>
            <button
              onClick={() => setCurrentView('agenda')}
              className={`px-4 py-2 rounded-md transition-colors ${currentView === 'agenda' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
            >
              Agenda
            </button>
          </div>
        </div>

        <div className="h-[700px] sm:h-[800px] md:h-[900px] lg:h-[calc(100vh-160px)]">
          <CustomCalendar
            events={events}
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            currentView={currentView}
            onCurrentViewChange={setCurrentView}
            formatTime={formatTime} /* Pass formatTime to CustomCalendar */
          />
        </div>
      </div>

      {/* Task/Event Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">
              {selectedEvent ? 'Edit Task/Event' : 'Add New Task/Event'}
            </h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  id="title"
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  id="description"
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  value={modalDescription}
                  onChange={(e) => setModalDescription(e.target.value)}
                  rows="3"
                ></textarea>
              </div>
              <div>
                <label htmlFor="start" className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                <input
                  type="datetime-local"
                  id="start"
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  value={formatDate(modalStart, "yyyy-MM-dd'T'HH:mm")}
                  onChange={(e) => setModalStart(new Date(e.target.value))}
                />
              </div>
              <div>
                <label htmlFor="end" className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                <input
                  type="datetime-local"
                  id="end"
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  value={formatDate(modalEnd, "yyyy-MM-dd'T'HH:mm")}
                  onChange={(e) => setModalEnd(new Date(e.target.value))}
                />
              </div>
              <div>
                <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">Priority Tag</label>
                <select
                  id="priority"
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  value={modalPriority}
                  onChange={(e) => setModalPriority(e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label htmlFor="deadline" className="block text-sm font-medium text-gray-700 mb-1">Deadline Note</label>
                <input
                  type="date"
                  id="deadline"
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  value={modalDeadline}
                  onChange={(e) => setModalDeadline(e.target.value)}
                />
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                {selectedEvent && (
                  <button
                    onClick={handleDeleteTask}
                    className="px-5 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors shadow-md"
                  >
                    Delete
                  </button>
                )}
                <button
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors shadow-md"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTask}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors shadow-md"
                >
                  {selectedEvent ? 'Update' : 'Add Task'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Render the App component into the root element
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

