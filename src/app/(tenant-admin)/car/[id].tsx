import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Image, TextInput, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import { Calendar } from 'react-native-calendars';

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

let globalPaymentLock = false;
let globalEmiLock = false;
export default function CarDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [car, setCar] = useState<any>(null);
  const [bookedDates, setBookedDates] = useState<any>({});
  const [carBookings, setCarBookings] = useState<any[]>([]);
  
  // Analytics & Maintenance States

const WebDatePicker = ({ value, onChange }: any) => {
  if (Platform.OS === 'web') {
    return (
      <input
        type="date"
        value={value}
        onChange={(e: any) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '12px 16px',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
          color: '#111827',
          fontWeight: 'bold',
          fontSize: '16px',
          outline: 'none'
        }}
      />
    );
  }
  return (
    <TextInput 
      className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary font-bold text-base"
      placeholder="YYYY-MM-DD"
      value={value}
      onChangeText={onChange}
    />
  );
};

  const [maintenanceRecords, setMaintenanceRecords] = useState<any[]>([]);
  
  // EMI State
  const [emiRecords, setEmiRecords] = useState<any[]>([]);
  const [showEmiModal, setShowEmiModal] = useState(false);
  const [emiDate, setEmiDate] = useState('');
  const [emiAmount, setEmiAmount] = useState('');
  const [emiUploading, setEmiUploading] = useState(false);

  // Calculate pending EMI
  const totalEmiPaid = emiRecords.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const pendingEmi = (car?.finance_amount || 0) - totalEmiPaid;

  const [analyticsFilter, setAnalyticsFilter] = useState('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [editMaintenanceId, setEditMaintenanceId] = useState<string | null>(null);
  const [mDate, setMDate] = useState(new Date().toISOString().split('T')[0]);
  const [mWorkshop, setMWorkshop] = useState('');
  const [mDesc, setMDesc] = useState('');
  const [mAmount, setMAmount] = useState('');
  const [mImage, setMImage] = useState<any>(null);
  const [mUploading, setMUploading] = useState(false);
  
  // Ledger Modal States
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (id) {
      fetchCarDetails();
    }
  }, [id]);

  const fetchCarDetails = async () => {
    try {
      // Fetch car
      const { data: carData } = await supabase
        .from('cars')
        .select('*')
        .eq('id', id)
        .single();
      
      setCar(carData);

      // Fetch Maintenance Records
      const { data: maintenance } = await supabase
        .from('maintenance_records')
        .select('*')
        .eq('car_id', id)
        .order('date', { ascending: false });
      setMaintenanceRecords(maintenance || []);

      // Fetch all bookings for history and calendar, including payments
      const { data: bookings } = await supabase
        .from('bookings')
        .select('*, customers(full_name), payments(*)')
        .eq('car_id', id)
        .order('start_date', { ascending: false });

      setCarBookings(bookings || []);

      let marked: any = {};
      if (bookings) {
        bookings.filter((b: any) => b.status === 'active' || b.status === 'pending').forEach((b: any) => {
          let curr = new Date(b.start_date);
          const end = new Date(b.end_date);
          while (curr <= end) {
            const dateString = curr.toISOString().split('T')[0];
            marked[dateString] = { disabled: true, disableTouchEvent: true, color: '#f1f5f9', textColor: '#cbd5e1', startingDay: true, endingDay: true };
            curr.setDate(curr.getDate() + 1);
          }
        });
      }
      setBookedDates(marked);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  
  const handleRecordPayment = async () => {
    if (globalPaymentLock) return;
    
    setPaymentError('');
    if (!selectedBooking || !paymentAmount || isNaN(parseFloat(paymentAmount))) return;
    
    const amount = parseFloat(paymentAmount);
    if (amount <= 0) {
      setPaymentError('Payment amount must be greater than zero.');
      return;
    }

    const totalPaid = (selectedBooking.payments || []).reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const remainingBalance = Number(selectedBooking.total_amount) - totalPaid;

    if (amount > remainingBalance) {
      setPaymentError(`Payment of ₹${amount} exceeds the remaining balance of ₹${remainingBalance}.`);
      return;
    }

    globalPaymentLock = true;
    setIsProcessingPayment(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user?.id).single();
      
      const { error } = await supabase.from('payments').insert([{
        tenant_id: profile?.tenant_id,
        booking_id: selectedBooking.id,
        amount: parseFloat(paymentAmount),
        method: 'cash'
      }]);
      
      if (error) throw error;
      
      setPaymentAmount('');
      // Optimistically update the selected booking
      const newPayment = { amount: parseFloat(paymentAmount), created_at: new Date().toISOString() };
      setSelectedBooking({
        ...selectedBooking,
        payments: [...(selectedBooking.payments || []), newPayment]
      });
      // Refresh background data
      fetchCarDetails();
      
    } catch (err: any) {
      setPaymentError(err.message || 'Failed to record payment.');
    } finally {
      setIsProcessingPayment(false);
      setTimeout(() => { globalPaymentLock = false; }, 1000);
    }
  };
  
  const getAnalytics = () => {
    let filtered = carBookings || [];
    const now = new Date();
    
    if (analyticsFilter === 'this_month') {
      filtered = filtered.filter((b: any) => {
        const d = new Date(b.start_date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
    } else if (analyticsFilter === 'last_month') {
      filtered = filtered.filter((b: any) => {
        const d = new Date(b.start_date);
        const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        return d.getMonth() === lastMonth && d.getFullYear() === year;
      });
    } else if (analyticsFilter === 'custom' && filterStartDate && filterEndDate) {
      filtered = filtered.filter((b: any) => {
        return b.start_date >= filterStartDate && b.start_date <= filterEndDate;
      });
    }
    
    let filteredMaintenance = maintenanceRecords || [];
    if (analyticsFilter === 'this_month') {
      filteredMaintenance = filteredMaintenance.filter((m: any) => {
        const d = new Date(m.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
    } else if (analyticsFilter === 'last_month') {
      filteredMaintenance = filteredMaintenance.filter((m: any) => {
        const d = new Date(m.date);
        const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        return d.getMonth() === lastMonth && d.getFullYear() === year;
      });
    } else if (analyticsFilter === 'custom' && filterStartDate && filterEndDate) {
      filteredMaintenance = filteredMaintenance.filter((m: any) => {
        return m.date >= filterStartDate && m.date <= filterEndDate;
      });
    }
    const totalMaintenance = filteredMaintenance.reduce((s: number, m: any) => s + Number(m.bill_amount), 0);

    const totalBookings = filtered.length;
    const grossRevenue = filtered.reduce((s, b) => s + Number(b.total_amount), 0);
    const collectedRevenue = filtered.reduce((s, b) => {
      const paid = (b.payments || []).reduce((ps: number, p: any) => ps + Number(p.amount), 0);
      return s + paid;
    }, 0);
    const pendingDues = grossRevenue - collectedRevenue;
    
    return { totalBookings, grossRevenue, collectedRevenue, pendingDues, totalMaintenance };
  };

  const analytics = getAnalytics();
  const isSubmittingRef = useRef(false);

  const executeDeleteBooking = async () => {
    if (!selectedBooking) return;
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', selectedBooking.id);
      if (error) throw error;
      setSelectedBooking(null);
      fetchCarDetails();
      Alert.alert('Deleted', 'Booking deleted successfully.');
    } catch (e: any) {
      if (Platform.OS === 'web') { window.alert('Error: ' + e.message); } else { Alert.alert('Error', e.message); }
    }
  };

  const handleDeleteBooking = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this booking? This will also delete all associated payments.')) {
        executeDeleteBooking();
      }
    } else {
      Alert.alert('Delete Booking', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: executeDeleteBooking }
      ]);
    }
  };

  const executeDeleteMaintenance = async (mId: string) => {
    try {
      const { error } = await supabase.from('maintenance_records').delete().eq('id', mId);
      if (error) throw error;
      fetchCarDetails();
      setShowMaintenanceModal(false);
      Alert.alert('Deleted', 'Maintenance record deleted successfully.');
    } catch (e: any) {
      if (Platform.OS === 'web') { window.alert('Error: ' + e.message); } else { Alert.alert('Error', e.message); }
    }
  };

  const handleDeleteMaintenance = (mId: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this maintenance record permanently?')) {
        executeDeleteMaintenance(mId);
      }
    } else {
      Alert.alert('Delete Record', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => executeDeleteMaintenance(mId) }
      ]);
    }
  };

  const executeDeleteCar = async () => {
    try {
      await supabase.from('cars').delete().eq('id', id);
      router.replace('/(tenant-admin)');
    } catch (e: any) {
      if (Platform.OS === 'web') { window.alert('Error: ' + e.message); } else { Alert.alert('Error', e.message); }
    }
  };

  const handleDeleteCar = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you absolutely sure you want to delete this vehicle and all its history?')) {
        executeDeleteCar();
      }
    } else {
      Alert.alert('Delete Vehicle', 'This will delete the vehicle and all history.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: executeDeleteCar }
      ]);
    }
  };

  const handlePickMaintenanceBill = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'image/*' });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        setMImage(res.assets[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmitEmi = async () => {
    if (globalEmiLock || emiUploading) return;
    
    if (!emiDate || !emiAmount || isNaN(parseFloat(emiAmount))) {
      if (Platform.OS === 'web') window.alert('Valid date and amount are required.');
      else Alert.alert('Error', 'Valid date and amount are required.');
      return;
    }
    
    globalEmiLock = true;
    setEmiUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user?.id).single();
      
      const { error } = await supabase.from('emi_payments').insert({
        tenant_id: profile?.tenant_id,
        car_id: id,
        payment_date: emiDate,
        amount: parseFloat(emiAmount)
      });
      
      if (error) throw error;
      
      setShowEmiModal(false);
      setEmiDate('');
      setEmiAmount('');
      // Manually push to local state to instantly update UI before fetch completes
      const newRecord = { id: Math.random().toString(), payment_date: emiDate, amount: parseFloat(emiAmount) };
      setEmiRecords(prev => [newRecord, ...prev]);
      
      fetchCarDetails();
      
    } catch (e: any) {
      console.error("EMI Save Error:", e);
      Alert.alert('Error Saving EMI', e.message || 'Unknown error occurred. Did you run the SQL script to create the emi_payments table?');
    } finally {
      setEmiUploading(false);
      setTimeout(() => { globalEmiLock = false; }, 1000);
    }
  };

  const executeDeleteEmi = async (eId: string) => {
    try {
      const { error } = await supabase.from('emi_payments').delete().eq('id', eId);
      if (error) throw error;
      fetchCarDetails();
    } catch (e: any) {
      if (Platform.OS === 'web') window.alert('Error: ' + e.message);
      else Alert.alert('Error', e.message);
    }
  };

  const handleDeleteEmi = (eId: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this EMI record?')) {
        executeDeleteEmi(eId);
      }
    } else {
      Alert.alert('Delete EMI', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => executeDeleteEmi(eId) }
      ]);
    }
  };

  const handleSubmitMaintenance = async () => {
    if (isSubmittingRef.current || mUploading) return;
    
    if (!mDate || !mAmount || isNaN(parseFloat(mAmount))) {
      Alert.alert('Error', 'Valid date and amount are required.');
      return;
    }
    
    isSubmittingRef.current = true;
    setMUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user?.id).single();
      
      let imageUrl = null;
      if (mImage && mImage.uri) { // Only upload if it's a NEW image (has a URI from picker)
        const fileName = `maint_${id}_${Date.now()}.jpg`;
        const response = await fetch(mImage.uri);
        const blob = await response.blob();
        
        const { error: uploadError } = await supabase.storage
          .from('vehicle_documents')
          .upload(`maintenance/${fileName}`, blob);
          
        if (uploadError) throw uploadError;
        
        const { data: publicUrlData } = supabase.storage.from('vehicle_documents').getPublicUrl(`maintenance/${fileName}`);
        imageUrl = publicUrlData.publicUrl;
      }
      
      const payload: any = {
        car_id: id,
        tenant_id: profile?.tenant_id,
        date: mDate,
        workshop_name: mWorkshop,
        description: mDesc,
        bill_amount: parseFloat(mAmount)
      };
      
      if (imageUrl) {
        payload.bill_image_url = imageUrl;
      }

      if (editMaintenanceId) {
        const { error: updateError } = await supabase.from('maintenance_records').update(payload).eq('id', editMaintenanceId);
        if (updateError) throw updateError;
        Alert.alert('Success', 'Maintenance record updated.');
      } else {
        const { error: insertError } = await supabase.from('maintenance_records').insert([payload]);
        if (insertError) throw insertError;
        Alert.alert('Success', 'Maintenance record added.');
      }
      
      fetchCarDetails();
      setShowMaintenanceModal(false);
      setMWorkshop(''); setMDesc(''); setMAmount(''); setMImage(null); setEditMaintenanceId(null);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setMUploading(false);
      setTimeout(() => { isSubmittingRef.current = false; }, 1000);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#FAFAFA]">
        <ActivityIndicator size="large" color="#00162C" />
      </View>
    );
  }

  if (!car) {
    return (
      <View className="flex-1 items-center justify-center bg-[#FAFAFA]">
        <Text>Car not found.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 relative"><ScrollView className="flex-1 bg-[#FAFAFA] p-8" contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
      <View className="flex-col md:flex-row md:justify-between items-start md:items-center mb-8 space-y-4 md:space-y-0">
        <View>
          <Text className="text-2xl font-bold text-primary">Vehicle Profile</Text>
          <Text className="text-sm text-secondary/60 mt-1">Review availability and specifications before booking.</Text>
        </View>
        <View className="flex-row flex-wrap gap-2 w-full md:w-auto mt-4 md:mt-0">
          <TouchableOpacity 
            className="bg-white border border-gray-200 px-4 py-2 rounded-lg shadow-sm"
            onPress={() => router.canGoBack() ? router.back() : router.replace("/(tenant-admin)")}
          >
            <Text className="text-secondary/70 font-semibold text-sm">Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Financial Analytics Dashboard */}
      <View className="mb-8">
        <View className="flex-col md:flex-row justify-between items-start md:items-center mb-4 space-y-3 md:space-y-0">
          <Text className="text-xl font-bold text-primary">Financial Overview</Text>
          <View className="w-full md:w-auto">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
                <TouchableOpacity onPress={() => setAnalyticsFilter('all')} className={`px-4 py-2 rounded-md ${analyticsFilter === 'all' ? 'bg-primary' : ''}`}>
                  <Text className={`text-xs font-bold ${analyticsFilter === 'all' ? 'text-white' : 'text-secondary/60'}`}>All Time</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setAnalyticsFilter('this_month')} className={`px-4 py-2 rounded-md ${analyticsFilter === 'this_month' ? 'bg-primary' : ''}`}>
                  <Text className={`text-xs font-bold ${analyticsFilter === 'this_month' ? 'text-white' : 'text-secondary/60'}`}>This Month</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setAnalyticsFilter('last_month')} className={`px-4 py-2 rounded-md ${analyticsFilter === 'last_month' ? 'bg-primary' : ''}`}>
                  <Text className={`text-xs font-bold ${analyticsFilter === 'last_month' ? 'text-white' : 'text-secondary/60'}`}>Last Month</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setAnalyticsFilter('custom')} className={`px-4 py-2 rounded-md ${analyticsFilter === 'custom' ? 'bg-primary' : ''}`}>
                  <Text className={`text-xs font-bold ${analyticsFilter === 'custom' ? 'text-white' : 'text-secondary/60'}`}>Custom</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
        
        {analyticsFilter === 'custom' && (
          <View className="flex-col sm:flex-row gap-4 mb-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
            <View className="flex-1">
              <Text className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1">From Date</Text>
              <WebDatePicker value={filterStartDate} onChange={setFilterStartDate} />
            </View>
            <View className="flex-1">
              <Text className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1">To Date</Text>
              <WebDatePicker value={filterEndDate} onChange={setFilterEndDate} />
            </View>
          </View>
        )}
        
        <View className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
          <View className="w-1/2 md:w-1/4 p-1">
            <View className="bg-white border-l-4 border-l-blue-500 border-t border-b border-r border-gray-100 p-4 rounded-xl shadow-sm h-full justify-between">
              <Text className="text-[9px] md:text-[10px] font-bold text-secondary/50 uppercase tracking-widest mb-2">Total Bookings</Text>
              <Text className="text-2xl md:text-3xl font-black text-primary" numberOfLines={1} adjustsFontSizeToFit>{analytics.totalBookings}</Text>
            </View>
          </View>
          <View className="w-1/2 md:w-1/4 p-1">
            <View className="bg-white border-l-4 border-l-purple-500 border-t border-b border-r border-gray-100 p-4 rounded-xl shadow-sm h-full justify-between">
              <Text className="text-[9px] md:text-[10px] font-bold text-secondary/50 uppercase tracking-widest mb-2">Gross Revenue</Text>
              <Text className="text-2xl md:text-3xl font-black text-primary" numberOfLines={1} adjustsFontSizeToFit>₹{analytics.grossRevenue}</Text>
            </View>
          </View>
          <View className="w-1/2 md:w-1/4 p-1">
            <View className="bg-white border-l-4 border-l-emerald-500 border-t border-b border-r border-gray-100 p-4 rounded-xl shadow-sm h-full justify-between">
              <Text className="text-[9px] md:text-[10px] font-bold text-secondary/50 uppercase tracking-widest mb-2">Collected</Text>
              <Text className="text-2xl md:text-3xl font-black text-primary" numberOfLines={1} adjustsFontSizeToFit>₹{analytics.collectedRevenue}</Text>
            </View>
          </View>
          <View className="w-1/2 md:w-1/4 p-1">
            <View className="bg-white border-l-4 border-l-red-500 border-t border-b border-r border-gray-100 p-4 rounded-xl shadow-sm h-full justify-between">
              <Text className="text-[9px] md:text-[10px] font-bold text-secondary/50 uppercase tracking-widest mb-2">Pending Dues</Text>
              <Text className="text-2xl md:text-3xl font-black text-primary" numberOfLines={1} adjustsFontSizeToFit>₹{analytics.pendingDues}</Text>
            </View>
          </View>
          <View className="w-1/2 md:w-1/4 p-1">
            <View className="bg-white border-l-4 border-l-orange-500 border-t border-b border-r border-gray-100 p-4 rounded-xl shadow-sm h-full justify-between">
              <Text className="text-[9px] md:text-[10px] font-bold text-secondary/50 uppercase tracking-widest mb-2">Maintenance Cost</Text>
              <Text className="text-2xl md:text-3xl font-black text-primary" numberOfLines={1} adjustsFontSizeToFit>₹{analytics.totalMaintenance}</Text>
            </View>
          </View>
          {car?.is_financed && (
            <View className="w-1/2 md:w-1/4 p-1">
              <View className="bg-white border-l-4 border-l-indigo-500 border-t border-b border-r border-gray-100 p-4 rounded-xl shadow-sm h-full justify-between">
                <Text className="text-[9px] md:text-[10px] font-bold text-secondary/50 uppercase tracking-widest mb-2">Pending EMI / Loan</Text>
                <Text className="text-2xl md:text-3xl font-black text-primary" numberOfLines={1} adjustsFontSizeToFit>₹{pendingEmi}</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      <View className="flex-col lg:flex-row lg:space-x-6 space-y-6 lg:space-y-0 items-start w-full" style={{ gap: 24 }}>
        
          <View className="flex-[1] w-full bg-white rounded-2xl shadow-sm shadow-gray-200/50 border border-gray-100 p-6">

          
          <Text className="text-[10px] font-bold text-secondary/50 uppercase tracking-widest mb-1">Make & Model</Text>
          <Text className="text-2xl font-black text-primary mb-4">{car.make} {car.model}</Text>

          <View className="flex-row justify-between mb-4 pb-4 border-b border-gray-50">
            <View>
              <Text className="text-[10px] font-bold text-secondary/50 uppercase tracking-widest mb-1">License Plate</Text>
              <Text className="text-sm font-bold text-primary">{car.license_plate}</Text>
            </View>
            <View className="items-end">
              <Text className="text-[10px] font-bold text-secondary/50 uppercase tracking-widest mb-1">Year</Text>
              <Text className="text-sm font-bold text-primary">{car.year}</Text>
            </View>
          </View>

          <View className="flex-row justify-between mb-4 pb-4 border-b border-gray-50">
            <View>
              <Text className="text-[10px] font-bold text-secondary/50 uppercase tracking-widest mb-1">Fuel Type & Color</Text>
              <Text className="text-sm font-bold text-primary">{car.color || 'N/A'} • {car.fuel_type || 'N/A'}</Text>
            </View>
            <View className="items-end">
              <Text className="text-[10px] font-bold text-secondary/50 uppercase tracking-widest mb-1">Capacity / KMS</Text>
              <Text className="text-sm font-bold text-primary">
                {car.seat_capacity ? `${car.seat_capacity} Seats` : 'N/A'} • {car.current_kms ? `${car.current_kms.toLocaleString()} km` : 'N/A'}
              </Text>
            </View>
          </View>

          <View className="flex-row justify-between mb-4 pb-4 border-b border-gray-50">
            <View>
              <Text className="text-[10px] font-bold text-secondary/50 uppercase tracking-widest mb-1">RC Owner Name</Text>
              <Text className="text-sm font-bold text-primary">{car.rc_owner_name || 'Not provided'}</Text>
            </View>
            <View className="items-end">
              <Text className="text-[10px] font-bold text-secondary/50 uppercase tracking-widest mb-1">Standard Rate</Text>
              <Text className="text-sm font-black text-emerald-600">₹{car.daily_rate}/day</Text>
            </View>
          </View>

          <View className="flex-row justify-between mb-4 pb-4 border-b border-gray-50">
            <View>
              <Text className="text-[10px] font-bold text-secondary/50 uppercase tracking-widest mb-1">Chassis / Engine</Text>
              <Text className="text-[11px] font-bold text-primary">{car.chassis_no || 'N/A'} / {car.engine_no || 'N/A'}</Text>
            </View>
            <View className="items-end">
              <Text className="text-[10px] font-bold text-secondary/50 uppercase tracking-widest mb-1">Reg Date</Text>
              <Text className="text-[11px] font-bold text-primary">{formatDDMMYYYY(car.registration_date) || 'N/A'}</Text>
            </View>
          </View>

          {car.is_financed && (
            <View className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
              <Text className="text-[10px] font-bold text-blue-800 uppercase tracking-widest mb-2">Finance Details</Text>
              <View className="flex-row justify-between mb-2">
                <Text className="text-xs font-bold text-blue-900">{car.finance_bank}</Text>
                {car.finance_doc_url && (
                  <TouchableOpacity onPress={() => window.open(car.finance_doc_url)}>
                    <Text className="text-xs font-bold text-blue-600 underline">View Doc</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View className="flex-row justify-between">
                <Text className="text-[10px] text-blue-700">Loan: ₹{car.finance_amount}</Text>
                <Text className="text-[10px] text-blue-700">EMI: ₹{car.finance_emi}/mo</Text>
              </View>
            </View>
          )}

          <View className="mb-6">
            <Text className="text-[10px] font-bold text-secondary/50 uppercase tracking-widest mb-2">Compliance Documents & Validity</Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              
              <View className="items-center">
                {car.rc_book_url ? (
                  <TouchableOpacity onPress={() => window.open(car.rc_book_url)} className="bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg"><Text className="text-xs font-bold text-primary">📄 RC Book</Text></TouchableOpacity>
                ) : <View className="bg-red-50 border border-red-100 px-3 py-2 rounded-lg"><Text className="text-xs font-bold text-red-600">📄 Missing RC Book</Text></View>}
                <Text className="text-[9px] font-bold text-secondary/60 mt-1">{car.rc_number || 'No RC Number'}</Text>
              </View>

              <View className="items-center">
                {car.pollution_cert_url ? (
                  <TouchableOpacity onPress={() => window.open(car.pollution_cert_url)} className="bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg"><Text className="text-xs font-bold text-primary">🌿 Pollution</Text></TouchableOpacity>
                ) : <View className="bg-red-50 border border-red-100 px-3 py-2 rounded-lg"><Text className="text-xs font-bold text-red-600">🌿 Missing Pollution</Text></View>}
                <Text className="text-[9px] font-bold text-secondary/60 mt-1">{car.pucc_no ? `PUCC: ${car.pucc_no}` : ''}</Text>
                <Text className="text-[9px] font-bold text-secondary/60">{car.pollution_expiry ? `Valid till ${formatDDMMYYYY(car.pollution_expiry)}` : 'No expiry set'}</Text>
              </View>

              <View className="items-center">
                {car.fitness_tax_url ? (
                  <TouchableOpacity onPress={() => window.open(car.fitness_tax_url)} className="bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg"><Text className="text-xs font-bold text-primary">✅ Fitness/Tax</Text></TouchableOpacity>
                ) : <View className="bg-red-50 border border-red-100 px-3 py-2 rounded-lg"><Text className="text-xs font-bold text-red-600">✅ Missing Fitness/Tax</Text></View>}
                <Text className="text-[9px] font-bold text-secondary/60 mt-1">{car.fitness_tax_expiry ? `Valid till ${formatDDMMYYYY(car.fitness_tax_expiry)}` : 'No expiry set'}</Text>
              </View>

              <View className="items-center">
                {car.insurance_url ? (
                  <TouchableOpacity onPress={() => window.open(car.insurance_url)} className="bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg"><Text className="text-xs font-bold text-primary">🛡️ Insurance</Text></TouchableOpacity>
                ) : <View className="bg-red-50 border border-red-100 px-3 py-2 rounded-lg"><Text className="text-xs font-bold text-red-600">🛡️ Missing Insurance</Text></View>}
                <Text className="text-[9px] font-bold text-secondary/60 mt-1">{car.insurance_company ? car.insurance_company : ''}</Text>
                <Text className="text-[9px] font-bold text-secondary/60">{car.insurance_expiry ? `Valid till ${formatDDMMYYYY(car.insurance_expiry)}` : 'No expiry set'}</Text>
              </View>

              {/* Dynamic Documents */}
              {car.custom_documents && car.custom_documents.map((cDoc: any, i: number) => (
                <View key={i} className="items-center">
                  <TouchableOpacity onPress={() => window.open(cDoc.url)} className="bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg">
                    <Text className="text-xs font-bold text-blue-700">📁 {cDoc.name}</Text>
                  </TouchableOpacity>
                  <Text className="text-[9px] font-bold text-secondary/60 mt-1">{cDoc.expiry ? `Valid till ${formatDDMMYYYY(cDoc.expiry)}` : 'No expiry set'}</Text>
                </View>
              ))}

            </View>
          </View>

          <View className="flex-row justify-between mb-6">
            <View className="items-start">
              <Text className="text-[10px] font-bold text-secondary/50 uppercase tracking-widest mb-1">Current Status</Text>
              <View className={`px-3 py-1 rounded mt-1 ${
                  car.status === 'available' ? 'bg-emerald-50 border border-emerald-100' :
                  car.status === 'rented' ? 'bg-blue-50 border border-blue-100' :
                  'bg-amber-50 border border-amber-100'
                }`}>
                <Text className={`text-xs font-bold uppercase ${
                  car.status === 'available' ? 'text-emerald-700' :
                  car.status === 'rented' ? 'text-blue-700' :
                  'text-amber-700'
                }`}>{car.status}</Text>
              </View>
            </View>
          </View>

        </View>

        {/* Right Column: Availability Calendar */}
        <View className="flex-[1.5] w-full bg-white rounded-2xl shadow-sm shadow-gray-200/50 border border-gray-100 p-6 overflow-hidden">
          <Text className="text-lg font-bold text-primary mb-2">Availability Calendar</Text>
          <Text className="text-xs font-medium text-secondary/60 mb-6">Grey dates indicate the vehicle is already reserved or in maintenance.</Text>
          
          <View className="border border-gray-200 rounded-xl overflow-hidden w-full">
            <Calendar
              style={{ width: '100%' }}
              minDate={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]}
              markingType={'period'}
              markedDates={bookedDates}
              theme={{
                backgroundColor: '#ffffff',
                calendarBackground: '#ffffff',
                textSectionTitleColor: '#b6c1cd',
                todayTextColor: '#00162C',
                dayTextColor: '#2d4150',
                textDisabledColor: '#d9e1e8',
                arrowColor: '#00162C',
                monthTextColor: '#00162C',
                textDayFontWeight: '500',
                textMonthFontWeight: 'bold',
                textDayHeaderFontWeight: '500',
              }}
            />
          </View>
          
          <TouchableOpacity 
            className="w-full bg-primary hover:bg-primary/90 py-4 rounded-xl items-center shadow-lg shadow-primary/30 mt-6 transition-colors"
            onPress={() => router.push(`/(tenant-admin)/new-booking?car_id=${car.id}`)}
          >
            <Text className="text-white font-bold text-base tracking-wide">Initiate Booking</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            className="w-full bg-white border border-gray-200 hover:bg-gray-50 py-4 rounded-xl items-center shadow-sm mt-3 transition-colors"
            onPress={() => router.push(`/edit-car/${car.id}`)}
          >
            <Text className="text-primary font-bold text-base tracking-wide">Edit Vehicle Details</Text>
          </TouchableOpacity>
      {/* Vehicle Photos Section */}
      <View className="mt-8">
        <Text className="text-xl font-bold text-primary mb-4">Vehicle Photographs</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="w-full">
          <View className="flex-row" style={{ paddingBottom: 8 }}>
            {[
              { key: 'front_image_url', label: 'Front' },
              { key: 'back_image_url', label: 'Back' },
              { key: 'left_side_url', label: 'Left Side' },
              { key: 'right_side_url', label: 'Right Side' },
              { key: 'dashboard_url', label: 'Dashboard' },
              { key: 'front_seats_url', label: 'Front Seats' },
              { key: 'back_seats_url', label: 'Back Seats' },
              { key: 'trunk_url', label: 'Trunk' }
            ].map((img, i) => (
              <View key={i} className="mr-3" style={{ width: 140 }}>
                <View className="bg-gray-100 border border-gray-200 rounded-lg overflow-hidden relative" style={{ aspectRatio: 1 }}>
                  {car[img.key] ? (
                    <TouchableOpacity className="w-full h-full" onPress={() => window.open(car[img.key], '_blank')}>
                      <Image source={{ uri: car[img.key] }} className="w-full h-full" resizeMode="cover" />
                    </TouchableOpacity>
                  ) : (
                    <View className="w-full h-full items-center justify-center p-2 opacity-30">
                      <Text className="text-2xl mb-1">📷</Text>
                      <Text className="text-[8px] font-bold text-center">NO IMAGE</Text>
                    </View>
                  )}
                  <View className="absolute bottom-0 left-0 right-0 bg-black/60 py-1.5">
                    <Text className="text-white text-[9px] font-bold text-center uppercase tracking-wider">{img.label}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
        </View>

      </View>

      {/* Maintenance History Section */}
      <View className="mt-8 mb-4 border-t border-gray-200 pt-8">
        <View className="flex-row justify-between items-center mb-6">
          <Text className="text-xl font-bold text-primary">Maintenance & Repairs</Text>
          <TouchableOpacity 
            className="bg-amber-100 border border-amber-200 px-4 py-2 rounded-lg flex-row items-center"
            onPress={() => {
              setEditMaintenanceId(null);
              setMDate(new Date().toISOString().split('T')[0]);
              setMWorkshop(''); setMDesc(''); setMAmount(''); setMImage(null);
              setShowMaintenanceModal(true);
            }}
          >
            <Text className="text-amber-800 font-bold text-xs uppercase tracking-wider">+ Log Maintenance</Text>
          </TouchableOpacity>
        </View>
        
        {maintenanceRecords.length === 0 ? (
          <View className="w-full py-8 items-center bg-gray-50 rounded-2xl border border-gray-100 border-dashed">
            <Text className="text-gray-400">No maintenance records logged.</Text>
          </View>
        ) : (
          <View className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            {maintenanceRecords.map((record: any, i: number) => (
              <View key={record.id} className={`p-5 flex-col md:flex-row justify-between items-start md:items-center ${i !== maintenanceRecords.length - 1 ? 'border-b border-gray-100' : ''}`}>
                <View className="flex-1 mb-3 md:mb-0">
                  <View className="flex-row items-center gap-3 mb-1">
                    <Text className="text-sm font-black text-primary">{record.workshop_name || 'Unknown Workshop'}</Text>
                    <Text className="text-[10px] font-bold text-secondary/50 uppercase bg-gray-100 px-2 py-0.5 rounded-full">{formatDDMMYYYY(record.date)}</Text>
                  </View>
                  <Text className="text-xs text-secondary/80">{record.description || 'No description provided.'}</Text>
                </View>
                <View className="flex-row flex-wrap items-center gap-3 mt-3 md:mt-0 justify-end">
                  <Text className="text-lg font-black text-amber-600 mr-2">₹{record.bill_amount}</Text>
                  
                  <TouchableOpacity 
                    onPress={() => {
                      setEditMaintenanceId(record.id);
                      setMDate(record.date);
                      setMWorkshop(record.workshop_name || '');
                      setMDesc(record.description || '');
                      setMAmount(record.bill_amount.toString());
                      setMImage(record.bill_image_url ? { name: 'Existing Image Attached' } : null);
                      setShowMaintenanceModal(true);
                    }} 
                    className="bg-white px-3 py-1.5 rounded-md border border-gray-200 shadow-sm"
                  >
                    <Text className="text-secondary font-bold text-[10px] uppercase">Edit</Text>
                  </TouchableOpacity>
                  
                  {record.bill_image_url && (
                    <TouchableOpacity onPress={() => window.open(record.bill_image_url, '_blank')} className="bg-gray-100 px-3 py-1.5 rounded-md border border-gray-200 shadow-sm">
                      <Text className="text-primary font-bold text-[10px] uppercase">View Bill</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* EMI PAYMENTS LOG */}
      {car?.is_financed && (
        <View className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-200 mt-8">
          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text className="text-xl font-black text-primary">EMI Payments Log</Text>
              <Text className="text-sm font-bold text-secondary/60 mt-1">Track monthly EMI installments</Text>
            </View>
            <TouchableOpacity 
              className="bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-lg flex-row items-center"
              onPress={() => {
                setEmiDate(new Date().toISOString().split('T')[0]);
                setEmiAmount(car?.finance_emi?.toString() || '');
                setShowEmiModal(true);
              }}
            >
              <Text className="text-indigo-700 font-bold text-xs uppercase tracking-wider">+ Log EMI</Text>
            </TouchableOpacity>
          </View>
          
          {emiRecords.length > 0 ? (
            <View className="space-y-4">
              {emiRecords.map((e, idx) => (
                <View key={idx} className="flex-row justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <View>
                    <Text className="text-sm font-bold text-secondary">{formatDDMMYYYY(e.payment_date)}</Text>
                    <Text className="text-xs text-secondary/60 mt-1 uppercase tracking-wider">EMI Installment</Text>
                  </View>
                  <View className="items-end flex-row gap-4">
                    <Text className="text-lg font-black text-emerald-600">₹{e.amount}</Text>
                    <TouchableOpacity onPress={() => handleDeleteEmi(e.id)} className="p-2 bg-red-50 rounded-lg border border-red-100">
                      <Text className="text-red-500 font-bold text-xs uppercase">Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View className="bg-gray-50 rounded-xl p-8 items-center border border-gray-100 border-dashed">
              <Text className="text-sm font-medium text-gray-400 italic">No EMI payments logged yet.</Text>
            </View>
          )}
        </View>
      )}

      {/* Booking History Section */}
      <View className="mt-8">
        <Text className="text-xl font-bold text-primary mb-4">Booking History</Text>
        <View className="flex-row flex-wrap" style={{ marginHorizontal: -8 }}>
          {carBookings.map((booking: any) => (
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
                    <Text className="text-primary font-bold text-base">{booking.customers?.full_name || 'Unknown Customer'}</Text>
                  </View>

                  <View className="mb-3 bg-gray-50 p-3 rounded-lg border border-gray-100 flex-row justify-between items-center">
                    <Text className="text-[11px] font-bold text-secondary/50 uppercase tracking-widest">Dates</Text>
                    <Text className="text-primary font-bold text-sm">{formatDDMMYYYY(booking.start_date)} <Text className="text-secondary/40 mx-1">→</Text> {formatDDMMYYYY(booking.end_date)}</Text>
                  </View>

                  <View className="mb-6 bg-blue-50/30 p-3 rounded-lg border border-blue-100/50 flex-row justify-between items-center">
                    <Text className="text-[11px] font-bold text-secondary/50 uppercase tracking-widest">Balance</Text>
                    <View className="items-end">
                      <Text className="text-secondary/70 font-bold text-[10px] line-through decoration-red-500/30">₹{booking.total_amount}</Text>
                      {(() => {
                        const paid = (booking.payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
                        const bal = Number(booking.total_amount) - paid;
                        return bal > 0 ? (
                          <Text className="text-red-500 font-black text-sm mt-0.5">₹{bal} Due</Text>
                        ) : (
                          <Text className="text-emerald-600 font-black text-sm mt-0.5">Paid</Text>
                        );
                      })()}
                    </View>
                  </View>
                </View>

                <TouchableOpacity 
                  className="w-full bg-gray-50 hover:bg-gray-100 border border-gray-200 py-3 rounded-xl shadow-sm items-center transition-colors"
                  onPress={() => setSelectedBooking(booking)}
                >
                  <Text className="text-primary font-bold text-xs tracking-wider">VIEW BOOKING DETAILS</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {carBookings.length === 0 && (
            <View className="w-full py-8 items-center ">
              <Text className="text-gray-400">No booking history for this vehicle.</Text>
            </View>
          )}
        </View>
      </View>

</ScrollView>
      {/* Ledger Modal */}
      {selectedBooking && (
        <View className="absolute inset-0 z-50 items-center justify-center bg-black/60 p-4" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <View className="bg-white w-full max-w-2xl rounded-[24px] md:rounded-[32px] shadow-2xl relative flex-col border border-white/20 overflow-hidden" style={{ maxHeight: '95%' }}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
              <View className="p-5 md:p-8">
              
              <View className="flex-row justify-between items-start mb-8 border-b border-gray-100 pb-6">
                <View>
                  <Text className="text-xs font-black text-secondary/40 uppercase tracking-[0.2em] mb-2">Booking Ledger</Text>
                  <Text className="text-3xl font-black text-primary tracking-tight">#{selectedBooking.id.split('-')[0].toUpperCase()}</Text>
                  <Text className="text-base text-secondary/80 font-medium mt-1">{selectedBooking.customers?.full_name}</Text>
                </View>
                <View className="flex-col gap-2 items-end">
                  <TouchableOpacity onPress={() => { setSelectedBooking(null); setPaymentAmount(''); setPaymentError(''); setShowDeleteConfirm(false); }} className="bg-gray-50 hover:bg-gray-100 px-4 py-2 rounded-full border border-gray-200">
                    <Text className="text-gray-500 font-bold text-xs uppercase tracking-wider">Close</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleDeleteBooking} className="bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-full border border-red-200 mt-2">
                    <Text className="text-red-600 font-bold text-[10px] uppercase tracking-wider">Delete Booking</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View className="flex-col md:flex-row gap-6 mb-10">
                {/* Financial Summary */}
                <View className="flex-1 bg-gray-50 rounded-2xl p-6 border border-gray-100">
                  <View className="flex-row justify-between items-center mb-4 pb-4 border-b border-gray-200/50">
                    <Text className="text-sm font-bold text-secondary/60">Total Amount</Text>
                    <Text className="text-base font-black text-primary">₹{selectedBooking.total_amount}</Text>
                  </View>
                  
                  <View className="flex-row justify-between items-center mb-4 pb-4 border-b border-gray-200/50">
                    <Text className="text-sm font-bold text-secondary/60">Advance / Paid</Text>
                    <Text className="text-base font-black text-emerald-600">
                      - ₹{(selectedBooking.payments || []).reduce((sum: number, p: any) => sum + Number(p.amount), 0)}
                    </Text>
                  </View>

                  <View className="flex-row justify-between items-center pt-2">
                    <Text className="text-xs font-black text-secondary/80 uppercase tracking-widest">Remaining Due</Text>
                    <Text className="text-3xl font-black text-red-500 tracking-tight">
                      ₹{Number(selectedBooking.total_amount) - (selectedBooking.payments || []).reduce((sum: number, p: any) => sum + Number(p.amount), 0)}
                    </Text>
                  </View>
                </View>
              </View>

              <View className="mb-10">
                <Text className="text-xs font-bold text-secondary/60 uppercase tracking-[0.1em] mb-4">Record New Payment</Text>
                
                {paymentError ? (
                  <View className="bg-red-50 border border-red-200 p-3 rounded-lg mb-4">
                    <Text className="text-red-600 font-bold text-xs">{paymentError}</Text>
                  </View>
                ) : null}

                <View className="flex-col sm:flex-row gap-4">
                  <View className="flex-1">
                    <TextInput 
                      className="bg-gray-50 border border-gray-200 rounded-xl px-6 py-4 text-primary font-bold text-lg"
                      placeholder="Enter amount (₹)"
                      keyboardType="numeric"
                      value={paymentAmount}
                      onChangeText={setPaymentAmount}
                    />
                  </View>
                  <TouchableOpacity 
                    className="bg-emerald-600 px-8 py-4 rounded-xl justify-center items-center shadow-lg shadow-emerald-200 hover:bg-emerald-700"
                    onPress={handleRecordPayment}
                    disabled={isProcessingPayment}
                  >
                    {isProcessingPayment ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text className="text-white font-bold text-sm tracking-wide">CONFIRM PAYMENT</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              <View className="mt-8 border-t border-gray-100 pt-8">
                <Text className="text-xs font-bold text-secondary/40 uppercase tracking-[0.2em] mb-4 border-b border-gray-100 pb-2">Payment History Log</Text>
                {selectedBooking.payments && selectedBooking.payments.length > 0 ? (
                  <View className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    {selectedBooking.payments.map((p: any, i: number) => (
                      <View key={i} className={`flex-row justify-between items-center p-4 ${i !== selectedBooking.payments.length - 1 ? 'border-b border-gray-50' : ''}`}>
                        <View className="flex-row items-center gap-3">
                          <View className="w-2 h-2 rounded-full bg-emerald-400" />
                          <Text className="text-sm font-bold text-secondary/80">{formatDDMMYYYY(p.created_at)}</Text>
                        </View>
                        <View className="bg-emerald-50 px-3 py-1 rounded-md border border-emerald-100">
                          <Text className="text-sm font-black text-emerald-700">+ ₹{p.amount}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View className="bg-gray-50 rounded-xl p-8 items-center border border-gray-100">
                    <Text className="text-sm font-medium text-gray-400 italic">No payments have been recorded yet.</Text>
                  </View>
                )}
              </View>
            </View>
            </ScrollView>
          </View>
        </View>
      )}


      {/* EMI Form Modal */}
      {showEmiModal && (
        <View className="absolute inset-0 z-50 items-center justify-center bg-black/60 p-4" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <View className="bg-white w-full max-w-md rounded-[24px] md:rounded-[32px] p-6 md:p-8 shadow-2xl relative">
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text className="text-xl font-black text-primary">Log EMI Payment</Text>
                <Text className="text-sm text-secondary/60 mt-1">Record a new installment</Text>
              </View>
              <TouchableOpacity onPress={() => { setShowEmiModal(false); setEmiAmount(''); setEmiDate(''); }} className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center">
                <Text className="text-gray-500 font-bold">✕</Text>
              </TouchableOpacity>
            </View>

            <View className="space-y-4 mb-8">
              <View>
                <Text className="text-xs font-bold text-secondary/60 uppercase tracking-wider mb-2">Payment Date</Text>
                <TextInput
                  className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-secondary font-semibold"
                  placeholder="YYYY-MM-DD"
                  value={emiDate}
                  onChangeText={setEmiDate}
                />
              </View>
              
              <View>
                <Text className="text-xs font-bold text-secondary/60 uppercase tracking-wider mb-2">EMI Amount (₹)</Text>
                <TextInput
                  className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-secondary font-semibold"
                  placeholder="e.g. 25000"
                  keyboardType="numeric"
                  value={emiAmount}
                  onChangeText={setEmiAmount}
                />
              </View>
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity 
                className="flex-1 bg-gray-100 py-4 rounded-xl items-center border border-gray-200"
                onPress={() => { setShowEmiModal(false); setEmiAmount(''); setEmiDate(''); }}
              >
                <Text className="text-secondary font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className="flex-1 bg-primary py-4 rounded-xl items-center shadow-lg"
                onPress={handleSubmitEmi}
                disabled={emiUploading}
              >
                {emiUploading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-white font-bold">Save EMI</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Maintenance Form Modal */}
      {showMaintenanceModal && (
        <View className="absolute inset-0 z-50 items-center justify-center bg-black/60 p-4" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <View className="bg-white w-full max-w-xl rounded-[32px] p-5 md:p-8 shadow-2xl relative max-h-[90%] border border-white/20">
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              
              <View className="flex-row justify-between items-start mb-6 border-b border-gray-100 pb-4">
                <View>
                  <Text className="text-xs font-black text-secondary/40 uppercase tracking-[0.2em] mb-1">Vehicle Service</Text>
                  <Text className="text-2xl font-black text-primary tracking-tight">Log Maintenance</Text>
                </View>
                <TouchableOpacity onPress={() => setShowMaintenanceModal(false)} className="bg-gray-50 hover:bg-gray-100 px-4 py-2 rounded-full border border-gray-200">
                  <Text className="text-gray-500 font-bold text-xs uppercase tracking-wider">Close</Text>
                </TouchableOpacity>
              </View>

              <View className="space-y-4">
                <View>
                  <Text className="text-xs font-bold text-secondary mb-1">Date *</Text>
                  <WebDatePicker value={mDate} onChange={setMDate} />
                </View>
                <View>
                  <Text className="text-xs font-bold text-secondary mb-1">Workshop / Service Center</Text>
                  <TextInput 
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary font-bold"
                    placeholder="e.g., Toyota Official Service"
                    value={mWorkshop}
                    onChangeText={setMWorkshop}
                  />
                </View>
                <View>
                  <Text className="text-xs font-bold text-secondary mb-1">Problem Description</Text>
                  <TextInput 
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary font-bold"
                    placeholder="e.g., Oil change and brake pad replacement"
                    multiline
                    numberOfLines={3}
                    style={{ minHeight: 80 }}
                    value={mDesc}
                    onChangeText={setMDesc}
                  />
                </View>
                <View>
                  <Text className="text-xs font-bold text-secondary mb-1">Bill Amount (₹) *</Text>
                  <TextInput 
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary font-bold text-lg"
                    placeholder="0.00"
                    keyboardType="numeric"
                    value={mAmount}
                    onChangeText={setMAmount}
                  />
                </View>
                <View>
                  <Text className="text-xs font-bold text-secondary mb-1">Upload Bill Image</Text>
                  <TouchableOpacity 
                    className="border-2 border-dashed border-gray-300 rounded-xl p-6 items-center justify-center bg-gray-50"
                    onPress={handlePickMaintenanceBill}
                  >
                    {mImage ? (
                      <Text className="text-emerald-600 font-bold">{mImage.name || 'Image Selected ✅'}</Text>
                    ) : (
                      <Text className="text-secondary/60 font-medium text-sm">Tap to select bill photo</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              <View className="flex-col gap-3 mt-8">
                <TouchableOpacity 
                  className="w-full bg-amber-500 py-4 rounded-xl items-center shadow-lg shadow-amber-500/30 transition-colors"
                  onPress={handleSubmitMaintenance}
                  disabled={mUploading}
                >
                  {mUploading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text className="text-white font-bold text-sm tracking-widest uppercase">Save Maintenance Record</Text>
                  )}
                </TouchableOpacity>

                {editMaintenanceId && (
                  <TouchableOpacity 
                    className="w-full bg-red-50 border border-red-200 py-4 rounded-xl items-center shadow-sm transition-colors"
                    onPress={() => handleDeleteMaintenance(editMaintenanceId)}
                    disabled={mUploading}
                  >
                    <Text className="text-red-600 font-bold text-sm tracking-widest uppercase">Delete Record</Text>
                  </TouchableOpacity>
                )}
              </View>

            </ScrollView>
          </View>
        </View>
      )}

    </View>
  );
}
