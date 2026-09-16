import { View, Text, TouchableOpacity, ScrollView, FlatList, ActivityIndicator, TextInput } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

const formatDDMMYYYY = (dateStr: string) => {
  if (!dateStr) return '';
  if (dateStr.includes('T')) {
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`;
  }
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return dateStr;
};


// Reusable KPI Card Component mimicking the reference design
const KPICard = ({ title, value, subtitle, accentColor }: any) => (
  <View className={`bg-white p-5 rounded-2xl shadow-sm shadow-gray-200/50 flex-1 md:mx-2 border-l-4 ${accentColor} border-t border-b border-r border-gray-100`}>
    <Text className="text-[10px] font-bold text-secondary/50 uppercase tracking-widest mb-2">{title}</Text>
    <Text className="text-3xl font-black text-primary mb-1">{value}</Text>
    <Text className="text-xs font-medium text-secondary/70">{subtitle}</Text>
  </View>
);

export default function TenantAdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ cars: 0, rented: 0, revenue: 0, maintenance: 0 });
  const [bookings, setBookings] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [fleetList, setFleetList] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (searchQuery.length > 1) {
      searchCars();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const searchCars = async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from('cars')
      .select('id, make, model, license_plate')
      .eq('tenant_id', tenantId)
      .or(`license_plate.ilike.%${searchQuery}%,make.ilike.%${searchQuery}%,model.ilike.%${searchQuery}%`)
      .limit(5);
    setSearchResults(data || []);
  };

  const fetchDashboardData = async () => {
    try {
      // Get Tenant ID first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
      if (!profile?.tenant_id) return;
      setTenantId(profile.tenant_id);

      // 1. Fetch Fleet Metrics
      const { data: cars } = await supabase.from('cars').select('id, make, model, license_plate, status, daily_rate').eq('tenant_id', profile.tenant_id).order('created_at', { ascending: false });
      const totalCars = cars?.length || 0;
      const rentedCars = cars?.filter(c => c.status === 'rented').length || 0;
      const maintenanceCars = cars?.filter(c => c.status === 'maintenance').length || 0;
      setFleetList(cars || []);

      // 2. Fetch Revenue (For this month, simplified for now)
      const { data: payments } = await supabase.from('payments').select('amount');
      const totalRevenue = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      setMetrics({ cars: totalCars, rented: rentedCars, revenue: totalRevenue, maintenance: maintenanceCars });

      // 3. Fetch Active/Recent Bookings
      const { data: recentBookings } = await supabase
        .from('bookings')
        .select(`
          id,
          start_date,
          end_date,
          status,
          total_amount,
          customers (full_name, phone),
          cars (make, model, license_plate)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      setBookings(recentBookings || []);
    } catch (error) {
      console.error('Error fetching tenant data:', error);
    } finally {
      setLoading(false);
    }
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
      
      {/* Header Area */}
      <View className="flex-col md:flex-row justify-between md:items-start mb-8 z-50 space-y-4 md:space-y-0">
        <View className="flex-1 mr-8">
          <Text className="text-2xl font-bold text-primary mb-3">Executive Management Center</Text>
          
          <View className="relative w-full max-w-md">
            <TextInput 
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-primary shadow-sm"
              placeholder="Search vehicles by license plate or model..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchResults.length > 0 && (
              <View className="absolute top-14 left-0 right-0 bg-white border border-gray-100 shadow-xl rounded-xl overflow-hidden z-50">
                {searchResults.map((car, idx) => (
                  <TouchableOpacity 
                    key={car.id}
                    className={`p-4 ${idx !== searchResults.length - 1 ? 'border-b border-gray-50' : ''} hover:bg-gray-50`}
                    onPress={() => router.push(`/(tenant-admin)/car/${car.id}`)}
                  >
                    <Text className="font-bold text-primary">{car.license_plate}</Text>
                    <Text className="text-xs text-secondary/60">{car.make} {car.model}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

        </View>
        
        <View className="flex-row gap-3">
          <TouchableOpacity className="bg-white border border-gray-200 px-4 py-3 rounded-xl shadow-sm">
            <Text className="text-secondary/70 font-semibold text-sm">📅 This Month</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* KPI Cards Row */}
      <View className="flex-col md:flex-row justify-between mb-8 md:-mx-2 space-y-4 md:space-y-0">
        <KPICard 
          title="Total Fleet Revenue" 
          value={`₹${metrics.revenue.toLocaleString()}`} 
          subtitle="Processed this period" 
          accentColor="border-l-blue-500" 
        />
        <KPICard 
          title="Active Rentals" 
          value={metrics.rented} 
          subtitle={`${metrics.cars - metrics.rented} vehicles available`} 
          accentColor="border-l-emerald-500" 
        />
        <KPICard 
          title="In Maintenance" 
          value={metrics.maintenance} 
          subtitle="Requires attention" 
          accentColor="border-l-amber-500" 
        />
        <KPICard 
          title="Total Vehicles" 
          value={metrics.cars} 
          subtitle="Registered in system" 
          accentColor="border-l-purple-500" 
        />
      </View>

      {/* Data Table Section */}
      <View className="bg-white rounded-2xl shadow-sm shadow-gray-200/50 border border-gray-100 p-6 mb-8">
        
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-lg font-bold text-primary">📋 Recent Reservations & Cars Interventions</Text>
          <View className="flex-row gap-4">
            <Text className="text-xs font-bold text-emerald-600">● Active</Text>
            <Text className="text-xs font-bold text-amber-500">● Pending</Text>
            <Text className="text-xs font-bold text-blue-500">● Completed</Text>
          </View>
        </View>

        {/* Alert Banner */}
        {metrics.maintenance > 0 && (
          <View className="bg-red-50 border border-red-100 rounded-lg p-3 mb-6">
            <Text className="text-red-600 text-xs font-bold">
              🚨 Showing SLA overdue files. {metrics.maintenance} vehicle(s) currently require maintenance validation before rental assignment.
            </Text>
          </View>
        )}

        <View className="flex-row flex-wrap" style={{ marginHorizontal: -8 }}>
        {bookings.map((booking) => (
          <View key={booking.id} className="w-full md:w-1/2 lg:w-1/2 xl:w-1/3 p-3">
            <View className="bg-white border border-gray-200 rounded-2xl p-6 h-full flex-col justify-between shadow-sm">
              <View>
                <View className="flex-row justify-between items-start mb-5 pb-4 border-b border-gray-100">
                  <View>
                    <Text className="text-[11px] font-black text-secondary/40 uppercase tracking-widest mb-1">Booking ID</Text>
                    <Text className="text-primary font-black text-base">#{booking.id.split('-')[0].toUpperCase()}</Text>
                  </View>
                  <View className={`px-3 py-1.5 rounded-md border ${
                    booking.status === 'active' ? 'bg-emerald-50 border-emerald-100' :
                    booking.status === 'completed' ? 'bg-blue-50 border-blue-100' :
                    booking.status === 'pending' ? 'bg-amber-50 border-amber-100' :
                    'bg-gray-100 border-gray-200'
                  }`}>
                    <Text className={`text-[10px] font-black uppercase tracking-wider ${
                      booking.status === 'active' ? 'text-emerald-700' :
                      booking.status === 'completed' ? 'text-blue-700' :
                      booking.status === 'pending' ? 'text-amber-700' :
                      'text-gray-600'
                    }`}>{booking.status}</Text>
                  </View>
                </View>
                
                <View className="mb-5">
                  <Text className="text-[11px] font-bold text-secondary/50 uppercase tracking-widest mb-1">Customer</Text>
                  <Text className="text-primary font-bold text-base mb-0.5">{booking.customers?.full_name}</Text>
                  <Text className="text-secondary/60 text-xs font-medium">{booking.customers?.phone}</Text>
                </View>
                
                <View className="mb-5">
                  <Text className="text-[11px] font-bold text-secondary/50 uppercase tracking-widest mb-1">Vehicle</Text>
                  <Text className="text-secondary font-bold text-base mb-0.5">{booking.cars?.make} {booking.cars?.model}</Text>
                  <Text className="text-secondary/60 text-xs font-medium">{booking.cars?.license_plate}</Text>
                </View>

                <View className="mb-6 bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <Text className="text-[11px] font-bold text-secondary/50 uppercase tracking-widest mb-1">Dates</Text>
                  <Text className="text-primary font-bold text-sm">{formatDDMMYYYY(booking.start_date)} <Text className="text-secondary/40 font-medium px-1">→</Text> {formatDDMMYYYY(booking.end_date)}</Text>
                </View>
              </View>

              <TouchableOpacity className="w-full bg-gray-50 hover:bg-gray-100 border border-gray-200 py-3 rounded-xl shadow-sm items-center transition-colors">
                <Text className="text-primary font-bold text-xs tracking-wider">VIEW DETAILS</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        
        {bookings.length === 0 && (
          <View className="w-full py-8 items-center">
            <Text className="text-gray-400">No recent reservations found.</Text>
          </View>
        )}
        </View>
      </View>

      
    </ScrollView>
  );
}
