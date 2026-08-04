import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
    const { user } = useContext(AuthContext);

    // A stored user without a token cannot talk to the API — every request
    // would 401 — so treat that the same as being logged out. This is only a
    // UX guard; the server is what actually enforces access.
    if (!user || !localStorage.getItem('token')) {
        return <Navigate to="/login" replace />;
    }

    return children;
};

export default ProtectedRoute;
