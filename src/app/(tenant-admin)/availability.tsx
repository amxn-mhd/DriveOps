import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { CalendarList } from 'react-native-calendars';

export default function AvailabilityScreen() {
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState('');
  
  // Data
  const [cars, setCars] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [selectedCar, setSelectedCar] = useState<string | null>(null);

  useEffect(() => {
    fetchAvailabilityData();
  }, []);

  const fetchAvailabilityData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
      if (!profile?.tenant_id) return;
      
      setTenantId(profile.tenant_id);

      // Fetch all cars
      const { data: carsData } = await supabase
        .from('cars')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .order('make');
        
      setCars(carsData || []);

      // Fetch all active/pending bookings
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('*, cars(make, model, license_plate), customers(full_name)')
        .eq('tenant_id', profile.tenant_id)
        .in('status', ['active', 'pending']);
        
      setBookings(bookingsData || []);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getMarkedDates = () => {
    let marked: any = {};
    
    // Filter bookings if a specific car is selected
    const relevantBookings = selectedCar 
      ? bookings.filter(b => b.car_id === selectedCar)
      : bookings;

    relevantBookings.forEach(b => {
      let curr = new Date(b.start_date);
      const end = new Date(b.end_date);
      
      while (curr <= end) {
        const dateString = curr.toISOString().split('T')[0];
        
        // If multiple cars are booked on the same day (global view), we just mark it generic red
        marked[dateString] = { 
          disabled: true, 
          disableTouchEvent: false, // allow tapping to see details
          color: selectedCar ? '#f1f5f9' : '#fef08a', textColor: selectedCar ? '#cbd5e1' : '#854d0e', 
          startingDay: curr.getTime() === new Date(b.start_date).getTime(), 
          endingDay: curr.getTime() === end.getTime(),
          bookingDetails: b // custom payload for tooltip
        };
        curr.setDate(curr.getDate() + 1);
      }
    });

    return marked;
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#FAFAFA]">
        <ActivityIndicator size="large" color="#00162C" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-[#FAFAFA] p-8" contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
      <View className="mb-8">
        <Text className="text-3xl font-black text-primary tracking-tight mb-2">Fleet Availability</Text>
        <Text className="text-secondary/60">Check global reservation dates and vehicle schedules.</Text>
      </View>

      <View className="flex-col md:flex-row space-y-6 md:space-y-0 md:space-x-8">
        
        {/* Left Column: Car Filter */}
        <View className="w-full md:w-64">
          <View className="bg-white rounded-2xl p-4 shadow-sm shadow-gray-200/50 border border-gray-100 mb-4">
            <Text className="text-xs font-bold text-secondary/50 uppercase tracking-widest mb-4">Filter by Vehicle</Text>
            
            <TouchableOpacity 
              className={`p-3 rounded-lg mb-2 ${!selectedCar ? 'bg-primary/10 border border-primary/20' : 'bg-gray-50 border border-transparent'}`}
              onPress={() => setSelectedCar(null)}
            >
              <Text className={`font-bold ${!selectedCar ? 'text-primary' : 'text-secondary/70'}`}>Global View (All Cars)</Text>
            </TouchableOpacity>

            {cars.map(car => (
              <TouchableOpacity 
                key={car.id}
                className={`p-3 rounded-lg mb-2 ${selectedCar === car.id ? 'bg-primary/10 border border-primary/20' : 'bg-gray-50 border border-transparent'}`}
                onPress={() => setSelectedCar(car.id)}
              >
                <Text className={`font-bold ${selectedCar === car.id ? 'text-primary' : 'text-secondary/70'}`}>
                  {car.make} {car.model}
                </Text>
                <Text className="text-[10px] text-secondary/50 mt-1">{car.license_plate}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Right Column: Calendar */}
        <View className="flex-1 bg-white rounded-2xl shadow-sm shadow-gray-200/50 border border-gray-100 overflow-hidden min-h-[600px]">
          <View className="p-4 bg-primary border-b border-primary/20">
            <Text className="text-white font-bold">
              {selectedCar ? 'Vehicle Schedule' : 'Global Reservation Map'}
            </Text>
          </View>
          <CalendarList
            horizontal={true}
            pagingEnabled={true}
            markingType={'period'}
            markedDates={getMarkedDates()}
            theme={{
              backgroundColor: '#ffffff',
              calendarBackground: '#ffffff',
              selectedDayBackgroundColor: '#00162C',
              todayTextColor: '#00162C',
              dayTextColor: '#2d4150',
            }}
          />
        </View>
      </View>
    </ScrollView>
  );
}
