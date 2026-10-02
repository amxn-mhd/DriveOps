import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform, Modal, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

export default function BookingDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<any>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  
  // Customer Payment States
  const [customerPayments, setCustomerPayments] = useState<any[]>([]);
  const [customerPaymentAmount, setCustomerPaymentAmount] = useState('');
  const [isProcessingCustomerPayment, setIsProcessingCustomerPayment] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState('');
  
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  const [dispatchModalVisible, setDispatchModalVisible] = useState(false);
  const [dispatchMode, setDispatchMode] = useState('fleet');
  const [selectedCarId, setSelectedCarId] = useState('');
  const [vendorCost, setVendorCost] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [isCreatingVendor, setIsCreatingVendor] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorPhone, setNewVendorPhone] = useState('');
  const [newVendorAddress, setNewVendorAddress] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');
  const [isDispatching, setIsDispatching] = useState(false);
  
  const [cars, setCars] = useState<any[]>([]);
  const [vendorsList, setVendorsList] = useState<any[]>([]);

  useEffect(() => {
    fetchBookingData();
  }, [id]);

  const fetchBookingData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, customers(*), vendors(*), cars!bookings_car_id_fkey(*)')
        .eq('id', id)
        .single();
        
      if (error) throw error;
      setBooking(data);
      
      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('booking_id', id)
        .order('created_at', { ascending: false });
      setCustomerPayments(payments || []);
      
      if (data) {
        const { data: cData } = await supabase.from('cars').select('*').eq('tenant_id', data.tenant_id);
        setCars(cData || []);
        const { data: vData } = await supabase.from('vendors').select('*').eq('tenant_id', data.tenant_id).order('company_name');
        setVendorsList(vData || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };


  const handleConfirmBooking = async () => {
    setIsConfirming(true);
    try {
      const payload: any = { status: 'confirmed' };
      const { error: updateError } = await supabase.from('bookings').update(payload).eq('id', booking.id);
      if (updateError) throw updateError;

      if (advanceAmount && parseFloat(advanceAmount) > 0) {
        const { error: payError } = await supabase.from('payments').insert([{
          tenant_id: booking.tenant_id,
          booking_id: booking.id,
          amount: parseFloat(advanceAmount),
          method: 'cash'
        }]);
        if (payError) throw payError;
      }
      setAdvanceAmount('');
      fetchBookingData();
    } catch (e: any) {
      if (Platform.OS === 'web') window.alert("Error: " + e.message);
      else Alert.alert("Error", e.message);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleRejectBooking = async () => {
    if (!rejectReason.trim()) return;
    setIsRejecting(true);
    try {
      const existingComments = booking.comments || '';
      const newComments = existingComments ? `${existingComments}\n\n[Rejected Reason]: ${rejectReason.trim()}` : `[Rejected Reason]: ${rejectReason.trim()}`;
      
      const { error } = await supabase.from('bookings').update({ status: 'cancelled', comments: newComments }).eq('id', booking.id);
      if (error) throw error;
      
      setRejectModalVisible(false);
      setRejectReason('');
      fetchBookingData();
    } catch (e: any) {
      if (Platform.OS === 'web') window.alert("Error: " + e.message);
      else Alert.alert("Error", e.message);
    } finally {
      setIsRejecting(false);
    }
  };

  const handleDispatchSubmit = async () => {
    setIsDispatching(true);
    try {
      const payload: any = { status: 'confirmed' }; 
      
      if (dispatchMode === 'fleet') {
        if (!selectedCarId) throw new Error("Please select a vehicle.");
        payload.car_id = selectedCarId;
        payload.is_brokered = false;
        payload.vendor_id = null;
        payload.vendor_cost = 0;
      } else {
        let finalVendorId = selectedVendorId;
        if (isCreatingVendor) {
          if (!newVendorName.trim()) throw new Error("Vendor Company Name is required.");
          const { data: newVendor, error: vendorError } = await supabase.from('vendors').insert([{
            tenant_id: booking.tenant_id,
            company_name: newVendorName.trim(),
            phone: newVendorPhone.trim() || null,
            address: newVendorAddress.trim() || null
          }]).select().single();
          if (vendorError) throw vendorError;
          finalVendorId = newVendor.id;
        } else {
          if (!finalVendorId) throw new Error("Please select a vendor.");
        }
        
        if (!vendorCost || isNaN(parseFloat(vendorCost))) throw new Error("Please enter a valid vendor cost.");
        
        payload.car_id = null;
        payload.is_brokered = true;
        payload.vendor_id = finalVendorId;
        payload.vendor_cost = parseFloat(vendorCost);
      }

      const { error } = await supabase.from('bookings').update(payload).eq('id', booking.id);
      if (error) throw error;
      
      setDispatchModalVisible(false);
      fetchBookingData();
    } catch (e: any) {
      if (Platform.OS === 'web') window.alert("Error: " + e.message);
      else Alert.alert("Error", e.message);
    } finally {
      setIsDispatching(false);
    }
  };

  const handleRecordCustomerPayment = async () => {
    if (!customerPaymentAmount || isNaN(Number(customerPaymentAmount)) || Number(customerPaymentAmount) <= 0) {
      if (Platform.OS === 'web') window.alert("Please enter a valid amount");
      else Alert.alert("Error", "Please enter a valid amount");
      return;
    }
    
    setIsProcessingCustomerPayment(true);
    try {
      const { error } = await supabase.from('payments').insert([{
        tenant_id: booking.tenant_id,
        booking_id: booking.id,
        amount: Number(customerPaymentAmount),
        method: 'cash'
      }]);
      
      if (error) throw error;
      
      setCustomerPaymentAmount('');
      fetchBookingData(); // Refresh everything
    } catch (err: any) {
      if (Platform.OS === 'web') window.alert("Error: " + err.message);
      else Alert.alert("Error", err.message);
    } finally {
      setIsProcessingCustomerPayment(false);
    }
  };

  const logVendorPayment = async () => {
    if (!paymentAmount || isNaN(Number(paymentAmount)) || Number(paymentAmount) <= 0) {
      if (Platform.OS === 'web') window.alert("Please enter a valid amount");
      else Alert.alert("Error", "Please enter a valid amount");
      return;
    }
    
    setIsSubmittingPayment(true);
    try {
      const currentPaid = Number(booking.vendor_paid_amount || 0);
      const payment = Number(paymentAmount);
      const newTotalPaid = currentPaid + payment;
      const vendorCost = Number(booking.vendor_cost || 0);
      
      const newStatus = newTotalPaid >= vendorCost ? 'paid' : 'unpaid';

      const { error } = await supabase
        .from('bookings')
        .update({ 
          vendor_paid_amount: newTotalPaid,
          vendor_payment_status: newStatus 
        })
        .eq('id', id);
        
      if (error) throw error;
      
      setBooking({ 
        ...booking, 
        vendor_paid_amount: newTotalPaid, 
        vendor_payment_status: newStatus 
      });
      setPaymentModalVisible(false);
      setPaymentAmount('');
    } catch (err: any) {
      if (Platform.OS === 'web') window.alert("Error: " + err.message);
      else Alert.alert("Error", err.message);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`;
  };

  if (loading || !booking) {
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
          <Text className="text-primary font-bold">← Back</Text>
        </TouchableOpacity>
        
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-[10px] font-black text-secondary/40 uppercase tracking-widest mb-1">Reservation ID: {booking.id.split('-')[0]}</Text>
            <Text className="text-3xl font-black text-primary mb-2">{booking.customers?.full_name}</Text>
          </View>
          <View className={`px-4 py-2 rounded-lg ${
            booking.status === 'active' ? 'bg-blue-100' :
            booking.status === 'completed' ? 'bg-gray-200' :
            booking.status === 'confirmed' ? 'bg-emerald-100' : 'bg-amber-100'
          }`}>
            <Text className={`font-black uppercase tracking-widest ${
              booking.status === 'active' ? 'text-blue-700' :
              booking.status === 'completed' ? 'text-gray-600' :
              booking.status === 'confirmed' ? 'text-emerald-700' : 'text-amber-700'
            }`}>{booking.status}</Text>
          </View>
        </View>
      </View>

      <View className="p-6 space-y-6">

        {/* Comments & Notes */}
        {booking.comments ? (
          <View className={`p-5 rounded-2xl border shadow-sm ${booking.status === 'cancelled' ? 'bg-red-50 border-red-200' : 'bg-amber-50/50 border-amber-200'}`}>
            <Text className={`text-[10px] font-black uppercase tracking-widest mb-2 ${booking.status === 'cancelled' ? 'text-red-700/60' : 'text-amber-700/60'}`}>Notes & Comments</Text>
            <Text className={`text-sm font-medium leading-relaxed ${booking.status === 'cancelled' ? 'text-red-900' : 'text-amber-900'}`}>{booking.comments}</Text>
          </View>
        ) : null}

        

        {/* Action Buttons for Enquiry / Unassigned */}
        {booking.status === 'enquiry' && (
          <View className="bg-white p-6 rounded-2xl border border-amber-200 shadow-sm mb-6">
            <Text className="text-[10px] font-black uppercase tracking-widest mb-4 text-amber-600">Pending Action Required</Text>
            <View className="flex-col md:flex-row gap-3">
              <View className="flex-1 flex-row bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
                <View className="bg-gray-100 px-4 justify-center border-r border-gray-200"><Text className="font-bold text-xs text-secondary/60">Adv. ₹</Text></View>
                <TextInput 
                  className="flex-1 px-4 py-3 text-primary font-bold"
                  placeholder="Optional Advance"
                  keyboardType="numeric"
                  value={advanceAmount}
                  onChangeText={setAdvanceAmount}
                />
              </View>
              <TouchableOpacity 
                className="bg-emerald-500 px-6 py-3 rounded-xl justify-center items-center shadow-sm"
                onPress={handleConfirmBooking}
                disabled={isConfirming}
              >
                {isConfirming ? <ActivityIndicator size="small" color="#fff" /> : <Text className="text-white font-bold text-[10px] uppercase tracking-widest">Confirm Booking</Text>}
              </TouchableOpacity>
              <TouchableOpacity 
                className="bg-white border border-red-200 px-6 py-3 rounded-xl justify-center items-center shadow-sm"
                onPress={() => setRejectModalVisible(true)}
              >
                <Text className="text-red-500 font-bold text-[10px] uppercase tracking-widest">Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {(booking.status === 'confirmed' || booking.status === 'pending') && !booking.car_id && !booking.is_brokered && (
          <View className="bg-white p-6 rounded-2xl border border-red-200 shadow-sm mb-6 items-center flex-col md:flex-row justify-between">
            <View className="mb-4 md:mb-0">
              <Text className="text-red-500 font-bold uppercase tracking-widest mb-1">Needs Dispatch</Text>
              <Text className="text-secondary/60 text-xs font-medium">This reservation is confirmed but has no vehicle assigned.</Text>
            </View>
            <TouchableOpacity 
              className="bg-primary px-6 py-3 rounded-xl shadow-sm"
              onPress={() => setDispatchModalVisible(true)}
            >
              <Text className="text-white font-bold text-[10px] uppercase tracking-widest">Assign Vehicle</Text>
            </TouchableOpacity>
          </View>
        )}
        {/* Dates Block */}
        <View className="bg-white p-5 rounded-2xl border border-gray-200 flex-row justify-between items-center shadow-sm">
          <View>
            <Text className="text-[10px] font-bold text-secondary/50 uppercase tracking-widest mb-1">Pick Up</Text>
            <Text className="text-lg font-black text-primary">{formatDate(booking.start_date)}</Text>
          </View>
          <Text className="text-secondary/30 text-xl font-light">→</Text>
          <View className="items-end">
            <Text className="text-[10px] font-bold text-secondary/50 uppercase tracking-widest mb-1">Drop Off</Text>
            <Text className="text-lg font-black text-primary">{formatDate(booking.end_date)}</Text>
          </View>
        </View>

        {/* Assigned Vehicle / Vendor Block */}
        <View className={`p-6 rounded-2xl shadow-sm border ${booking.is_brokered ? 'bg-purple-50 border-purple-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <Text className={`text-[10px] font-black uppercase tracking-widest mb-4 ${booking.is_brokered ? 'text-purple-800/50' : 'text-emerald-800/50'}`}>
            {booking.is_brokered ? 'Supplier / Broker Details' : 'Assigned Fleet Vehicle'}
          </Text>
          
          {booking.is_brokered && booking.vendors ? (
            <View>
              <View className="flex-row items-center mb-6">
                <View className="w-12 h-12 bg-white rounded-full items-center justify-center mr-4 shadow-sm">
                  <Text className="text-purple-700 font-black text-xl">{booking.vendors.company_name.charAt(0).toUpperCase()}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-xl font-black text-purple-900">{booking.vendors.company_name}</Text>
                  <Text className="text-sm font-bold text-purple-800/60">{booking.requested_model}</Text>
                </View>
              </View>
              
              <View className="bg-white p-4 rounded-xl border border-purple-100 mb-4">
                <View className="flex-row justify-between items-center mb-3">
                  <Text className="text-xs font-bold text-purple-900/60 uppercase">Agreed Vendor Cost</Text>
                  <Text className="text-lg font-black text-red-500">₹{booking.vendor_cost}</Text>
                </View>
                <View className="flex-row justify-between items-center mb-3 border-t border-purple-50 pt-3">
                  <Text className="text-xs font-bold text-purple-900/60 uppercase">Paid So Far</Text>
                  <Text className="text-lg font-black text-emerald-600">₹{booking.vendor_paid_amount || 0}</Text>
                </View>
                <View className="flex-row justify-between items-center border-t border-purple-50 pt-3">
                  <Text className="text-xs font-bold text-purple-900/60 uppercase">Outstanding Balance</Text>
                  <View className="items-end">
                    <Text className="text-lg font-black text-primary">₹{(Number(booking.vendor_cost || 0) - Number(booking.vendor_paid_amount || 0))}</Text>
                    {booking.vendor_payment_status === 'paid' && (
                      <Text className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">FULLY PAID</Text>
                    )}
                  </View>
                </View>
              </View>
              
              <View className="flex-row gap-3">
                <TouchableOpacity 
                  className="flex-1 bg-white border border-purple-200 py-3 rounded-xl items-center shadow-sm"
                  onPress={() => router.push(`/vendor/${booking.vendors.id}`)}
                >
                  <Text className="text-purple-700 font-bold text-[10px] uppercase tracking-widest">View Vendor</Text>
                </TouchableOpacity>

                {booking.vendor_payment_status !== 'paid' && (
                  <TouchableOpacity 
                    className="flex-1 bg-purple-600 py-3 rounded-xl items-center shadow-sm"
                    onPress={() => setPaymentModalVisible(true)}
                  >
                    <Text className="text-white font-bold text-[10px] uppercase tracking-widest">Log Payment</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : booking.cars ? (
            <View>
              <Text className="text-2xl font-black text-emerald-900 mb-1">{booking.cars.make} {booking.cars.model}</Text>
              <Text className="text-sm font-bold text-emerald-800/60 mb-6">{booking.cars.license_plate}</Text>
              <TouchableOpacity 
                className="bg-white border border-emerald-200 py-3 rounded-xl items-center shadow-sm"
                onPress={() => router.push(`/car/${booking.cars.id}`)}
              >
                <Text className="text-emerald-700 font-bold text-[10px] uppercase tracking-widest">View Vehicle</Text>
              </TouchableOpacity>
            </View>
          ) : (
             <View className="bg-gray-50 p-5 rounded-xl border border-gray-200 items-center">
                <Text className="text-secondary/40 font-bold uppercase tracking-widest mb-1">Not Dispatched</Text>
             </View>
          )}
        </View>

        {/* Customer Payment Ledger */}
        <View className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
           <Text className="text-[10px] font-black uppercase tracking-widest mb-6 text-secondary/40">Customer Financial Ledger</Text>
           
           <View className="flex-col md:flex-row gap-6 mb-8">
             <View className="flex-1 bg-gray-50 rounded-2xl p-5 border border-gray-100">
               <View className="flex-row justify-between items-center mb-3 pb-3 border-b border-gray-200/50">
                 <Text className="text-xs font-bold text-secondary/60">Total Bill</Text>
                 <Text className="text-sm font-black text-primary">₹{booking.total_amount}</Text>
               </View>
               <View className="flex-row justify-between items-center mb-3 pb-3 border-b border-gray-200/50">
                 <Text className="text-xs font-bold text-secondary/60">Paid by Client</Text>
                 <Text className="text-sm font-black text-emerald-600">
                   - ₹{customerPayments.reduce((sum, p) => sum + Number(p.amount), 0)}
                 </Text>
               </View>
               <View className="flex-row justify-between items-center pt-1">
                 <Text className="text-[10px] font-black text-secondary/80 uppercase tracking-widest">Remaining Due</Text>
                 <Text className="text-2xl font-black text-red-500 tracking-tight">
                   ₹{Number(booking.total_amount || 0) - customerPayments.reduce((sum, p) => sum + Number(p.amount), 0)}
                 </Text>
               </View>
             </View>

             <View className="flex-1 flex-col justify-center">
               {booking.status === 'cancelled' || booking.status === 'rejected' ? (
                 <View className="bg-red-50 p-4 rounded-xl border border-red-100 h-full justify-center">
                   <Text className="text-red-600 font-bold text-xs text-center">Payments are disabled because this reservation has been rejected/cancelled.</Text>
                 </View>
               ) : (
                 <>
                   <Text className="text-[10px] font-bold text-secondary/60 uppercase tracking-widest mb-3">Record Client Payment</Text>
                   <View className="flex-col md:flex-row gap-3">
                     <TextInput 
                       className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary font-bold w-full"
                       placeholder="Enter amount (₹)"
                       keyboardType="numeric"
                       value={customerPaymentAmount}
                       onChangeText={setCustomerPaymentAmount}
                     />
                     <TouchableOpacity 
                       className="bg-emerald-600 px-6 py-3 rounded-xl justify-center items-center shadow-sm w-full md:w-auto"
                       onPress={handleRecordCustomerPayment}
                       disabled={isProcessingCustomerPayment}
                     >
                       {isProcessingCustomerPayment ? <ActivityIndicator size="small" color="#fff" /> : <Text className="text-white font-bold text-[10px] uppercase tracking-widest">Add Payment</Text>}
                     </TouchableOpacity>
                   </View>
                 </>
               )}
             </View>
           </View>
           
           <View>
             <Text className="text-[10px] font-black uppercase tracking-widest mb-3 text-secondary/40">Payment History</Text>
             {customerPayments.length > 0 ? (
                <View className="border border-gray-100 rounded-xl overflow-hidden">
                  {customerPayments.map((p, i) => (
                    <View key={i} className={`flex-row justify-between items-center p-4 bg-gray-50 ${i !== customerPayments.length - 1 ? 'border-b border-gray-100' : ''}`}>
                      <View className="flex-row items-center gap-3">
                        <View className="w-2 h-2 rounded-full bg-emerald-400" />
                        <Text className="text-xs font-bold text-secondary/80">{formatDate(p.created_at)}</Text>
                      </View>
                      <View className="bg-emerald-100 px-3 py-1 rounded-md border border-emerald-200">
                        <Text className="text-xs font-black text-emerald-800">+ ₹{p.amount}</Text>
                      </View>
                    </View>
                  ))}
                </View>
             ) : (
                <View className="bg-gray-50 p-6 rounded-xl border border-gray-100 items-center">
                  <Text className="text-xs text-gray-400 font-medium italic">No payments recorded yet.</Text>
                </View>
             )}
           </View>

        </View>

      </View>

      {/* Vendor Payment Modal */}
      {paymentModalVisible && (
        <Modal visible={true} transparent={true} animationType="fade">
          <View className="flex-1 items-center justify-center bg-black/60 p-4">
            <View className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl relative">
              <View className="flex-row justify-between items-center mb-6 border-b border-gray-100 pb-4">
                <View>
                  <Text className="text-xl font-black text-primary">Log Vendor Payout</Text>
                  <Text className="text-xs text-secondary/60 mt-1">Record amount paid to {booking.vendors?.company_name}</Text>
                </View>
                <TouchableOpacity onPress={() => setPaymentModalVisible(false)} className="p-2 bg-gray-50 rounded-full">
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
                  Max Payable: ₹{(Number(booking.vendor_cost || 0) - Number(booking.vendor_paid_amount || 0))}
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


      {/* Reject Modal */}
      {rejectModalVisible && (
        <Modal visible={true} transparent={true} animationType="fade">
          <View className="flex-1 items-center justify-center bg-black/60 p-4">
            <View className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl relative">
              <View className="flex-row justify-between items-center mb-6">
                <View>
                  <Text className="text-xl font-black text-red-600">Reject Booking</Text>
                </View>
                <TouchableOpacity onPress={() => { setRejectModalVisible(false); setRejectReason(''); }} className="p-2 bg-gray-50 rounded-full">
                  <Text className="text-gray-500 font-bold">✕</Text>
                </TouchableOpacity>
              </View>
              <View className="mb-6">
                <Text className="text-xs font-bold text-secondary mb-2">REASON <Text className="text-red-500">*</Text></Text>
                <TextInput 
                  className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary"
                  placeholder="Reason..."
                  multiline numberOfLines={3}
                  value={rejectReason} onChangeText={setRejectReason}
                />
              </View>
              <TouchableOpacity className="w-full py-4 rounded-xl items-center bg-red-600" onPress={handleRejectBooking} disabled={isRejecting || !rejectReason.trim()}>
                {isRejecting ? <ActivityIndicator color="#fff" size="small" /> : <Text className="text-white font-bold text-sm">Confirm Rejection</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Dispatch Modal */}
      {dispatchModalVisible && (
        <Modal visible={true} transparent={true} animationType="fade">
          <View className="flex-1 items-center justify-center bg-black/60 p-4">
            <View className="bg-white w-full max-w-2xl rounded-[32px] p-6 md:p-8 shadow-2xl relative max-h-[90%] flex-col">
              <ScrollView showsVerticalScrollIndicator={false}>
              
              <View className="flex-row justify-between items-center mb-6">
                <View>
                  <Text className="text-xl font-black text-primary">Assign Vehicle</Text>
                  <Text className="text-xs text-secondary/60 mt-1">Requested: {booking.requested_model}</Text>
                </View>
                <TouchableOpacity onPress={() => setDispatchModalVisible(false)} className="p-2 bg-gray-50 rounded-full">
                  <Text className="text-gray-500 font-bold">✕</Text>
                </TouchableOpacity>
              </View>

              <View className="flex-row bg-gray-100 p-1 rounded-xl mb-6">
                <TouchableOpacity onPress={() => setDispatchMode('fleet')} className={`flex-1 py-2 rounded-lg items-center ${dispatchMode === 'fleet' ? 'bg-white shadow-sm' : ''}`}>
                  <Text className={`text-xs font-bold ${dispatchMode === 'fleet' ? 'text-primary' : 'text-gray-500'}`}>My Fleet</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setDispatchMode('broker')} className={`flex-1 py-2 rounded-lg items-center ${dispatchMode === 'broker' ? 'bg-white shadow-sm' : ''}`}>
                  <Text className={`text-xs font-bold ${dispatchMode === 'broker' ? 'text-purple-600' : 'text-gray-500'}`}>Supplier / Broker</Text>
                </TouchableOpacity>
              </View>

              {dispatchMode === 'fleet' ? (
                <View className="mb-6">
                  <Text className="text-xs font-bold text-secondary mb-3">SELECT VEHICLE</Text>
                  <View className="space-y-2">
                    {cars.map(c => {
                      const isSelected = selectedCarId === c.id;
                      return (
                        <TouchableOpacity key={c.id} onPress={() => setSelectedCarId(c.id)} className={`p-4 rounded-xl border flex-row justify-between items-center ${isSelected ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-gray-200'}`}>
                          <View>
                            <Text className={`font-black ${isSelected ? 'text-emerald-700' : 'text-primary'}`}>{c.make} {c.model}</Text>
                            <Text className="text-xs text-gray-500">{c.license_plate}</Text>
                          </View>
                          {isSelected && <View className="w-4 h-4 rounded-full bg-emerald-500" />}
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                </View>
              ) : (
                <View className="mb-6 space-y-4">
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-xs font-bold text-purple-900/60 uppercase">Select Supplier</Text>
                    <TouchableOpacity onPress={() => setIsCreatingVendor(!isCreatingVendor)}>
                      <Text className="text-xs font-bold text-purple-600">{isCreatingVendor ? 'Choose Existing' : '+ Add New'}</Text>
                    </TouchableOpacity>
                  </View>

                  {isCreatingVendor ? (
                    <View className="bg-purple-50 p-4 rounded-xl border border-purple-100 space-y-3">
                      <TextInput className="bg-white border border-purple-200 rounded-lg px-4 py-3" placeholder="Company Name *" value={newVendorName} onChangeText={setNewVendorName} />
                      <TextInput className="bg-white border border-purple-200 rounded-lg px-4 py-3" placeholder="Phone Number" value={newVendorPhone} onChangeText={setNewVendorPhone} keyboardType="phone-pad" />
                      <TextInput className="bg-white border border-purple-200 rounded-lg px-4 py-3" placeholder="Address" value={newVendorAddress} onChangeText={setNewVendorAddress} />
                    </View>
                  ) : (
                    <View className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                      <TextInput className="bg-white border border-gray-200 rounded-lg px-4 py-2 mb-2 text-sm" placeholder="Search suppliers..." value={vendorSearch} onChangeText={setVendorSearch} />
                      <ScrollView className="max-h-40 border border-gray-100 rounded-lg bg-white">
                        {vendorsList.filter(v => v.company_name.toLowerCase().includes(vendorSearch.toLowerCase())).map(v => (
                          <TouchableOpacity key={v.id} onPress={() => setSelectedVendorId(v.id)} className={`p-3 border-b border-gray-50 flex-row justify-between items-center ${selectedVendorId === v.id ? 'bg-purple-50' : 'bg-white'}`}>
                            <Text className={`font-bold ${selectedVendorId === v.id ? 'text-purple-700' : 'text-primary'}`}>{v.company_name}</Text>
                            {selectedVendorId === v.id && <View className="w-2 h-2 rounded-full bg-purple-500" />}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  <View>
                    <Text className="text-xs font-bold text-secondary mb-2 mt-2">AGREED VENDOR COST (₹)</Text>
                    <TextInput className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary font-bold" placeholder="0.00" keyboardType="numeric" value={vendorCost} onChangeText={setVendorCost} />
                  </View>
                </View>
              )}

              <TouchableOpacity className="w-full py-4 rounded-xl items-center bg-primary mt-4" onPress={handleDispatchSubmit} disabled={isDispatching}>
                {isDispatching ? <ActivityIndicator color="#fff" size="small" /> : <Text className="text-white font-bold text-sm">Assign to Trip</Text>}
              </TouchableOpacity>
              
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

    </ScrollView>
  );
}
