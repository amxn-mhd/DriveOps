import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Slot, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';

export default function SuperAdminLayout() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileData) {
      setProfile(profileData);
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

  return (
    <View className="flex-1 flex-row bg-[#FAFAFA]">
      {/* Sidebar */}
      <View className="w-64 bg-white border-r border-gray-200 py-6 px-4 flex-col justify-between hidden md:flex">
        <View>
          <View className="mb-10 px-2">
            <Text className="text-2xl font-extrabold text-primary tracking-tight">DriveOps.</Text>
            <Text className="text-[10px] uppercase font-bold text-secondary/50 tracking-widest mt-1">
              Super Admin Portal
            </Text>
          </View>

          <View className="space-y-2">
            <TouchableOpacity 
              className="bg-primary/10 px-4 py-3 rounded-xl flex-row items-center border border-primary/5"
              onPress={() => router.push('/(super-admin)')}
            >
              <Text className="text-primary font-bold">📊 Executive Center</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="px-4 py-3 rounded-xl flex-row items-center"
              onPress={() => router.push('/(super-admin)')}
            >
              <Text className="text-secondary/60 font-bold hover:text-primary">🏢 Rental Companies</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              className="px-4 py-3 rounded-xl flex-row items-center"
              onPress={() => router.push('/(super-admin)/onboard-tenant')}
            >
              <Text className="text-secondary/60 font-bold hover:text-primary">➕ Add New Company</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="border-t border-gray-100 pt-6 px-2">
          <View className="flex-row items-center mb-5">
            <View className="w-10 h-10 bg-primary/10 rounded-full mr-3 items-center justify-center border border-primary/20">
              <Text className="text-primary font-bold">{profile?.full_name?.charAt(0) || 'S'}</Text>
            </View>
            <View>
              <Text className="text-sm font-bold text-primary">{profile?.full_name || 'Loading...'}</Text>
              <View className="bg-primary/5 px-2 py-0.5 rounded mt-1 self-start border border-primary/10">
                <Text className="text-[10px] font-bold text-primary">System Admin</Text>
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

      {/* Main Content Area */}
      <View className="flex-1 overflow-hidden">
        <Slot />
      </View>
    </View>
  );
}
