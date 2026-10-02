import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

export default function VendorProfileScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState({ totalTrips: 0, totalRevenue: 0, totalCost: 0, netProfit: 0, totalPaid: 0, totalPayable: 0 });

  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [selectedBookingForPayment, setSelectedBookingForPayment] = useState<any>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  useEffect(() => {
    fetchVendorData();
  }, [id]);

  const fetchVendorData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user?.id).single();

      if (profile?.tenant_id) {
        // Fetch Vendor Profile
        const { data: vData } = await supabase.from('vendors').select('*').eq('id', id).single();
        setVendor(vData);

        // Fetch Vendor Bookings
        const { data: vendorBookings, error } = await supabase
          .from('bookings')
          .select('*, customers(full_name, phone)')
          .eq('vendor_id', id)
          .order('start_date', { ascending: false });

        if (error) throw error;
        
        const b = vendorBookings || [];
        setBookings(b);
        
        const totalTrips = b.length;
        const totalRevenue = b.reduce((sum, item) => sum + Number(item.total_amount || 0), 0);
        const totalCost = b.reduce((sum, item) => sum + Number(item.vendor_cost || 0), 0);
        const totalPaid = b.reduce((sum, item) => sum + Number(item.vendor_paid_amount || 0), 0);
        const totalPayable = totalCost - totalPaid;
        const netProfit = totalRevenue - totalCost;
        
        setAnalytics({ totalTrips, totalRevenue, totalCost, totalPaid, totalPayable, netProfit });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };


  const logVendorPayment = async () => {
    if (!selectedBookingForPayment) return;
    if (!paymentAmount || isNaN(Number(paymentAmount)) || Number(paymentAmount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    
    setIsSubmittingPayment(true);
    try {
      const currentPaid = Number(selectedBookingForPayment.vendor_paid_amount || 0);
      const payment = Number(paymentAmount);
      const newTotalPaid = currentPaid + payment;
      const vendorCost = Number(selectedBookingForPayment.vendor_cost || 0);
      
      const newStatus = newTotalPaid >= vendorCost ? 'paid' : 'unpaid';

      const { error } = await supabase
        .from('bookings')
        .update({ 
          vendor_paid_amount: newTotalPaid,
          vendor_payment_status: newStatus 
        })
        .eq('id', selectedBookingForPayment.id);
        
      if (error) throw error;
      
      setPaymentModalVisible(false);
      setPaymentAmount('');
      setSelectedBookingForPayment(null);
      fetchVendorData(); // refresh the view
    } catch (err: any) {
      console.error(err);
      alert("Error logging payment: " + err.message);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`;
  };

  if (loading || !vendor) {
    return (
      <View className="flex-1 items-center justify-center bg-[#FAFAFA]">
        <ActivityIndicator size="large" color="#00162C" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-[#FAFAFA]">
      
      {/* Header */}
      <View className="bg-white border-b border-gray-200 pt-12 pb-6 px-6 shadow-sm">
        <TouchableOpacity onPress={() => router.back()} className="mb-4">
          <Text className="text-primary font-bold">← Back to Vendors</Text>
        </TouchableOpacity>
        
        <View className="flex-row items-center justify-between mb-6">
          <View className="flex-row items-center flex-1 pr-4">
            <View className="w-16 h-16 bg-purple-100 rounded-full items-center justify-center mr-4 border border-purple-200">
              <Text className="text-purple-700 font-black text-2xl">{vendor.company_name.charAt(0).toUpperCase()}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-3xl font-black text-primary">{vendor.company_name}</Text>
              <Text className="text-sm font-medium text-secondary/60">Supplier / Broker</Text>
            </View>
          </View>
          
          <View className="items-end pl-4 border-l border-gray-100">
             <Text className="text-[10px] font-bold text-secondary/40 uppercase mb-1">Contact Details</Text>
             <Text className="text-sm font-bold text-primary mb-1">{vendor.phone || 'N/A'}</Text>
             <Text className="text-xs text-secondary/60 w-32 text-right">{vendor.address || 'No address provided'}</Text>
          </View>
        </View>

        {/* Analytics Blocks */}
        <View className="flex-row flex-wrap gap-2">
          <View className="flex-1 min-w-[45%] bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <Text className="text-[10px] font-bold text-secondary/50 uppercase mb-1">Total Trips</Text>
            <Text className="text-xl font-black text-primary">{analytics.totalTrips}</Text>
          </View>
          <View className="flex-1 min-w-[45%] bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <Text className="text-[10px] font-bold text-secondary/50 uppercase mb-1">Total Revenue</Text>
            <Text className="text-xl font-black text-emerald-600">₹{analytics.totalRevenue}</Text>
          </View>
          <View className="flex-1 min-w-[45%] bg-red-50 p-4 rounded-2xl border border-red-200 shadow-sm">
            <Text className="text-[10px] font-bold text-red-700 uppercase mb-1">Outstanding Payable</Text>
            <Text className="text-xl font-black text-red-600">₹{analytics.totalPayable}</Text>
          </View>
          <View className="flex-1 min-w-[45%] bg-emerald-50 p-4 rounded-2xl border border-emerald-200 shadow-sm">
            <Text className="text-[10px] font-bold text-emerald-700 uppercase mb-1">Actually Paid</Text>
            <Text className="text-xl font-black text-emerald-600">₹{analytics.totalPaid}</Text>
          </View>
        </View>
      </View>

      {/* Bookings List */}
      <View className="p-6">
        <Text className="text-lg font-black text-primary mb-4">Brokered Trips History</Text>
        
        {bookings.length === 0 ? (
          <View className="bg-white p-8 rounded-2xl border border-gray-200 items-center justify-center border-dashed">
            <Text className="text-gray-400 font-medium">No trips found for this vendor.</Text>
          </View>
        ) : (
          <View className="space-y-4">
            {bookings.map(b => (
              <View key={b.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <View className="flex-row justify-between items-start mb-3">
                  <View>
                    <Text className="text-sm font-black text-primary mb-1">{b.requested_model}</Text>
                    <Text className="text-xs font-bold text-secondary/70">{b.customers?.full_name} • {b.customers?.phone}</Text>
                  </View>
                  <View className={`px-2 py-1 rounded ${
                    b.status === 'active' ? 'bg-blue-100' :
                    b.status === 'completed' ? 'bg-gray-200' :
                    'bg-emerald-100'
                  }`}>
                    <Text className={`text-[10px] font-bold uppercase ${
                      b.status === 'active' ? 'text-blue-700' :
                      b.status === 'completed' ? 'text-gray-600' :
                      'text-emerald-700'
                    }`}>{b.status}</Text>
                  </View>
                </View>

                <View className="flex-row items-center justify-between bg-gray-50 p-2 rounded-lg mb-4">
                  <Text className="text-xs font-bold text-primary">{formatDate(b.start_date)}</Text>
                  <Text className="text-xs text-secondary/50">→</Text>
                  <Text className="text-xs font-bold text-primary">{formatDate(b.end_date)}</Text>
                </View>
                
                <View className="flex-col gap-3 border-t border-gray-100 pt-3">
                  <View className="flex-row justify-between items-center mb-2">
                    <View>
                      <Text className="text-[10px] font-bold text-secondary/50 uppercase mb-1">Vendor Cost</Text>
                      <Text className="text-sm font-black text-primary">₹{b.vendor_cost}</Text>
                    </View>
                    <View className="items-center">
                      <Text className="text-[10px] font-bold text-secondary/50 uppercase mb-1">Paid So Far</Text>
                      <Text className="text-sm font-black text-emerald-600">₹{b.vendor_paid_amount || 0}</Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-[10px] font-bold text-secondary/50 uppercase mb-1">Balance</Text>
                      <Text className="text-sm font-black text-red-500">₹{(Number(b.vendor_cost || 0) - Number(b.vendor_paid_amount || 0))}</Text>
                    </View>
                  </View>
                  
                  <View className="flex-row gap-2 mt-2">
                    {b.vendor_payment_status === 'paid' ? (
                       <View className="flex-1 bg-emerald-50 py-3 rounded-lg items-center border border-emerald-100">
                         <Text className="text-emerald-700 font-black text-[10px] uppercase tracking-widest">FULLY PAID</Text>
                       </View>
                    ) : (
                      <TouchableOpacity 
                        className="flex-1 bg-primary py-3 rounded-lg items-center shadow-sm"
                        onPress={() => { setSelectedBookingForPayment(b); setPaymentModalVisible(true); }}
                      >
                        <Text className="text-white font-bold text-[10px] uppercase tracking-widest">Log Payment</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Vendor Payment Modal */}
      {paymentModalVisible && selectedBookingForPayment && (
        <Modal visible={true} transparent={true} animationType="fade">
          <View className="flex-1 items-center justify-center bg-black/60 p-4">
            <View className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl relative">
              <View className="flex-row justify-between items-center mb-6 border-b border-gray-100 pb-4">
                <View>
                  <Text className="text-xl font-black text-primary">Log Vendor Payout</Text>
                  <Text className="text-xs text-secondary/60 mt-1">Record amount paid for this trip</Text>
                </View>
                <TouchableOpacity onPress={() => { setPaymentModalVisible(false); setSelectedBookingForPayment(null); }} className="p-2 bg-gray-50 rounded-full">
                  <Text className="text-gray-500 font-bold">✕</Text>
                </TouchableOpacity>
              </View>

              <View className="mb-6">
                <Text className="text-xs font-bold text-secondary mb-2">AMOUNT TO LOG (₹)</Text>
                <TextInput 
                  className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-4 text-emerald-900 font-black text-lg"
                  keyboardType="numeric"
                  placeholder="0.00"
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                />
                <Text className="text-[10px] text-gray-500 font-bold mt-2">
                  Max Payable: ₹{(Number(selectedBookingForPayment.vendor_cost || 0) - Number(selectedBookingForPayment.vendor_paid_amount || 0))}
                </Text>
              </View>

              <TouchableOpacity 
                className={`w-full py-4 rounded-xl items-center shadow-lg transition-colors ${isSubmittingPayment ? 'bg-purple-400' : 'bg-purple-600'}`}
                onPress={logVendorPayment}
                disabled={isSubmittingPayment}
              >
                {isSubmittingPayment ? <ActivityIndicator color="#fff" size="small" /> : <Text className="text-white font-bold text-sm tracking-widest uppercase">Save Payment</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

    </ScrollView>
  );
}
