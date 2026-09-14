// PlaceEnhancements.jsx - distance badge shown in map popups
import React from 'react';

// Distance Badge Component
export const DistanceBadge = ({ distanceMeters }) => {
    if (!distanceMeters) return null;

    const km = (distanceMeters / 1000).toFixed(1);
    let color = 'blue';
    let label = 'Nearby';

    if (distanceMeters < 2000) {
        color = 'green';
        label = 'Very Close';
    } else if (distanceMeters > 20000) {
        color = 'purple';
        label = 'Weekend Getaway';
    } else if (distanceMeters > 10000) {
        color = 'pink';
        label = 'Short Drive';
    }

    const colorClasses = {
        green: 'bg-green-500/20 text-green-300 border-green-500/30',
        blue: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
        pink: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
        purple: 'bg-purple-500/20 text-purple-300 border-purple-500/30'
    };

    return (
        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${colorClasses[color]}`}>
            <span>📍</span>
            <span>{km} km • {label}</span>
        </div>
    );
};
