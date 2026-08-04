import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import CustomToolbar from '@/components/calendar/CustomToolbar';
import { format, parse, startOfWeek, getDay, addHours, isValid } from 'date-fns';
import { motion } from 'framer-motion';
import { Plus, Clock, MapPin, Edit2, Loader2, RefreshCw } from 'lucide-react';
import { parseISO, slotToPrefill, toLocalISO } from '@/lib/schedule';
import { humanStepName } from '@/hooks/usePlannerSession';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import GlassCard from '@/components/ui/GlassCard';
import GlowButton from '@/components/ui/GlowButton';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

const DnDCalendar = withDragAndDrop(Calendar);

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

/**
 * Saved itinerary -> react-big-calendar event.
 *
 * This is the calendar's only source adapter. A second source (standalone
 * events, an external calendar) plugs in by writing another function with this
 * same output shape and concatenating it into `events` — nothing below here
 * knows where an event came from, only that it has {id, title, start, end}.
 */
const itineraryToEvent = (it) => {
  const start = parseISO(it.start_at);
  if (!start) return null;                       // unscheduled plans stay off the calendar
  const end = parseISO(it.end_at) || addHours(start, 2);
  return {
    id: it.id,
    itineraryId: it.id,
    title: it.title || 'Untitled plan',
    start,
    end: end > start ? end : addHours(start, 2),
    allDay: !!it.all_day,
    stopCount: it.stop_count,
    source: 'itinerary',
  };
};

