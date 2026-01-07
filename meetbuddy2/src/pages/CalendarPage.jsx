import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import CustomToolbar from '@/components/calendar/CustomToolbar';
import { format, parse, startOfWeek, getDay, addHours, isValid } from 'date-fns';
import { motion } from 'framer-motion';
import { Plus, Calendar as CalendarIcon, Clock, MapPin, Users, X, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Navbar from '@/components/Navbar';
import Aurora from '@/components/Aurora';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = dateFnsLocalizer({
  format: (date, formatStr, options) => {
    if (!isValid(new Date(date))) return '';
    return format(new Date(date), formatStr, options);
  },
  parse: (str, formatStr, options) => {
    const parsed = parse(str, formatStr, new Date(), options);
    return isValid(parsed) ? parsed : new Date();
  },
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: {},
});

// Helper function to safely parse dates
const safeParseDate = (date) => {
  const parsed = new Date(date);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

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
  const [events, setEvents] = useState(() => {
    try {
      const savedEvents = localStorage.getItem('meetupEvents');
      if (!savedEvents) return sampleEvents;

      const parsedEvents = JSON.parse(savedEvents);
      // Convert string dates back to Date objects
      return parsedEvents.map(event => ({
        ...event,
        start: new Date(event.start),
        end: new Date(event.end)
      }));
    } catch (error) {
      console.error('Error loading events:', error);
      return sampleEvents;
    }
  });
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [date, setDate] = useState(() => new Date());
  const [view, setView] = useState(Views.MONTH);
  const navigate = useNavigate();

  // Save events to localStorage whenever they change
  const saveEvents = (updatedEvents) => {
    try {
      // Convert Date objects to ISO strings for storage
      const eventsToSave = updatedEvents.map(event => ({
        ...event,
        start: event.start.toISOString(),
        end: event.end.toISOString()
      }));
      localStorage.setItem('meetupEvents', JSON.stringify(eventsToSave));
    } catch (error) {
      console.error('Error saving events:', error);
    }
  };

  const handleSelectEvent = useCallback((event) => {
    // Convert string dates back to Date objects
    const eventWithDates = {
      ...event,
      start: new Date(event.start),
      end: new Date(event.end)
    };
    setSelectedEvent(eventWithDates);
    setShowEventModal(true);
  }, []);

  const handleSelectSlot = useCallback(({ start }) => {
    setSelectedEvent({
      start,
      end: addHours(start, 1),
      title: 'New Meetup',
      location: '',
      attendees: [],
      description: ''
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
      <div className="relative z-10 min-h-screen flex flex-col pt-24">
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
                    date={safeParseDate(date)}
                    onNavigate={(newDate) => setDate(safeParseDate(newDate))}
                    components={{
                      toolbar: (props) => (
                        <CustomToolbar
                          {...props}
                          date={date}
                          onNavigate={(newDate) => setDate(safeParseDate(newDate))}
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
        <DialogContent
          className="bg-gray-900 border-gray-800 max-w-md"
          aria-labelledby="event-details-title"
          aria-describedby="event-details-description"
        >
          <DialogHeader>
            <DialogTitle id="event-details-title" className="text-2xl text-white/90">
              {selectedEvent?.title || 'Event Details'}
            </DialogTitle>
            <DialogDescription id="event-details-description" className="sr-only">
              {selectedEvent?.description || 'Details for this event'}
            </DialogDescription>
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

              {(selectedEvent.itinerary?.steps?.length > 0 || selectedEvent.location) && (
                <div className="flex items-start">
                  <MapPin className="w-5 h-5 text-purple-400 mt-0.5 mr-3 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-gray-400 text-sm mb-1">Planned Locations</p>
                    <div className="space-y-2">
                      {selectedEvent.itinerary?.steps?.map((step, index) => (
                        <div key={index} className="bg-white/5 p-2 rounded">
                          <p className="text-white/90 font-medium">{step.name}</p>
                          {step.address && (
                            <p className="text-xs text-gray-400">{step.address}</p>
                          )}
                        </div>
                      )) || (
                          <p className="text-white/90">{selectedEvent.location}</p>
                        )}
                    </div>
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
