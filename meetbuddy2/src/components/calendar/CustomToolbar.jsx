import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const CustomToolbar = ({ date, onNavigate, onView, view }) => {
  const navigate = (action) => {
    const newDate = new Date(date);
    switch (action) {
      case 'PREV':
        newDate.setMonth(newDate.getMonth() - 1);
        break;
      case 'NEXT':
        newDate.setMonth(newDate.getMonth() + 1);
        break;
      case 'TODAY':
        onNavigate(new Date());
        return;
      default:
        return;
    }
    onNavigate(newDate);
  };

  const viewNames = {
    month: 'Month',
    week: 'Week',
    day: 'Day',
    agenda: 'Agenda',
  };

  return (
    <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 bg-white/5 border-white/10 hover:bg-white/10"
          onClick={() => navigate('PREV')}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3 bg-white/5 border-white/10 hover:bg-white/10 text-white hover:text-white"
          onClick={() => navigate('TODAY')}
        >
          Today
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 bg-white/5 border-white/10 hover:bg-white/10"
          onClick={() => navigate('NEXT')}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <h2 className="ml-2 text-lg font-semibold text-white/90">
          {date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
          })}
        </h2>
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={view}
          onValueChange={(value) => onView(value)}
        >
          <SelectTrigger className="w-[120px] bg-white/5 border-white/10 text-white/90 hover:bg-white/10">
            <SelectValue placeholder="View" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700 text-white/90">
            {Object.entries(viewNames).map(([key, label]) => (
              <SelectItem 
                key={key} 
                value={key}
                className="hover:bg-gray-700 focus:bg-gray-700"
              >
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default CustomToolbar;
