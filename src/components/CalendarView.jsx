import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css'; // Default styles

const localizer = momentLocalizer(moment);

const CalendarView = ({ tasks }) => {
  // We'll transform your tasks into events suitable for React Big Calendar
  const events = tasks.map(task => ({
    title: task.name, // Assuming your task object has a 'name' property
    start: new Date(task.dueDate), // Assuming your task object has a 'dueDate' property
    end: new Date(task.dueDate), // For tasks, start and end can be the same if it's a specific day
    allDay: true, // Tasks are typically all-day events on the calendar
    resource: task, // You can attach the full task object if needed for later
  }));

  // You can add more customization here, like handling event clicks, etc.
  const handleSelectEvent = (event) => {
    alert(`Task: ${event.title}\nDue Date: ${moment(event.start).format('YYYY-MM-DD')}`);
    // Here you could open a modal to edit the task or view more details
  };

  return (
    <div style={{ height: '70vh' }}> {/* Adjust height as needed */}
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ margin: '20px' }}
        onSelectEvent={handleSelectEvent}
        // You can add more props like defaultView, views, etc.
        // defaultView="month"
        // views={['month', 'week', 'day', 'agenda']}
      />
    </div>
  );
};

export default CalendarView;