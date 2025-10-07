// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import { QuestionnaireProvider } from "./context/QuestionnaireContext";

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
    <QuestionnaireProvider>
      <App />
    </QuestionnaireProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
