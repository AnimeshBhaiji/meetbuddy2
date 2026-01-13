// PlaceEnhancements.jsx - UI components for parking, atmosphere, and itinerary features
import React from 'react';
import { motion } from 'framer-motion';

// Parking Indicator Component
export const ParkingIndicator = ({ parking }) => {
    if (!parking || parking.status === 'unknown') return null;

    return (
        <div className="mt-3">
            {parking.status === 'available' && (
                <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Parking Available</span>
                    {parking.has_valet && (
                        <span className="text-xs bg-green-500/20 px-2 py-0.5 rounded-full border border-green-500/30">
                            Valet
                        </span>
                    )}
                </div>
            )}
            {parking.status === 'unavailable' && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span>Limited Parking</span>
                </div>
            )}
        </div>
    );
};

// Atmosphere Tags Component
export const AtmosphereTags = ({ atmosphere }) => {
    if (!atmosphere) return null;

    const tags = [];
    if (atmosphere.is_rooftop) tags.push({ label: '🏙️ Rooftop', color: 'blue' });
    if (atmosphere.has_view) tags.push({ label: '🌅 Scenic View', color: 'purple' });
    if (atmosphere.has_live_music) tags.push({ label: '🎵 Live Music', color: 'pink' });
    if (atmosphere.is_outdoor) tags.push({ label: '🌳 Outdoor', color: 'green' });
    if (atmosphere.is_indoor) tags.push({ label: '🏠 Indoor', color: 'gray' });

    if (tags.length === 0) return null;

    const colorClasses = {
        blue: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
        purple: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        pink: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
        green: 'bg-green-500/20 text-green-300 border-green-500/30',
        gray: 'bg-gray-500/20 text-gray-300 border-gray-500/30'
    };

    return (
        <div className="flex flex-wrap gap-2 mt-3">
            {tags.map((tag, idx) => (
                <span
                    key={idx}
                    className={`px-2 py-1 text-xs rounded-full border ${colorClasses[tag.color]}`}
                >
                    {tag.label}
                </span>
            ))}
        </div>
    );
};

// Mood Match Badge Component
export const MoodMatchBadge = ({ moodAnalysis }) => {
    if (!moodAnalysis || !moodAnalysis.is_good_fit) return null;

    return (
        <div className="absolute top-3 right-3 z-10">
            <div className="bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                <span>✨</span>
                <span>Perfect Match</span>
            </div>
        </div>
    );
};

// Itinerary Panel Component
export const ItineraryPanel = ({ sessionId, itinerary, onRemove, onFinalize, isOpen, onClose, currentStep, isLastStep }) => {
    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            className="fixed right-4 top-24 w-96 max-w-[calc(100vw-2rem)] bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-6 max-h-[calc(100vh-8rem)] overflow-y-auto z-50"
        >
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                    <span className="text-2xl">📋</span>
                    Your Itinerary
                </h3>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white transition"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {itinerary.length === 0 ? (
                <div className="text-center py-12">
                    <div className="text-6xl mb-4">🗺️</div>
                    <p className="text-gray-400 text-sm">No places added yet</p>
                    <p className="text-gray-500 text-xs mt-2">Click "Add to Itinerary" on any place</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {itinerary.map((item, idx) => (
                        <motion.div
                            key={item.itinerary_id || idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition group"
                        >
                            <div className="flex justify-between items-start gap-3">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center">
                                            {idx + 1}
                                        </span>
                                        <span className="text-xs text-gray-400 uppercase tracking-wider">
                                            {item.step_type ? item.step_type.charAt(0).toUpperCase() + item.step_type.slice(1) : `Step ${idx + 1}`}
                                        </span>
                                    </div>
                                    <h4 className="text-white font-semibold text-sm mb-1">{item.title}</h4>
                                    {item.address && (
                                        <p className="text-gray-400 text-xs line-clamp-1">{item.address}</p>
                                    )}
                                </div>
                                <button
                                    onClick={() => onRemove(item.itinerary_id || item.place_id)}
                                    className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition p-1"
                                    title="Remove from itinerary"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            <div className="mt-6 pt-6 border-t border-white/10">
                {itinerary.length > 0 && (
                    <div className="text-sm text-gray-400 mb-4">
                        Total: {itinerary.length} {itinerary.length === 1 ? 'place' : 'places'}
                    </div>
                )}
                <button
                    className={`w-full py-3 rounded-xl font-semibold transition transform hover:scale-[1.02] flex items-center justify-center gap-2 ${itinerary.length > 0
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white'
                        : 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/10'
                        }`}
                    onClick={() => itinerary.length > 0 && onFinalize && onFinalize()}
                    disabled={itinerary.length === 0}
                >
                    {isLastStep ? '🎉 Finalize & View Summary' : 'Next Step: Continue Planning →'}
                </button>
                {itinerary.length === 0 && (
                    <p className="text-[10px] text-center text-gray-500 mt-2">Please add at least one place to continue</p>
                )}
            </div>
        </motion.div>
    );
};

// Add to Itinerary Button Component
export const AddToItineraryButton = ({ place, onAdd, disabled }) => {
    return (
        <button
            onClick={() => onAdd(place)}
            disabled={disabled}
            className="w-full mt-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-semibold transition transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
        >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add to Itinerary</span>
        </button>
    );
};

// Cab Estimate Modal Component
export const CabEstimateModal = ({ estimate, isOpen, onClose }) => {
    if (!isOpen || !estimate) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 max-w-md w-full"
            >
                <div className="text-center mb-6">
                    <div className="text-5xl mb-3">🚕</div>
                    <h3 className="text-2xl font-bold text-white mb-2">Cab Estimate</h3>
                    {estimate.is_mock && (
                        <p className="text-yellow-400 text-sm">⚠️ Mock estimate - API integration pending</p>
                    )}
                </div>

                <div className="space-y-4 mb-6">
                    <div className="bg-white/5 rounded-xl p-4">
                        <div className="text-gray-400 text-sm mb-1">Distance</div>
                        <div className="text-white text-xl font-bold">{estimate.distance_km} km</div>
                    </div>

                    <div className="bg-white/5 rounded-xl p-4">
                        <div className="text-gray-400 text-sm mb-1">Estimated Fare</div>
                        <div className="text-white text-3xl font-bold">₹{estimate.estimated_fare}</div>
                    </div>

                    <div className="bg-white/5 rounded-xl p-4">
                        <div className="text-gray-400 text-sm mb-1">ETA</div>
                        <div className="text-white text-xl font-bold">{estimate.eta_minutes} minutes</div>
                    </div>

                    <div className="bg-white/5 rounded-xl p-4">
                        <div className="text-gray-400 text-sm mb-1">Ride Type</div>
                        <div className="text-white text-lg font-semibold capitalize">{estimate.ride_type}</div>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white py-3 rounded-xl font-semibold transition"
                >
                    Close
                </button>

                {estimate.message && (
                    <p className="text-gray-400 text-xs text-center mt-4">{estimate.message}</p>
                )}
            </motion.div>
        </motion.div>
    );
};

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
