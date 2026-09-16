import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const FeatureItem = ({ icon, text }: { icon: string, text: string }) => (
  <View className="flex-row items-center mb-4">
    <View className="w-8 h-8 rounded-full bg-white items-center justify-center mr-3 border border-gray-200 shadow-sm">
      <Text className="text-sm">{icon}</Text>
    </View>
    <Text className="text-secondary font-medium text-sm md:text-base">{text}</Text>
  </View>
);

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    checkSession();

    // Listen for sign out events so we don't accidentally re-route
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setInitializing(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await routeUserByRole(session.user.id);
    } else {
      setInitializing(false);
    }
  };

  // Developer Quick Login Helper
  const quickLogin = (userEmail: string, pass: string) => {
    setEmail(userEmail);
    setPassword(pass);
  };

  const routeUserByRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (error || !data) {
        throw new Error('Could not find user role');
      }

      if (data.role === 'super_admin') {
        router.replace('/(super-admin)');
      } else if (data.role === 'tenant_admin' || data.role === 'staff') {
        router.replace('/(tenant-admin)');
      } else {
        Alert.alert('Error', 'Unauthorized role.');
        setInitializing(false);
        setLoading(false);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
      setInitializing(false);
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setErrorMsg('');
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setLoading(true);
    
    try {
      const { error, data } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) throw error;
      
      if (data?.user) {
        await routeUserByRole(data.user.id);
      }
    } catch (error: any) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (initializing) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#00162C" />
      </View>
    );
  }

  return (
    <ScrollView 
      contentContainerStyle={{ flexGrow: 1 }} 
      className="bg-[#FAFAFA]"
      showsVerticalScrollIndicator={false}
    >
      <View className="flex-1 flex-col md:flex-row">
        
        {/* Decorative Background Elements (Visible mostly on Web) */}
      {Platform.OS === 'web' && (
        <View className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-30 pointer-events-none z-0">
          {/* Deep Navy Blob */}
          <View className="absolute -top-[10%] -left-[10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[140px]" />
          {/* Warm Espresso Blob */}
          <View className="absolute top-[50%] right-[-10%] w-[600px] h-[600px] bg-secondary/15 rounded-full blur-[150px]" />
        </View>
      )}

      {/* Left Column: Branding & Features */}
      <View className="flex-1 justify-center px-8 py-12 md:px-16 lg:px-24 z-10">
        <View className="bg-primary/5 self-start px-4 py-2 rounded-full mb-8 flex-row items-center border border-primary/10">
          <Text className="text-primary text-xs font-extrabold uppercase tracking-widest">✦ Secure Partner Portal</Text>
        </View>
        
        <Text className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-primary tracking-tight mb-5">
          DriveOps.
        </Text>
        
        <Text className="text-base md:text-lg text-secondary/80 mb-12 leading-relaxed max-w-lg font-medium">
          A premium, multi-tenant administrative engine designed to track fleet logistics, manage customer reservations, and monitor revenue in real time.
        </Text>

        <View className="space-y-2">
          <FeatureItem icon="🛡️" text="Enterprise-grade PostgreSQL Security" />
          <FeatureItem icon="🏎️" text="Real-Time Fleet & Maintenance Tracking" />
          <FeatureItem icon="📈" text="Automated Revenue & Expense Analytics" />
        </View>
      </View>

      {/* Right Column: Login Card */}
      <View className="flex-1 justify-center px-6 py-12 md:px-16 items-center z-10">
        <View className="w-full max-w-md bg-white rounded-[32px] p-8 md:p-10 shadow-2xl shadow-primary/10 border border-gray-100">
          
          <Text className="text-2xl font-bold text-primary mb-1">Welcome Back</Text>
          <Text className="text-sm text-secondary/60 mb-10 font-medium">Authorize session to access your workspace queue.</Text>

          {/* Form Inputs */}
          <View className="mb-6">
            <Text className="text-xs font-bold text-primary/70 uppercase tracking-widest mb-2 ml-1">Corporate Email</Text>
            <TextInput 
              className="w-full bg-[#F8F9FA] border border-gray-200 rounded-2xl px-5 py-4 text-primary font-medium focus:border-primary/50 focus:bg-white"
              placeholder="name@company.com"
              placeholderTextColor="#A0AAB5"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View className="mb-8">
            <Text className="text-xs font-bold text-primary/70 uppercase tracking-widest mb-2 ml-1">Security Password</Text>
            <TextInput 
              className="w-full bg-[#F8F9FA] border border-gray-200 rounded-2xl px-5 py-4 text-primary font-medium focus:border-primary/50 focus:bg-white"
              placeholder="••••••••"
              placeholderTextColor="#A0AAB5"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {/* Action Button */}
          <TouchableOpacity 
            className="w-full bg-primary rounded-2xl py-4 shadow-lg shadow-primary/30 items-center justify-center flex-row mb-8"
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-base tracking-wide">Sign In to Workspace</Text>
            )}
          </TouchableOpacity>

          {/* Developer Quick Login Section */}
          <View className="border-t border-gray-100 pt-6">
            <Text className="text-[10px] font-bold text-center text-primary/40 uppercase tracking-widest mb-4">
              Developer Quick Login
            </Text>
            
            <View className="flex-row mb-3">
              <TouchableOpacity 
                className="flex-1 bg-primary/5 border border-primary/10 py-3 rounded-xl items-center"
                onPress={() => {
                  setEmail('admin@driveops.com');
                  setPassword('password123');
                }}
              >
                <Text className="text-xs font-bold text-primary">Super Admin</Text>
              </TouchableOpacity>
            </View>

            {errorMsg ? (
              <View className="bg-red-50 border border-red-200 p-4 rounded-xl mb-6">
                <Text className="text-red-700 font-bold">{errorMsg}</Text>
              </View>
            ) : null}

            <View className="flex-row justify-between" style={{ gap: 12 }}>
              <TouchableOpacity 
                className="flex-1 bg-gray-50 border border-gray-200 py-3 rounded-xl items-center"
                onPress={() => {
                  setEmail('tenant@driveops.com');
                  setPassword('password123');
                }}
              >
                <Text className="text-xs font-bold text-primary text-center">City Rentals</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                className="flex-1 bg-gray-50 border border-gray-200 py-3 rounded-xl items-center px-1"
                onPress={() => {
                  setEmail('premium@driveops.com');
                  setPassword('password123');
                }}
              >
                <Text className="text-xs font-bold text-primary text-center">Premium Exotics</Text>
              </TouchableOpacity>
            </View>
          </View>
          
        </View>
      </View>
      
      </View>
    </ScrollView>
  );
}
