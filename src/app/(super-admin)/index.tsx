import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

// Reusable KPI Card Component
const KPICard = ({ title, value, subtitle, accentColor }: any) => (
  <View className={`bg-white p-5 rounded-2xl shadow-sm shadow-gray-200/50 flex-1 mx-2 border-l-4 ${accentColor} border-t border-b border-r border-gray-100`}>
    <Text className="text-[10px] font-bold text-secondary/50 uppercase tracking-widest mb-2">{title}</Text>
    <Text className="text-3xl font-black text-primary mb-1">{value}</Text>
    <Text className="text-xs font-medium text-secondary/70">{subtitle}</Text>
  </View>
);

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ totalRevenue: 0, totalCars: 0 });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch Tenants and their car counts
      const { data: tenantsData, error: tenantsError } = await supabase
        .from('tenants')
        .select(`
          id, 
          name, 
          cars (id)
        `);
        
      if (tenantsError) throw tenantsError;

      // Fetch all payments for total system revenue
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('amount');
        
      if (paymentsError) throw paymentsError;

      const revenue = paymentsData.reduce((sum, p) => sum + Number(p.amount), 0);
      const allCars = tenantsData.reduce((sum, t) => sum + (t.cars?.length || 0), 0);
      
      setTenants(tenantsData || []);
      setMetrics({ totalRevenue: revenue, totalCars: allCars });
    } catch (error: any) {
      console.error('Error fetching dashboard:', error.message);
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
    <ScrollView className="flex-1 bg-[#FAFAFA] p-8" showsVerticalScrollIndicator={false}>
      
      {/* Header Area */}
      <View className="flex-row justify-between items-center mb-8">
        <View>
          <Text className="text-2xl font-bold text-primary">Executive Management Center</Text>
          <Text className="text-sm text-secondary/60 mt-1">Monitor system-wide performance and active rental companies.</Text>
        </View>
        
        <View className="flex-row gap-3">
          <TouchableOpacity 
            className="bg-primary px-4 py-2 rounded-lg shadow-sm shadow-primary/30"
            onPress={() => router.push('/(super-admin)/onboard-tenant')}
          >
            <Text className="text-white font-semibold text-sm">+ Add Rental Company</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* KPI Cards Row */}
      <View className="flex-row justify-between mb-8 -mx-2">
        <KPICard 
          title="Total System Revenue" 
          value={`$${metrics.totalRevenue.toLocaleString()}`} 
          subtitle="All processed payments" 
          accentColor="border-l-blue-500" 
        />
        <KPICard 
          title="Rental Companies" 
          value={tenants.length} 
          subtitle="Active tenants" 
          accentColor="border-l-emerald-500" 
        />
        <KPICard 
          title="Total Cars Registered" 
          value={metrics.totalCars} 
          subtitle="System-wide fleet size" 
          accentColor="border-l-purple-500" 
        />
      </View>

      {/* Data Table Section */}
      <View className="bg-white rounded-2xl shadow-sm shadow-gray-200/50 border border-gray-100 p-6 mb-8">
        
        <View className="flex-row justify-between items-center mb-6">
          <Text className="text-lg font-bold text-primary">🏢 Active Rental Companies</Text>
          <View className="flex-row gap-4">
            <Text className="text-xs font-bold text-emerald-600">● Active</Text>
            <Text className="text-xs font-bold text-gray-400">● Inactive</Text>
          </View>
        </View>

        {/* Table Header */}
        <View className="flex-row border-b border-gray-100 pb-3 mb-3 px-2">
          <Text className="flex-1 text-[10px] font-bold text-secondary/40 uppercase tracking-widest">Company ID</Text>
          <Text className="flex-[2] text-[10px] font-bold text-secondary/40 uppercase tracking-widest">Company Name</Text>
          <Text className="flex-1 text-[10px] font-bold text-secondary/40 uppercase tracking-widest">Cars Registered</Text>
          <Text className="w-24 text-[10px] font-bold text-secondary/40 uppercase tracking-widest text-center">Status</Text>
          <Text className="w-24 text-[10px] font-bold text-secondary/40 uppercase tracking-widest text-right">Actions</Text>
        </View>

        {/* Table Rows */}
        {tenants.map((tenant, index) => (
          <View key={tenant.id} className={`flex-row items-center py-4 px-2 ${index !== tenants.length - 1 ? 'border-b border-gray-50' : ''}`}>
            
            <View className="flex-1">
              <Text className="text-primary font-bold text-xs">#{tenant.id.split('-')[0].toUpperCase()}</Text>
            </View>
            
            <View className="flex-[2]">
              <Text className="text-primary font-bold text-sm">{tenant.name}</Text>
            </View>
            
            <View className="flex-1">
              <Text className="text-secondary font-semibold text-xs">{tenant.cars?.length || 0} vehicles</Text>
            </View>
            
            <View className="w-24 items-center">
              <View className="bg-emerald-50 border border-emerald-100 px-2 py-1 rounded w-full items-center">
                <Text className="text-[10px] font-bold uppercase text-emerald-700">Active</Text>
              </View>
            </View>
            
            <View className="w-24 items-end flex-row justify-end" style={{ gap: 8 }}>
              <TouchableOpacity className="bg-[#F8F9FA] border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm">
                <Text className="text-primary font-bold text-[10px]">Manage</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {tenants.length === 0 && (
          <Text className="text-center text-gray-400 py-8">No rental companies found.</Text>
        )}

      </View>
      
    </ScrollView>
  );
}
