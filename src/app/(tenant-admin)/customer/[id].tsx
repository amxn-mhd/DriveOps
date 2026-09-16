import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Alert, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';

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
export default function CustomerProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState({ totalBookings: 0, totalBilled: 0, totalPaid: 0, totalDue: 0 });

  // Ledger States
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    fetchCustomerDetails();
  }, [id]);

  const fetchCustomerDetails = async () => {
    try {
      const { data: custData, error: custError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();
        
      if (custError) throw custError;
      setCustomer(custData);

      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*, cars(*), payments(*)')
        .eq('customer_id', id)
        .order('created_at', { ascending: false });

      if (bookingsError) throw bookingsError;
      setBookings(bookingsData || []);

      const totalBookings = bookingsData?.length || 0;
      const totalBilled = (bookingsData || []).reduce((sum, b) => sum + Number(b.total_amount), 0);
      const totalPaid = (bookingsData || []).reduce((sum, b) => {
        return sum + (b.payments || []).reduce((pSum: number, p: any) => pSum + Number(p.amount), 0);
      }, 0);
      const totalDue = totalBilled - totalPaid;

      setAnalytics({ totalBookings, totalBilled, totalPaid, totalDue });

    } catch (e) {
      console.error(e);
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
      const newPayment = { amount: parseFloat(paymentAmount), created_at: new Date().toISOString() };
      setSelectedBooking({
        ...selectedBooking,
        payments: [...(selectedBooking.payments || []), newPayment]
      });
      fetchCustomerDetails();
    } catch (err: any) {
      setPaymentError(err.message || 'Failed to record payment.');
    } finally {
      setIsProcessingPayment(false);
      setTimeout(() => { globalPaymentLock = false; }, 1000);
    }
  };

  const executeDeleteBooking = async () => {
    if (!selectedBooking) return;
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', selectedBooking.id);
      if (error) throw error;
      setSelectedBooking(null);
      fetchCustomerDetails();
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

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#00162C" />
      </View>
    );
  }

  if (!customer) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 p-6">
        <Text className="text-xl font-bold text-red-500 mb-4">Customer not found</Text>
        <TouchableOpacity onPress={() => router.back()} className="bg-primary px-6 py-3 rounded-xl">
          <Text className="text-white font-bold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 relative">
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 24, paddingBottom: 120 }}>
      {/* Header */}
      <View className="flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <View className="flex-row items-center gap-4">
          <View className="w-16 h-16 bg-blue-100 rounded-full items-center justify-center border-2 border-blue-200 shadow-sm">
            <Text className="text-blue-700 font-black text-2xl">
              {(customer.full_name || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text className="text-3xl font-black text-primary tracking-tight">{customer.full_name}</Text>
            <Text className="text-sm font-bold text-secondary/60 mt-1">{customer.phone} • {customer.id_type || 'ID Not Provided'}</Text>
          </View>
        </View>
        <View className="w-full md:w-auto flex-row gap-2">
          <TouchableOpacity 
            className="bg-white border border-gray-200 px-6 py-3 rounded-xl shadow-sm"
            onPress={() => router.canGoBack() ? router.back() : router.replace("/(tenant-admin)/customers")}
          >
            <Text className="text-secondary font-bold text-sm">Back to Customers</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Analytics */}
      <View className="flex-row flex-wrap mb-8" style={{ marginHorizontal: -4 }}>
        <View className="w-1/2 md:w-1/4 p-1">
          <View className="bg-white border-l-4 border-l-blue-500 border border-gray-100 p-4 rounded-xl shadow-sm h-full justify-between">
            <Text className="text-[9px] md:text-[10px] font-bold text-secondary/50 uppercase tracking-widest mb-2">Total Bookings</Text>
            <Text className="text-2xl md:text-3xl font-black text-primary" numberOfLines={1} adjustsFontSizeToFit>{analytics.totalBookings}</Text>
          </View>
        </View>
        <View className="w-1/2 md:w-1/4 p-1">
          <View className="bg-white border-l-4 border-l-purple-500 border border-gray-100 p-4 rounded-xl shadow-sm h-full justify-between">
            <Text className="text-[9px] md:text-[10px] font-bold text-secondary/50 uppercase tracking-widest mb-2">Total Billed</Text>
            <Text className="text-2xl md:text-3xl font-black text-primary" numberOfLines={1} adjustsFontSizeToFit>₹{analytics.totalBilled}</Text>
          </View>
        </View>
        <View className="w-1/2 md:w-1/4 p-1">
          <View className="bg-white border-l-4 border-l-emerald-500 border border-gray-100 p-4 rounded-xl shadow-sm h-full justify-between">
            <Text className="text-[9px] md:text-[10px] font-bold text-secondary/50 uppercase tracking-widest mb-2">Total Paid</Text>
            <Text className="text-2xl md:text-3xl font-black text-primary" numberOfLines={1} adjustsFontSizeToFit>₹{analytics.totalPaid}</Text>
          </View>
        </View>
        <View className="w-1/2 md:w-1/4 p-1">
          <View className="bg-white border-l-4 border-l-red-500 border border-gray-100 p-4 rounded-xl shadow-sm h-full justify-between">
            <Text className="text-[9px] md:text-[10px] font-bold text-secondary/50 uppercase tracking-widest mb-2">Total Due</Text>
            <Text className="text-2xl md:text-3xl font-black text-primary" numberOfLines={1} adjustsFontSizeToFit>₹{analytics.totalDue}</Text>
          </View>
        </View>
      </View>

      {/* Booking History */}
      <View className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm mb-8">
        <Text className="text-xl font-bold text-primary mb-6">Booking History</Text>
        
        {bookings.length === 0 ? (
          <View className="py-12 items-center justify-center bg-gray-50 rounded-2xl border border-gray-200 border-dashed">
            <Text className="text-secondary/50 font-bold mb-2">No bookings found for this customer.</Text>
          </View>
        ) : (
          <View className="flex-row flex-wrap" style={{ marginHorizontal: -8 }}>
            {bookings.map((booking: any) => {
              const bPaid = (booking.payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
              const bDue = Number(booking.total_amount) - bPaid;
              
              return (
                <View key={booking.id} className="w-full md:w-1/2 lg:w-1/3 xl:w-1/4 p-2">
                  <View className="bg-gray-50 border border-gray-200 rounded-2xl p-5 h-full flex-col justify-between shadow-sm">
                    <View>
                      <View className="flex-row justify-between items-start mb-4 pb-3 border-b border-gray-200">
                        <View>
                          <Text className="text-[10px] font-black text-secondary/40 uppercase tracking-widest mb-1">Booking ID</Text>
                          <Text className="text-primary font-black text-sm">#{booking.id.split('-')[0].toUpperCase()}</Text>
                        </View>
                        <View className={`px-2 py-1 rounded-md border ${
                          booking.status === 'active' ? 'bg-emerald-50 border-emerald-100' :
                          booking.status === 'completed' ? 'bg-blue-50 border-blue-100' :
                          booking.status === 'pending' ? 'bg-amber-50 border-amber-100' :
                          'bg-gray-100 border-gray-200'
                        }`}>
                          <Text className={`text-[9px] font-black uppercase tracking-wider ${
                            booking.status === 'active' ? 'text-emerald-700' :
                            booking.status === 'completed' ? 'text-blue-700' :
                            booking.status === 'pending' ? 'text-amber-700' :
                            'text-gray-600'
                          }`}>{booking.status}</Text>
                        </View>
                      </View>
                      
                      <View className="mb-5">
                        <Text className="text-[11px] font-bold text-secondary/50 uppercase tracking-widest mb-1">Vehicle</Text>
                        <Text className="text-primary font-bold text-base">{booking.cars?.make} {booking.cars?.model}</Text>
                        <Text className="text-secondary/60 text-xs font-medium mt-0.5">{booking.cars?.license_plate}</Text>
                      </View>

                      <View className="mb-3 bg-gray-50 p-3 rounded-lg border border-gray-100 flex-row justify-between items-center">
                        <Text className="text-[11px] font-bold text-secondary/50 uppercase tracking-widest">Dates</Text>
                        <Text className="text-primary font-bold text-sm">{formatDDMMYYYY(booking.start_date)} <Text className="text-secondary/40 mx-1">→</Text> {formatDDMMYYYY(booking.end_date)}</Text>
                      </View>

                      <View className="mb-6 bg-blue-50/30 p-3 rounded-lg border border-blue-100/50 flex-row justify-between items-center">
                        <Text className="text-[11px] font-bold text-secondary/50 uppercase tracking-widest">Balance</Text>
                        <View className="items-end">
                          <Text className="text-secondary/70 font-bold text-[10px] line-through decoration-red-500/30">₹{booking.total_amount}</Text>
                          {bDue > 0 ? (
                            <Text className="text-red-500 font-black text-sm mt-0.5">₹{bDue} Due</Text>
                          ) : (
                            <Text className="text-emerald-600 font-black text-sm mt-0.5">Paid</Text>
                          )}
                        </View>
                      </View>
                    </View>

                    <TouchableOpacity 
                      className="w-full bg-white hover:bg-gray-50 border border-gray-200 py-3 rounded-xl shadow-sm items-center transition-colors mt-2"
                      onPress={() => setSelectedBooking(booking)}
                    >
                      <Text className="text-primary font-bold text-xs tracking-wider">VIEW BOOKING DETAILS</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      </ScrollView>

      {/* Booking Ledger Modal */}
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
    </View>
  );
}
