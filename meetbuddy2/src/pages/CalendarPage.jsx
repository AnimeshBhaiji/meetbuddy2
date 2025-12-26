import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import CustomToolbar from '@/components/calendar/CustomToolbar';
import { format, parse, startOfWeek, getDay, addHours } from 'date-fns';
import { motion } from 'framer-motion';
import { Plus, Calendar as CalendarIcon, Clock, MapPin, Users, X, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Navbar from '@/components/Navbar';
import Aurora from '@/components/Aurora';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }), // Start week on Monday
  getDay,
  locales: {},
});

// Sample events data - will be replaced with API calls
const sampleEvents = [
  {
    id: 1,
    title: 'Team Lunch',
    start: addHours(new Date(), 1),
    end: addHours(new Date(), 2.5),
    location: 'Downtown Bistro',
    attendees: ['john@example.com', 'jane@example.com'],
    description: 'Quarterly team lunch to discuss project updates',
    color: '#3b82f6',
  },
];

const CalendarPage = () => {
  const [events, setEvents] = useState(sampleEvents);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState(Views.MONTH);
  const navigate = useNavigate();

  const handleSelectEvent = useCallback((event) => {
    setSelectedEvent(event);
    setShowEventModal(true);
  }, []);

  const handleSelectSlot = useCallback(({ start }) => {
    setSelectedEvent({
      start,
      end: addHours(start, 1),
    });
    setShowNewEventModal(true);
  }, []);

  const handleNavigateToPlanner = () => {
    if (selectedEvent) {
      navigate('/planner', { 
        state: { 
          startDate: selectedEvent.start,
          endDate: selectedEvent.end 
        } 
      });
    } else {
      navigate('/planner');
    }
  };

  const eventStyleGetter = (event) => {
    const style = {
      backgroundColor: event.color || '#3b82f6',
      borderRadius: '4px',
      opacity: 0.9,
      color: 'white',
      border: '0px',
      display: 'block',
      padding: '2px 8px',
    };
    return { style };
  };

  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      <Aurora colorStops={['#5227FF', '#bf4bfd', '#5227FF']} />
      <div className="relative z-10 min-h-screen flex flex-col">
        <Navbar />
        
        <main className="flex-1 p-4 md:p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-7xl mx-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                My Calendar
              </h1>
              <Button 
                onClick={handleNavigateToPlanner}
                className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Meetup
              </Button>
            </div>

            <Card className="bg-white/5 backdrop-blur-md border border-white/10">
              <CardHeader>
                <CardTitle className="text-xl text-white/90">
                  Upcoming Meetups
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[700px]">
                  <Calendar
                    localizer={localizer}
                    events={events}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: '100%' }}
                    onSelectEvent={handleSelectEvent}
                    onSelectSlot={handleSelectSlot}
                    selectable
                    eventPropGetter={eventStyleGetter}
                    views={{
                      month: true,
                      week: true,
                      day: true,
                      agenda: true
                    }}
                    view={view}
                    onView={setView}
                    date={date}
                    onNavigate={setDate}
                    components={{
                      toolbar: (props) => (
                        <CustomToolbar 
                          {...props} 
                          date={date}
                          onNavigate={setDate}
                          onView={setView}
                          view={view}
                        />
                      ),
                    }}
                    className="text-white/90"
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </main>
      </div>

      {/* Event Details Modal */}
      <Dialog open={showEventModal} onOpenChange={setShowEventModal}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl text-white/90">
              {selectedEvent?.title}
            </DialogTitle>
          </DialogHeader>
          
          {selectedEvent && (
            <div className="space-y-4 mt-4">
              <div className="flex items-start">
                <Clock className="w-5 h-5 text-blue-400 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <p className="text-gray-400 text-sm">When</p>
                  <p className="text-white/90">
                    {format(selectedEvent.start, 'PPP p')} - {format(selectedEvent.end, 'p')}
                  </p>
                </div>
              </div>
              
              {selectedEvent.location && (
                <div className="flex items-start">
                  <MapPin className="w-5 h-5 text-purple-400 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <p className="text-gray-400 text-sm">Location</p>
                    <p className="text-white/90">{selectedEvent.location}</p>
                  </div>
                </div>
              )}
              
              {selectedEvent.attendees?.length > 0 && (
                <div className="flex items-start">
                  <Users className="w-5 h-5 text-green-400 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <p className="text-gray-400 text-sm">Attendees</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedEvent.attendees.map((email, index) => (
                        <span key={index} className="bg-white/10 text-white/90 text-xs px-2 py-1 rounded">
                          {email}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {selectedEvent.description && (
                <div className="pt-2">
                  <p className="text-gray-400 text-sm mb-1">Description</p>
                  <p className="text-white/90">{selectedEvent.description}</p>
                </div>
              )}
              
              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  variant="outline" 
                  className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
                  onClick={() => {
                    setShowEventModal(false);
                    navigate('/planner', { 
                      state: { 
                        eventData: selectedEvent,
                        isEditing: true
                      } 
                    });
                  }}
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button 
                  onClick={handleNavigateToPlanner}
                  className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                >
                  View Details
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarPage;
