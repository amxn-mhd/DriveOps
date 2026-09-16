import { View, Text, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { Slot, useRouter, usePathname } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';

export default function TenantLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetchUserAndTenant();
  }, []);

  const fetchUserAndTenant = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*, tenants(*)')
      .eq('id', user.id)
      .single();

    if (profileData) {
      setProfile(profileData);
      setTenant(profileData.tenants);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error(e);
    } finally {
      if (Platform.OS === 'web') {
        window.location.href = '/';
      } else {
        router.replace('/');
      }
    }
  };

  const SidebarContent = () => (
    <View className="flex-1 justify-between py-6 px-4">
      <View>
        <View className="mb-10 px-2 flex-row justify-between items-center">
          <View>
            <Text className="text-2xl font-extrabold text-primary tracking-tight">DriveOps.</Text>
            <Text className="text-[10px] uppercase font-bold text-secondary/50 tracking-widest mt-1">
              Fleet Management
            </Text>
          </View>
          {/* Mobile close button */}
          <TouchableOpacity className="md:hidden p-2" onPress={() => setIsMobileMenuOpen(false)}>
            <Text className="text-primary font-bold text-xl">✕</Text>
          </TouchableOpacity>
        </View>

        <View className="space-y-2">
          <TouchableOpacity 
            className="bg-primary/10 px-4 py-3 rounded-xl flex-row items-center border border-primary/5 mb-2"
            onPress={() => { router.push('/(tenant-admin)'); setIsMobileMenuOpen(false); }}
          >
            <Text className="text-primary font-bold">📊 Dashboard</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            className="bg-primary/5 px-4 py-3 rounded-xl flex-row items-center border border-primary/5 mb-2"
            onPress={() => { router.push('/(tenant-admin)/fleet'); setIsMobileMenuOpen(false); }}
          >
            <Text className="text-primary font-bold">🚗 Vehicle List</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            className="bg-primary/5 px-4 py-3 rounded-xl flex-row items-center border border-primary/5 mb-2"
            onPress={() => { router.push('/(tenant-admin)/availability'); setIsMobileMenuOpen(false); }}
          >
            <Text className="text-primary font-bold">📅 Availability</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            className="bg-primary/5 px-4 py-3 rounded-xl flex-row items-center border border-primary/5 mb-2"
            onPress={() => { router.push('/(tenant-admin)/customers'); setIsMobileMenuOpen(false); }}
          >
            <Text className="text-primary font-bold">👥 Customers</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="border-t border-gray-100 pt-6 px-2">
        <View className="flex-row items-center mb-5">
          <View className="w-10 h-10 bg-primary/10 rounded-full mr-3 items-center justify-center border border-primary/20">
            <Text className="text-primary font-bold">{profile?.full_name?.charAt(0) || 'U'}</Text>
          </View>
          <View>
            <Text className="text-sm font-bold text-primary">{profile?.full_name || 'Loading...'}</Text>
            <View className="bg-primary/5 px-2 py-0.5 rounded mt-1 self-start border border-primary/10">
              <Text className="text-[10px] font-bold text-primary">{tenant?.name || 'Workspace'}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity 
          onPress={handleLogout} 
          className="border border-red-100 bg-red-50 py-3 rounded-xl items-center flex-row justify-center shadow-sm shadow-red-100"
        >
          <Text className="text-red-600 font-bold text-xs tracking-wide">🔒 Secure Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View className="flex-1 flex-col md:flex-row bg-[#FAFAFA]">
      
      {/* Mobile Top Header */}
      <View className="md:hidden flex-row justify-between items-center bg-white px-4 py-4 border-b border-gray-200 z-50">
        <Text className="text-xl font-extrabold text-primary tracking-tight">DriveOps.</Text>
        <TouchableOpacity onPress={() => setIsMobileMenuOpen(true)} className="p-2 bg-gray-100 rounded-lg">
          <Text className="text-lg">☰</Text>
        </TouchableOpacity>
      </View>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <View className="absolute inset-0 z-50 flex-row md:hidden">
          <View className="w-4/5 bg-white shadow-2xl h-full">
            <SidebarContent />
          </View>
          <TouchableOpacity 
            className="flex-1 bg-black/50" 
            onPress={() => setIsMobileMenuOpen(false)} 
            activeOpacity={1}
          />
        </View>
      )}

      {/* Desktop Sidebar */}
      <View className="w-64 bg-white border-r border-gray-200 hidden md:flex h-full">
        <SidebarContent />
      </View>

      {/* Main Content Area */}
      <View className="flex-1 overflow-hidden">
        <Slot />
      </View>

      {/* Mobile Bottom Navigation Bar */}
      <View className="md:hidden flex-row justify-around items-center bg-white border-t border-gray-200 pb-6 pt-2 px-2 shadow-2xl z-50">
        <TouchableOpacity 
          onPress={() => router.push('/(tenant-admin)')} 
          className={`items-center p-2 flex-1 rounded-xl ${pathname === '/' ? 'bg-primary/10' : ''}`}
        >
          <Text className="text-xl mb-1">📊</Text>
          <Text className={`text-[10px] font-bold ${pathname === '/' ? 'text-primary' : 'text-gray-500'}`}>Dash</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => router.push('/(tenant-admin)/fleet')} 
          className={`items-center p-2 flex-1 rounded-xl ${pathname === '/fleet' ? 'bg-primary/10' : ''}`}
        >
          <Text className="text-xl mb-1">🚗</Text>
          <Text className={`text-[10px] font-bold ${pathname === '/fleet' ? 'text-primary' : 'text-gray-500'}`}>Fleet</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => router.push('/(tenant-admin)/availability')} 
          className={`items-center p-2 flex-1 rounded-xl ${pathname === '/availability' ? 'bg-primary/10' : ''}`}
        >
          <Text className="text-xl mb-1">📅</Text>
          <Text className={`text-[10px] font-bold ${pathname === '/availability' ? 'text-primary' : 'text-gray-500'}`}>Avail</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => router.push('/(tenant-admin)/customers')} 
          className={`items-center p-2 flex-1 rounded-xl ${pathname === '/customers' || pathname.startsWith('/customer/') ? 'bg-primary/10' : ''}`}
        >
          <Text className="text-xl mb-1">👥</Text>
          <Text className={`text-[10px] font-bold ${pathname === '/customers' || pathname.startsWith('/customer/') ? 'text-primary' : 'text-gray-500'}`}>Clients</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}