const CalendarPage = () => {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [scheduleError, setScheduleError] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [date, setDate] = useState(() => new Date());
  const [view, setView] = useState(Views.MONTH);
  const navigate = useNavigate();

  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); }
    catch { return null; }
  }, []);

  const loadEvents = useCallback(async () => {
    if (!user) { setEvents([]); setStatus('ready'); return; }
    setStatus('loading');
    try {
      const rows = await api.get('/itineraries');
      setEvents((rows || []).map(itineraryToEvent).filter(Boolean));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [user]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // The list endpoint omits stops, so pull the full plan for the modal.
  const handleSelectEvent = useCallback(async (event) => {
    setSelectedEvent(event);
    setShowEventModal(true);
    if (!user || !event.itineraryId) return;
    try {
      const plan = await api.get(`/itineraries/${event.itineraryId}`);
      setSelectedEvent((cur) =>
        cur && cur.id === event.id ? { ...cur, stops: plan.stops || [] } : cur);
    } catch {
      setSelectedEvent((cur) => (cur && cur.id === event.id ? { ...cur, stops: [] } : cur));
    }
  }, [user]);

  // Clicking an empty slot starts planning a meetup for that date and time
  const handleSelectSlot = useCallback(({ start, end, action }) => {
    navigate('/planner', { state: { slot: slotToPrefill(start, end, action) } });
  }, [navigate]);

  /**
   * Drag to move / edge-drag to resize. The event moves on screen immediately
   * and the write follows; if the write fails the move is rolled back so the
   * grid never shows a time the server didn't accept.
   */
  const rescheduleEvent = useCallback(async ({ event, start, end, isAllDay }) => {
    if (!user || !event.itineraryId) return;
    const nextAllDay = isAllDay ?? event.allDay;
    const previous = events;

    setEvents((cur) => cur.map((e) =>
      e.id === event.id ? { ...e, start, end, allDay: nextAllDay } : e));
    setScheduleError(null);

    try {
      await api.put(`/itineraries/${event.itineraryId}`, {
        start_at: toLocalISO(start),
        end_at: toLocalISO(end),
        all_day: nextAllDay,
      });
    } catch {
      setEvents(previous);
      setScheduleError("Couldn't save the new time. Put back.");
    }
  }, [user, events]);

  // Reopen a saved plan in the itinerary editor. Planner.jsx loads by id —
  // the old call passed the whole event object, which it silently ignored.
  const openSelectedPlan = () => {
    if (!selectedEvent?.itineraryId) return;
    setShowEventModal(false);
    navigate('/planner', { state: { itineraryId: selectedEvent.itineraryId } });
  };

  const handleNewMeetup = () => navigate('/planner', { state: {} });

  const eventStyleGetter = (event) => {
    const style = {
      background: event.color
        ? event.color
        : 'linear-gradient(100deg, oklch(0.55 0.2 285), oklch(0.58 0.24 320))',
      borderRadius: '8px',
      color: 'white',
      border: '0px',
      display: 'block',
      padding: '2px 8px',
      boxShadow: '0 2px 10px oklch(0.62 0.22 285 / 30%)',
    };
    return { style };
  };

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div className="min-h-screen flex flex-col pt-28">
        <main className="flex-1 p-4 md:p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-7xl mx-auto"
          >
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
              <div>
                <h1 className="text-3xl md:text-5xl font-bold text-white">
                  My <span className="text-gradient">calendar</span>
                </h1>
                <p className="text-muted-foreground mt-2">
                  Every plan, mapped to its moment
                </p>
              </div>
              <GlowButton onClick={handleNewMeetup}>
                <Plus className="w-4.5 h-4.5" />
                New meetup
              </GlowButton>
            </div>

            {scheduleError && (
              <GlassCard variant="strong" className="p-4 mb-4">
                <p className="text-sm text-red-300">{scheduleError}</p>
              </GlassCard>
            )}
            {status === 'error' && (
              <GlassCard variant="strong" className="p-4 mb-4 flex items-center justify-between gap-4">
                <p className="text-sm text-red-300">Couldn't load your plans.</p>
                <button onClick={loadEvents}
                        className="flex items-center gap-1.5 text-sm text-foreground/85 hover:text-white cursor-pointer">
                  <RefreshCw className="w-4 h-4" /> Retry
                </button>
              </GlassCard>
            )}
            {status === 'ready' && events.length === 0 && (
              <GlassCard variant="strong" className="p-4 mb-4">
                <p className="text-sm text-muted-foreground" data-testid="calendar-empty">
                  No scheduled plans yet — click any day to start one, or give a saved plan a date in My Plans.
                </p>
              </GlassCard>
            )}

            <GlassCard variant="strong" className="p-6 md:p-8">
                <div className="h-[700px] relative">
                  {status === 'loading' && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 rounded-xl">
                      <Loader2 className="w-6 h-6 text-white/70 animate-spin" />
                    </div>
                  )}
                  <DnDCalendar
                    localizer={localizer}
                    events={events}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: '100%' }}
                    onSelectEvent={handleSelectEvent}
                    onSelectSlot={handleSelectSlot}
                    onEventDrop={rescheduleEvent}
                    onEventResize={rescheduleEvent}
                    resizable
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
            </GlassCard>
          </motion.div>
        </main>
      </div>

      {/* Event Details Modal */}
      <Dialog open={showEventModal} onOpenChange={setShowEventModal}>
        <DialogContent
          className="glass-strong border-white/10 max-w-md"
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
                  <p className="text-white/90" data-testid="event-when">
                    {selectedEvent.allDay
                      ? `${format(selectedEvent.start, 'PPP')} · all day`
                      : `${format(selectedEvent.start, 'PPP p')} - ${format(selectedEvent.end, 'p')}`}
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <MapPin className="w-5 h-5 text-purple-400 mt-0.5 mr-3 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-gray-400 text-sm mb-1">Stops</p>
                  <div className="space-y-2">
                    {selectedEvent.stops === undefined && (
                      <p className="text-sm text-muted-foreground">Loading stops…</p>
                    )}
                    {selectedEvent.stops?.length === 0 && (
                      <p className="text-sm text-muted-foreground">No stops on this plan.</p>
                    )}
                    {selectedEvent.stops?.map((stop, index) => (
                      <div key={index} className="bg-white/5 p-2 rounded">
                        <p className="text-white/90 font-medium">
                          {stop.place?.title || humanStepName(stop.step)}
                        </p>
                        {stop.place?.address && (
                          <p className="text-xs text-gray-400">{stop.place.address}</p>
                        )}
                        {stop.note && (
                          <p className="text-xs text-brand-3/80 mt-0.5">{stop.note}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* One action: the itinerary canvas is the viewer and the editor. */}
              <div className="flex justify-end gap-2 pt-4">
                <GlowButton size="sm" onClick={openSelectedPlan}>
                  <Edit2 className="w-4 h-4" />
                  Open plan
                </GlowButton>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarPage;
