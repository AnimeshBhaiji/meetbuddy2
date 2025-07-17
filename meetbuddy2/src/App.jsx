import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import React from "react";
import RestaurantList from "./components/RestaurantList";

function App() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <h1 className="text-2xl font-bold mb-4">MeetBuddy Restaurant Search</h1>
      <RestaurantList />
    </div>
  );
}

export default App;
