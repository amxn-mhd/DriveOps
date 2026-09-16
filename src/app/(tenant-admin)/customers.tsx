import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Platform, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function CustomersDirectory() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user?.id).single();

      // Fetch all customers for this tenant
      const { data: custData, error: custError } = await supabase
        .from('customers')
        .select('*')
        .eq('tenant_id', profile?.tenant_id)
        .order('created_at', { ascending: false });

      if (custError) throw custError;

      // Fetch all bookings and payments to aggregate financials
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('*, payments(*)')
        .eq('tenant_id', profile?.tenant_id);

      // Aggregate data per customer
      const enrichedCustomers = (custData || []).map(customer => {
        const cBookings = (bookingsData || []).filter((b: any) => b.customer_id === customer.id);
        const totalBookings = cBookings.length;
        
        const totalBilled = cBookings.reduce((sum, b) => sum + Number(b.total_amount), 0);
        
        const totalPaid = cBookings.reduce((sum, b) => {
          const paidForBooking = (b.payments || []).reduce((pSum: number, p: any) => pSum + Number(p.amount), 0);
          return sum + paidForBooking;
        }, 0);
        
        const totalDue = totalBilled - totalPaid;

        return {
          ...customer,
          totalBookings,
          totalBilled,
          totalDue
        };
      });

      setCustomers(enrichedCustomers);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c => 
    (c.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.phone || '').includes(searchQuery)
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#00162C" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 24, paddingBottom: 120 }}>
      <View className="flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <View>
          <Text className="text-3xl font-black text-primary tracking-tight">Customer Directory</Text>
          <Text className="text-sm font-medium text-secondary/60 mt-1">Manage your clients and track their balances.</Text>
        </View>
        <View className="w-full md:w-auto">
          <TextInput 
            className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-primary font-bold min-w-[250px] shadow-sm"
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <View className="flex-row flex-wrap" style={{ marginHorizontal: -8 }}>
        {filteredCustomers.length === 0 ? (
          <View className="w-full p-8 items-center bg-white rounded-2xl border border-gray-200 shadow-sm mx-2">
            <Text className="text-lg font-bold text-secondary mb-1">No Customers Found</Text>
            <Text className="text-sm text-secondary/60">Try adjusting your search criteria.</Text>
          </View>
        ) : (
          filteredCustomers.map(customer => (
            <View key={customer.id} className="w-full md:w-1/2 lg:w-1/3 p-2">
              <View className="bg-white border border-gray-200 rounded-2xl p-6 h-full flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
                <View>
                  <View className="flex-row items-center gap-3 mb-5 pb-4 border-b border-gray-100">
                    <View className="w-12 h-12 bg-blue-50 rounded-full items-center justify-center border border-blue-100">
                      <Text className="text-blue-700 font-black text-lg">
                        {(customer.full_name || 'U').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-primary font-black text-lg mb-0.5" numberOfLines={1}>{customer.full_name}</Text>
                      <Text className="text-secondary/60 text-xs font-bold">{customer.phone}</Text>
                    </View>
                  </View>
                  
                  <View className="flex-row justify-between mb-6">
                    <View>
                      <Text className="text-[10px] font-bold text-secondary/50 uppercase tracking-widest mb-1">Bookings</Text>
                      <Text className="text-primary font-black text-xl">{customer.totalBookings}</Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-[10px] font-bold text-secondary/50 uppercase tracking-widest mb-1">Total Due</Text>
                      <Text className={`font-black text-xl ${customer.totalDue > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                        ₹{customer.totalDue}
                      </Text>
                    </View>
                  </View>
                </View>
                
                <TouchableOpacity 
                  className="w-full bg-gray-50 hover:bg-gray-100 border border-gray-200 py-3 rounded-xl shadow-sm items-center transition-colors"
                  onPress={() => router.push(`/customer/${customer.id}`)}
                >
                  <Text className="text-primary font-bold text-xs tracking-wider">VIEW PROFILE</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
