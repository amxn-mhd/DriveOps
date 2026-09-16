import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function OnboardTenantScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Tenant Details
  const [companyName, setCompanyName] = useState('');
  
  // Admin Details
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const handleOnboard = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    
    if (!companyName || !adminEmail || !adminPassword || !adminName) {
      setErrorMsg('All fields are required.');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, adminName, adminEmail, adminPassword })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to onboard tenant');
      }
      
      setSuccessMsg(`Account for ${adminEmail} has been provisioned! They can now log in.`);
      
      // Clear form
      setCompanyName('');
      setAdminName('');
      setAdminEmail('');
      setAdminPassword('');

    } catch (error: any) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-[#FAFAFA] p-8">
      <View className="mb-8">
        <Text className="text-2xl font-bold text-primary">Onboard New Rental Company</Text>
        <Text className="text-sm text-secondary/60 mt-1">Register a new tenant and configure their initial administrative access.</Text>
      </View>
      
      <View className="bg-white p-8 rounded-2xl shadow-sm shadow-gray-200/50 border border-gray-100 max-w-3xl">
        
        {errorMsg ? (
          <View className="bg-red-50 border border-red-200 p-4 rounded-xl mb-6">
            <Text className="text-red-700 font-bold">Error: {errorMsg}</Text>
          </View>
        ) : null}

        {successMsg ? (
          <View className="bg-emerald-50 border border-emerald-200 p-6 rounded-xl mb-6 items-center">
            <Text className="text-emerald-700 font-bold text-lg mb-2">Success!</Text>
            <Text className="text-emerald-600 mb-6 text-center">{successMsg}</Text>
            <TouchableOpacity 
              className="bg-emerald-600 px-6 py-3 rounded-lg shadow-sm shadow-emerald-200"
              onPress={() => router.push('/(super-admin)')}
            >
              <Text className="text-white font-bold tracking-wide">Return to Executive Center</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Section 1: Company Details */}
        <Text className="text-xs font-bold text-primary/70 uppercase tracking-widest mb-4">1. Company Profile</Text>
        <View className="mb-8">
          <Text className="text-xs font-bold text-secondary mb-2">COMPANY NAME *</Text>
          <TextInput 
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary font-medium"
            placeholder="e.g. Acme Exotics"
            value={companyName}
            onChangeText={setCompanyName}
          />
        </View>

        {/* Section 2: Admin Details */}
        <Text className="text-xs font-bold text-primary/70 uppercase tracking-widest mb-4">2. Administrator Credentials</Text>
        
        <View className="flex-row space-x-4 mb-4" style={{ gap: 16 }}>
          <View className="flex-1">
            <Text className="text-xs font-bold text-secondary mb-2">FULL NAME *</Text>
            <TextInput 
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary font-medium"
              placeholder="e.g. John Doe"
              value={adminName}
              onChangeText={setAdminName}
            />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-bold text-secondary mb-2">EMAIL ADDRESS *</Text>
            <TextInput 
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary font-medium"
              placeholder="admin@company.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={adminEmail}
              onChangeText={setAdminEmail}
            />
          </View>
        </View>

        <View className="flex-row space-x-4 mb-8" style={{ gap: 16 }}>
          <View className="flex-1">
            <Text className="text-xs font-bold text-secondary mb-2">TEMPORARY PASSWORD *</Text>
            <TextInput 
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary font-medium"
              placeholder="Must be at least 8 characters"
              secureTextEntry
              value={adminPassword}
              onChangeText={setAdminPassword}
            />
          </View>
          <View className="flex-1 justify-end pb-3">
             <Text className="text-[10px] text-secondary/50 font-medium">
               The administrator can reset this password upon their first login.
             </Text>
          </View>
        </View>

        <View className="border-t border-gray-100 pt-6 items-end">
          <TouchableOpacity 
            className="bg-primary px-8 py-4 rounded-xl flex-row items-center shadow-md shadow-primary/30"
            onPress={handleOnboard}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold tracking-wide">Register & Provision Tenant</Text>
            )}
          </TouchableOpacity>
        </View>

      </View>
    </ScrollView>
  );
}
