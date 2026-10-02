import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'expo-router';

export default function VendorsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user?.id).single();
      
      if (profile?.tenant_id) {
        // Fetch vendors
        const { data: vData } = await supabase.from('vendors').select('*').eq('tenant_id', profile.tenant_id);
        
        // Fetch brokered bookings to calculate stats
        const { data: brokeredBookings } = await supabase
          .from('bookings')
          .select('vendor_id, vendor_cost')
          .eq('tenant_id', profile.tenant_id)
          .not('vendor_id', 'is', null);
          
        if (vData) {
          const finalVendors = vData.map((v: any) => {
            const vBookings = (brokeredBookings || []).filter((b: any) => b.vendor_id === v.id);
            const totalBookings = vBookings.length;
            const totalCost = vBookings.reduce((sum: number, b: any) => sum + Number(b.vendor_cost || 0), 0);
            return { ...v, totalBookings, totalCost };
          }).sort((a: any, b: any) => b.totalCost - a.totalCost);
          
          setVendors(finalVendors);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredVendors = vendors.filter(v => 
    v.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.phone?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ScrollView className="flex-1 bg-[#FAFAFA]" contentContainerStyle={{ padding: 20 }}>
      <View className="mb-6 flex-col md:flex-row md:items-center justify-between gap-4">
        <View>
          <Text className="text-3xl font-black text-primary tracking-tight mb-2">Vendors & Suppliers</Text>
          <Text className="text-secondary/60">Manage your third-party fleet suppliers and brokered costs.</Text>
        </View>
      </View>

      <View className="mb-6 flex-row gap-4">
        <TextInput
          className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-primary font-medium shadow-sm"
          placeholder="Search by company name or phone..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#00162C" />
      ) : filteredVendors.length === 0 ? (
        <View className="bg-white rounded-2xl border border-gray-200 border-dashed p-8 items-center justify-center">
          <Text className="text-gray-400 font-medium">No vendors found. Add them when dispatching a vehicle.</Text>
        </View>
      ) : (
        <View className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVendors.map((vendor) => (
            <TouchableOpacity 
              key={vendor.id}
              onPress={() => router.push(`/vendor/${vendor.id}`)}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
            >
              <View className="flex-row items-center mb-4">
                <View className="w-12 h-12 bg-purple-100 rounded-full items-center justify-center mr-4 border border-purple-200">
                  <Text className="text-purple-700 font-black text-xl">{vendor.company_name.charAt(0).toUpperCase()}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-lg font-black text-primary" numberOfLines={1}>{vendor.company_name}</Text>
                  <Text className="text-xs text-secondary/50 font-medium">{vendor.phone || 'No phone'}</Text>
                </View>
              </View>
              
              <View className="flex-row justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
                <View>
                  <Text className="text-[10px] font-bold text-secondary/50 uppercase mb-1">Total Trips</Text>
                  <Text className="font-bold text-primary">{vendor.totalBookings}</Text>
                </View>
                <View className="items-end">
                  <Text className="text-[10px] font-bold text-secondary/50 uppercase mb-1">Total Paid (Cost)</Text>
                  <Text className="font-black text-red-500">₹{vendor.totalCost}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
