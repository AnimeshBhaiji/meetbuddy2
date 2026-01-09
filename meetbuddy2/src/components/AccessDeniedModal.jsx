import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ClipboardList, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AccessDeniedModal = ({ isOpen, onClose }) => {
    const navigate = useNavigate();

    const handleAction = () => {
        onClose();
        navigate('/home');
        // Optional: adding a small delay to allow navigation to happen before scrolling
        setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-black/80 backdrop-blur-xl border border-white/10 text-white max-w-md rounded-3xl p-0 overflow-hidden shadow-2xl">
                <div className="relative p-6">
                    {/* Decorative background blobs */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

                    <div className="relative z-10 flex flex-col items-center text-center">
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", duration: 0.5 }}
                            className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center mb-6 border border-white/10 shadow-lg"
                        >
                            <ClipboardList className="w-8 h-8 text-blue-400" />
                        </motion.div>

                        <DialogHeader className="mb-4">
                            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent text-center">
                                One Small Step! 📝
                            </DialogTitle>
                            <DialogDescription className="text-gray-400 text-base mt-2 text-center">
                                To create your perfect plan, we need to know what you're into. Please check your preferences on the Dashboard first.
                            </DialogDescription>
                        </DialogHeader>

                        <DialogFooter className="w-full mt-6">
                            <Button
                                onClick={handleAction}
                                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold py-6 rounded-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-500/20"
                            >
                                Go to Dashboard <ArrowRight className="ml-2 w-4 h-4" />
                            </Button>
                        </DialogFooter>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default AccessDeniedModal;
