import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function FleetRegistryScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fleetList, setFleetList] = useState<any[]>([]);

  useEffect(() => {
    fetchFleet();
  }, []);

  const fetchFleet = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
      if (!profile?.tenant_id) return;

      const { data: cars } = await supabase
        .from('cars')
        .select('id, make, model, license_plate, status, daily_rate')
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false });
        
      setFleetList(cars || []);
    } catch (error) {
      console.error('Error fetching fleet:', error);
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
      
      <View className="flex-col md:flex-row justify-between md:items-center mb-8 space-y-4 md:space-y-0">
        <View>
          <Text className="text-3xl font-black text-primary tracking-tight mb-2">Vehicle List</Text>
          <Text className="text-secondary/60">Manage all your registered vehicles.</Text>
        </View>
        <TouchableOpacity 
          className="bg-primary px-5 py-3 rounded-xl shadow-sm"
          onPress={() => router.push('/(tenant-admin)/onboard-car')}
        >
          <Text className="text-white font-bold text-sm">+ Add New Vehicle</Text>
        </TouchableOpacity>
      </View>

      <View className="bg-white rounded-2xl shadow-sm shadow-gray-200/50 border border-gray-100 p-6 mb-8">
        
        <View className="flex-row flex-wrap" style={{ marginHorizontal: -8 }}>
        {fleetList.map((car) => (
          <View key={car.id} className="w-full md:w-1/2 lg:w-1/2 xl:w-1/3 p-3">
            <View className="bg-white border border-gray-200 rounded-2xl p-6 h-full flex-col justify-between shadow-sm">
              <View>
                <View className="flex-row justify-between items-start mb-5 pb-4 border-b border-gray-100">
                  <View>
                    <Text className="text-[11px] font-black text-secondary/40 uppercase tracking-widest mb-1">Registration</Text>
                    <Text className="text-primary font-black text-base">{car.license_plate}</Text>
                  </View>
                  <View className={`px-3 py-1.5 rounded-md border ${
                    car.status === 'available' ? 'bg-emerald-50 border-emerald-100' :
                    car.status === 'rented' ? 'bg-blue-50 border-blue-100' :
                    'bg-amber-50 border-amber-100'
                  }`}>
                    <Text className={`text-[10px] font-black uppercase tracking-wider ${
                      car.status === 'available' ? 'text-emerald-700' :
                      car.status === 'rented' ? 'text-blue-700' :
                      'text-amber-700'
                    }`}>{car.status || 'Available'}</Text>
                  </View>
                </View>
                
                <View className="mb-5">
                  <Text className="text-[11px] font-bold text-secondary/50 uppercase tracking-widest mb-1">Vehicle</Text>
                  <Text className="text-primary font-bold text-xl mb-0.5">{car.make} {car.model}</Text>
                  <Text className="text-secondary/60 text-xs font-medium">{car.year} • {car.fuel_type || 'N/A'}</Text>
                </View>

                <View className="mb-6 bg-emerald-50/50 p-3 rounded-lg border border-emerald-100/50">
                  <Text className="text-[11px] font-bold text-emerald-800/60 uppercase tracking-widest mb-1">Daily Rate</Text>
                  <Text className="text-emerald-700 font-black text-base">₹{car.daily_rate} <Text className="text-emerald-600/60 text-xs font-bold">/ day</Text></Text>
                </View>
              </View>

              <TouchableOpacity 
                className="w-full bg-primary hover:bg-primary/90 py-3 rounded-xl shadow-lg shadow-primary/20 items-center flex-row justify-center space-x-2 transition-colors"
                onPress={() => router.push(`/(tenant-admin)/car/${car.id}`)}
              >
                <Text className="text-white font-bold text-xs tracking-wider">VIEW PROFILE</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {fleetList.length === 0 && (
          <View className="w-full items-center py-8">
            <Text className="text-gray-400 mb-4">No vehicles in your fleet yet.</Text>
            <TouchableOpacity onPress={() => router.push('/(tenant-admin)/onboard-car')}>
              <Text className="text-primary font-bold">Add your first vehicle →</Text>
            </TouchableOpacity>
          </View>
        )}
        </View>

      </View>
    </ScrollView>
  );
}
