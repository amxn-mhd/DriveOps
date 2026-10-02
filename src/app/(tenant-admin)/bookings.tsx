import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Platform, TextInput, Modal, Alert } from 'react-native';
import { useState, useEffect, useRef } from 'react';

import { supabase } from '../../lib/supabase';

const setStorage = (key: string, val: string) => {
  if (Platform.OS === 'web') {
    try { window.localStorage.setItem(key, val); } catch (e) {}
  }
};

const getStorage = (key: string) => {
  if (Platform.OS === 'web') {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  return null;
};
import { useRouter } from 'expo-router';

export default function AllBookingsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  
  // Data
  const [bookings, setBookings] = useState<any[]>([]);
  const [cars, setCars] = useState<any[]>([]);
  const [vendorsList, setVendorsList] = useState<any[]>([]);
  
  // UI State
  const [filter, setFilter] = useState('all');
  const scrollViewRef = useRef<any>(null);

  const hasRestoredScroll = useRef(false);

  useEffect(() => {
    const val = getStorage('bookings_filter');
    if (val) {

      setFilter(val);
    }
  }, []);

  useEffect(() => {
    if (!loading && !hasRestoredScroll.current && bookings.length > 0) {
      hasRestoredScroll.current = true;
      const val = getStorage('bookings_scroll');
      if (val) {
        if (scrollViewRef.current) {
          setTimeout(() => {
            scrollViewRef.current?.scrollTo({ y: parseFloat(val), animated: false });
          }, 50);
        }
      }
    }
  }, [loading, bookings.length]);

  const handleSetFilter = (newFilter: string) => {
    setFilter(newFilter);
    setStorage('bookings_filter', newFilter);
  };

  const handleScroll = (event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    setStorage('bookings_scroll', scrollY.toString());
  }; 
  const [searchQuery, setSearchQuery] = useState('');

  // Dispatch Modal State
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [dispatchMode, setDispatchMode] = useState('fleet'); // 'fleet' or 'broker'
  const [selectedCarId, setSelectedCarId] = useState('');
  const [vendorCost, setVendorCost] = useState('');
  
  // New Vendor States
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [isCreatingVendor, setIsCreatingVendor] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorPhone, setNewVendorPhone] = useState('');
  const [newVendorAddress, setNewVendorAddress] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');
  const [isDispatching, setIsDispatching] = useState(false);

  // Confirm Modal State
  const [enquiryToConfirm, setEnquiryToConfirm] = useState<any>(null);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  // Reject Modal State
  const [enquiryToReject, setEnquiryToReject] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user?.id).single();
      
      if (profile?.tenant_id) {
        // Fetch fleet
        const { data: fleetData } = await supabase.from('cars').select('*').eq('tenant_id', profile.tenant_id);
        setCars(fleetData || []);

        const { data: vData } = await supabase.from('vendors').select('*').eq('tenant_id', profile.tenant_id).order('company_name');
        setVendorsList(vData || []);

        // Fetch bookings
        const { data } = await supabase
          .from('bookings')
          .select('*, customers(full_name, phone), cars!bookings_car_id_fkey(make, model, license_plate), vendors(company_name)')
          .eq('tenant_id', profile.tenant_id)
          .order('start_date', { ascending: false });
        
        setBookings(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const executeConfirmEnquiry = async () => {
    if (!enquiryToConfirm) return;
    setIsConfirming(true);
    try {
      const { error: updErr } = await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', enquiryToConfirm.id);
      if (updErr) throw updErr;

      if (advanceAmount && parseFloat(advanceAmount) > 0) {
        const { error: payErr } = await supabase.from('payments').insert([{
          tenant_id: enquiryToConfirm.tenant_id,
          booking_id: enquiryToConfirm.id,
          amount: parseFloat(advanceAmount),
          method: 'cash'
        }]);
        if (payErr) throw payErr;
      }

      setEnquiryToConfirm(null);
      setAdvanceAmount('');
      fetchData();
    } catch (err: any) {
      if (Platform.OS === 'web') window.alert("Error: " + err.message);
      else Alert.alert("Error", err.message);
    } finally {
      setIsConfirming(false);
    }
  };


  const handleRejectBooking = async () => {
    if (!enquiryToReject || !rejectReason.trim()) return;
    setIsRejecting(true);
    try {
      const existingComments = enquiryToReject.comments || '';
      const newComments = existingComments ? `${existingComments}\n\n[Rejected Reason]: ${rejectReason.trim()}` : `[Rejected Reason]: ${rejectReason.trim()}`;
      
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled', comments: newComments })
        .eq('id', enquiryToReject.id);
        
      if (error) throw error;
      
      setEnquiryToReject(null);
      setRejectReason('');
      fetchData();
    } catch (e: any) {
      if (Platform.OS === 'web') window.alert("Error: " + e.message);
      else Alert.alert("Error", e.message);
    } finally {
      setIsRejecting(false);
    }
  };
  const handleDispatchSubmit = async () => {
    if (!selectedBooking) return;
    setIsDispatching(true);
    
    try {
      const payload: any = { status: 'confirmed' }; 
      
      if (dispatchMode === 'fleet') {
        if (!selectedCarId) {
          if (Platform.OS === 'web') window.alert("Please select a vehicle.");
          else Alert.alert("Error", "Please select a vehicle.");
          setIsDispatching(false);
          return;
        }
        payload.car_id = selectedCarId;
        payload.is_brokered = false;
        payload.vendor_name = null;
        payload.vendor_cost = 0;
      } else {
        let finalVendorId = selectedVendorId;
        
        if (isCreatingVendor) {
          if (!newVendorName) {
            if (Platform.OS === 'web') window.alert("Please enter the new vendor's company name.");
            else Alert.alert("Error", "Please enter the new vendor's company name.");
            setIsDispatching(false);
            return;
          }
          
          const { data: { user } } = await supabase.auth.getUser();
          const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user?.id).single();
          
          const { data: newV, error: vErr } = await supabase.from('vendors').insert([{
            tenant_id: profile?.tenant_id,
            company_name: newVendorName,
            phone: newVendorPhone,
            address: newVendorAddress
          }]).select().single();
          
          if (vErr) throw vErr;
          finalVendorId = newV.id;
        } else {
          if (!finalVendorId) {
             if (Platform.OS === 'web') window.alert("Please select a vendor.");
             else Alert.alert("Error", "Please select a vendor.");
             setIsDispatching(false);
             return;
          }
        }
        
        payload.car_id = null;
        payload.is_brokered = true;
        payload.vendor_id = finalVendorId;
        payload.vendor_cost = parseFloat(vendorCost || '0');
      }

      const { error } = await supabase
        .from('bookings')
        .update(payload)
        .eq('id', selectedBooking.id);

      if (error) throw error;
      
      setSelectedBooking(null);
      setDispatchMode('fleet');
      setSelectedCarId('');
      setSelectedVendorId('');
      setNewVendorName('');
      setNewVendorPhone('');
      setNewVendorAddress('');
      setVendorCost('');
      setIsCreatingVendor(false);
      fetchData();
      
    } catch (err: any) {
      if (Platform.OS === 'web') window.alert("Error: " + err.message);
      else Alert.alert("Error", err.message);
    } finally {
      setIsDispatching(false);
    }
  };

  const isCarAvailable = (carId: string, startDate: string, endDate: string) => {
    const assignedBookings = bookings.filter(b => b.car_id === carId && ['confirmed', 'active', 'pending'].includes(b.status));
    return !assignedBookings.some(b => {
      const existingStart = new Date(b.start_date);
      const existingEnd = new Date(b.end_date);
      const reqStart = new Date(startDate);
      const reqEnd = new Date(endDate);
      return existingStart <= reqEnd && existingEnd >= reqStart;
    });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`;
  };

  const availableCars = selectedBooking 
    ? cars.filter(c => isCarAvailable(c.id, selectedBooking.start_date, selectedBooking.end_date))
    : [];

  const filteredBookings = bookings.filter(b => {
    let matchesFilter = false;
    if (filter === 'all') matchesFilter = true;
    else if (filter === 'unassigned') matchesFilter = (b.status === 'confirmed' || b.status === 'pending') && !b.car_id && !b.is_brokered;
    else if (filter === 'assigned') matchesFilter = !!(b.car_id || b.is_brokered);
    else matchesFilter = b.status === filter;

    const matchesSearch = (b.customers?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (b.requested_model || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (b.cars?.license_plate || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <ScrollView ref={scrollViewRef} onScroll={handleScroll} scrollEventThrottle={100} className="flex-1 bg-[#FAFAFA]" contentContainerStyle={{ padding: 20 }}>
      <View className="mb-6 flex-col md:flex-row justify-between md:items-center gap-4">
        <View>
          <Text className="text-3xl font-black text-primary tracking-tight mb-2">Bookings</Text>
          <Text className="text-secondary/60">Manage your enquiries, dispatches, and active trips.</Text>
        </View>
        <TouchableOpacity 
          className="bg-primary px-6 py-3 rounded-xl flex-row items-center shadow-lg shadow-primary/30 self-start md:self-auto"
          onPress={() => router.push('/(tenant-admin)/new-booking')}
        >
          <Text className="text-white font-bold tracking-wider">➕ NEW BOOKING</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-col lg:flex-row gap-4 mb-6">
        <TextInput
          className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-primary font-medium shadow-sm"
          placeholder="Search by client, model, or plate..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4, paddingHorizontal: 2 }}>
          {['all', 'enquiry', 'unassigned', 'assigned', 'active', 'completed', 'cancelled'].map(f => (
            <TouchableOpacity 
              key={f}
              onPress={() => handleSetFilter(f)}
              className={`px-5 py-3 rounded-xl border ${filter === f ? 'bg-primary border-primary shadow-md' : 'bg-white border-gray-200'} mr-3`}
            >
              <Text className={`font-bold uppercase tracking-widest text-xs ${filter === f ? 'text-white' : 'text-gray-500'}`}>{f === 'cancelled' ? 'Rejected' : f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View className="mt-10 items-center"><ActivityIndicator size="large" color="#00162C" /></View>
      ) : (
        <View className="space-y-4">
          {filteredBookings.length === 0 ? (
            <View className="bg-white p-8 rounded-2xl border border-gray-200 items-center justify-center border-dashed h-40">
              <Text className="text-gray-400 font-medium">No bookings found matching your criteria.</Text>
            </View>
          ) : (
            filteredBookings.map(b => {
              const isUnassigned = (b.status === 'confirmed' || b.status === 'pending') && !b.car_id && !b.is_brokered;
              const isEnquiry = b.status === 'enquiry';
              
              return (
                <View key={b.id} className={`rounded-2xl shadow-sm border p-5 flex-col lg:flex-row justify-between lg:items-stretch gap-6 ${b.is_brokered ? 'bg-purple-50/30 border-purple-200' : 'bg-white border-gray-100'} ${isUnassigned ? 'border-red-200 bg-white' : ''} ${isEnquiry ? 'border-amber-200 bg-white' : ''}`}>
                  
                  <View className="w-full lg:w-0 lg:flex-[1.5] flex-col justify-start">
                    <View className="flex-row items-center mb-2">
                      <View className={`px-2 py-1 rounded mr-3 ${
                        isUnassigned ? 'bg-red-100' :
                        b.status === 'active' ? 'bg-blue-100' :
                        b.status === 'confirmed' ? 'bg-emerald-100' :
                        b.status === 'completed' ? 'bg-gray-200' :
                        'bg-amber-100'
                      }`}>
                        <Text className={`text-[10px] font-bold uppercase ${
                          isUnassigned ? 'text-red-700' :
                          b.status === 'active' ? 'text-blue-700' :
                          b.status === 'confirmed' ? 'text-emerald-700' :
                          b.status === 'completed' ? 'text-gray-600' :
                          'text-amber-700'
                        }`}>{isUnassigned ? 'UNASSIGNED' : b.status}</Text>
                      </View>
                      <Text className="text-xs font-bold text-secondary/50 uppercase tracking-widest">{formatDate(b.start_date)}  →  {formatDate(b.end_date)}</Text>
                    </View>
                    <Text className="text-lg font-black text-primary mb-1">{b.customers?.full_name}</Text>
                    <Text className="text-sm font-medium text-secondary/70">{b.customers?.phone}</Text>
                  </View>

                  <View className="w-full lg:w-0 lg:flex-[1.5] flex-col justify-start border-t lg:border-t-0 lg:border-l border-gray-100 pt-4 lg:pt-0 lg:pl-6">
                    <Text className="text-[10px] font-bold text-secondary/50 uppercase tracking-widest mb-1">Vehicle</Text>
                    {b.cars ? (
                      <View>
                        <Text className="font-bold text-primary">{b.cars.make} {b.cars.model}</Text>
                        <Text className="text-xs text-secondary/70">{b.cars.license_plate}</Text>
                      </View>
                    ) : b.is_brokered ? (
                      <View>
                        <Text className="font-bold text-purple-700">{b.requested_model}</Text>
                        <Text className="text-xs text-purple-600/70">Brokered: {b.vendors?.company_name || b.vendor_name}</Text>
                      </View>
                    ) : (
                      <View>
                        <Text className={`font-bold ${isUnassigned ? 'text-red-500' : 'text-amber-600'}`}>{b.requested_model || 'Any Vehicle'}</Text>
                        <Text className={`text-xs ${isUnassigned ? 'text-red-400' : 'text-amber-700/70'}`}>{isUnassigned ? 'Needs Allocation' : 'Enquiry'}</Text>
                      </View>
                    )}
                    
                    {!!b.comments && (
                      <View className={`mt-3 p-3 rounded-lg border ${b.status === 'cancelled' ? 'bg-red-50/50 border-red-100' : 'bg-amber-50/50 border-amber-100'} self-start w-full`}>
                        <Text className={`text-[10px] font-black uppercase tracking-widest mb-1 ${b.status === 'cancelled' ? 'text-red-700/60' : 'text-amber-700/60'}`}>Notes</Text>
                        <Text className={`text-xs leading-relaxed ${b.status === 'cancelled' ? 'text-red-900' : 'text-amber-900'}`} numberOfLines={2}>{b.comments}</Text>
                      </View>
                    )}
                  </View>

                  <View className="w-full lg:w-0 lg:flex-[1.2] flex-col justify-start lg:items-end border-t lg:border-t-0 lg:border-l border-gray-100 pt-4 lg:pt-0 lg:pl-6">
                    <View className="items-start lg:items-end mb-3">
                      <Text className="text-[10px] font-bold text-secondary/50 uppercase tracking-widest mb-1">Total</Text>
                      <Text className="text-lg font-black text-primary">₹{b.total_amount}</Text>
                    </View>
                    
                    <View className="flex-row gap-2 flex-wrap lg:justify-end w-full mt-2 lg:mt-0">
                      
                      {/* Universal Buttons */}
                      <TouchableOpacity 
                        className="bg-primary px-3 py-2 rounded-lg shadow-sm"
                        onPress={() => router.push(`/(tenant-admin)/booking/${b.id}`)}
                      >
                        <Text className="text-white font-bold text-[10px] uppercase">Details</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        className="bg-gray-100 px-3 py-2 rounded-lg border border-gray-200"
                        onPress={() => router.push(`/customer/${b.customer_id}`)}
                      >
                        <Text className="text-secondary font-bold text-[10px] uppercase">Client</Text>
                      </TouchableOpacity>

                      {/* Vendor specific */}
                      {b.is_brokered && !!b.vendor_id && (
                        <TouchableOpacity 
                          className="bg-purple-50 px-3 py-2 rounded-lg border border-purple-200"
                          onPress={() => router.push(`/vendor/${b.vendor_id}`)}
                        >
                          <Text className="text-purple-700 font-bold text-[10px] uppercase">Vendor</Text>
                        </TouchableOpacity>
                      )}
                      
                      {/* Status specific actions */}
                      {isEnquiry && (
                        <>
                          <TouchableOpacity 
                            className="bg-emerald-600 px-3 py-2 rounded-lg shadow-sm"
                            onPress={() => { setEnquiryToConfirm(b); setAdvanceAmount(''); }}
                          >
                            <Text className="text-white font-bold text-[10px] uppercase">Confirm</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            className="bg-white border border-red-200 px-3 py-2 rounded-lg shadow-sm"
                            onPress={() => setEnquiryToReject(b)}
                          >
                            <Text className="text-red-500 font-bold text-[10px] uppercase">Reject</Text>
                          </TouchableOpacity>
                        </>
                      )}

                      {isUnassigned && (
                        <>
                          <TouchableOpacity 
                            className="bg-red-500 px-3 py-2 rounded-lg shadow-sm"
                            onPress={() => { setSelectedBooking(b); setDispatchMode('fleet'); setSelectedCarId(''); setSelectedVendorId(''); setNewVendorName(''); setNewVendorPhone(''); setNewVendorAddress(''); setIsCreatingVendor(false); setVendorCost(''); }}
                          >
                            <Text className="text-white font-bold text-[10px] uppercase">Assign</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            className="bg-white border border-red-200 px-3 py-2 rounded-lg shadow-sm"
                            onPress={() => setEnquiryToReject(b)}
                          >
                            <Text className="text-red-500 font-bold text-[10px] uppercase">Reject</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

      {/* Dispatch Modal */}
      {selectedBooking ? (
        <Modal visible={true} transparent={true} animationType="fade">
          <View className="flex-1 items-center justify-center bg-black/60 p-4">
            <View className="bg-white w-full max-w-lg rounded-[32px] p-6 shadow-2xl relative max-h-[90%]">
              <View className="flex-row justify-between items-center mb-6 border-b border-gray-100 pb-4">
                <View>
                  <Text className="text-xl font-black text-primary">Dispatch Vehicle</Text>
                  <Text className="text-xs text-secondary/60 mt-1">
                    For {selectedBooking.customers?.full_name} ({formatDate(selectedBooking.start_date)})
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedBooking(null)} className="p-2 bg-gray-50 rounded-full">
                  <Text className="text-gray-500 font-bold">✕</Text>
                </TouchableOpacity>
              </View>

              <View className="flex-row rounded-xl overflow-hidden border border-gray-200 mb-6">
                <TouchableOpacity 
                  className={`flex-1 py-3 items-center ${dispatchMode === 'fleet' ? 'bg-primary' : 'bg-gray-50'}`}
                  onPress={() => setDispatchMode('fleet')}
                >
                  <Text className={`font-bold text-[10px] uppercase tracking-widest ${dispatchMode === 'fleet' ? 'text-white' : 'text-gray-500'}`}>Internal Fleet</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  className={`flex-1 py-3 items-center ${dispatchMode === 'broker' ? 'bg-purple-600' : 'bg-gray-50'}`}
                  onPress={() => setDispatchMode('broker')}
                >
                  <Text className={`font-bold text-[10px] uppercase tracking-widest ${dispatchMode === 'broker' ? 'text-white' : 'text-gray-500'}`}>Broker Out</Text>
                </TouchableOpacity>
              </View>

              <ScrollView className="mb-6" showsVerticalScrollIndicator={false}>
                {dispatchMode === 'fleet' ? (
                  <View className="space-y-2">
                    {availableCars.map((car: any) => (
                      <TouchableOpacity 
                        key={car.id}
                        onPress={() => setSelectedCarId(car.id)}
                        className={`p-4 rounded-xl border ${selectedCarId === car.id ? 'bg-primary/5 border-primary' : 'bg-white border-gray-200'} flex-row justify-between items-center`}
                      >
                        <View>
                          <Text className="font-bold text-primary">{car.make} {car.model}</Text>
                          <Text className="text-xs text-secondary/70">{car.license_plate}</Text>
                        </View>
                        {selectedCarId === car.id && (
                          <View className="w-5 h-5 rounded-full bg-primary items-center justify-center">
                            <Text className="text-white text-[10px] font-bold">✓</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                    {availableCars.length === 0 && (
                      <View className="py-8 items-center justify-center bg-gray-50 rounded-xl border border-gray-200">
                        <Text className="text-gray-400 font-bold text-xs uppercase tracking-widest">No available cars found</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <View className="space-y-4">
                    <View className="bg-purple-50 p-3 rounded-lg border border-purple-100 mb-2 flex-row justify-between items-center">
                      <Text className="text-xs text-purple-900 font-bold uppercase tracking-widest">Select Supplier</Text>
                      <TouchableOpacity onPress={() => setIsCreatingVendor(!isCreatingVendor)} className="bg-purple-600 px-3 py-1 rounded">
                        <Text className="text-white text-[10px] font-bold uppercase">{isCreatingVendor ? 'Select Existing' : '➕ Add New'}</Text>
                      </TouchableOpacity>
                    </View>
                    
                    {isCreatingVendor ? (
                      <View className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                        <View>
                          <Text className="text-[10px] font-bold text-secondary/60 mb-1">COMPANY NAME *</Text>
                          <TextInput className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-primary text-sm" placeholder="e.g. ABC Rentals" value={newVendorName} onChangeText={setNewVendorName} />
                        </View>
                        <View className="flex-row gap-3">
                          <View className="flex-1">
                            <Text className="text-[10px] font-bold text-secondary/60 mb-1">PHONE</Text>
                            <TextInput className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-primary text-sm" placeholder="Optional" value={newVendorPhone} onChangeText={setNewVendorPhone} keyboardType="phone-pad" />
                          </View>
                        </View>
                        <View>
                          <Text className="text-[10px] font-bold text-secondary/60 mb-1">ADDRESS</Text>
                          <TextInput className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-primary text-sm" placeholder="Optional" value={newVendorAddress} onChangeText={setNewVendorAddress} />
                        </View>
                      </View>
                    ) : (
                      <View>
                        <TextInput 
                          className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-primary font-medium shadow-sm mb-3"
                          placeholder="Search existing vendors..."
                          value={vendorSearch}
                          onChangeText={setVendorSearch}
                        />
                        <View className="max-h-40 border border-gray-200 rounded-xl bg-white overflow-hidden">
                           <ScrollView nestedScrollEnabled={true}>
                             {vendorsList.filter(v => v.company_name.toLowerCase().includes(vendorSearch.toLowerCase())).map(v => (
                               <TouchableOpacity 
                                 key={v.id}
                                 onPress={() => setSelectedVendorId(v.id)}
                                 className={`p-3 border-b border-gray-100 flex-row justify-between items-center ${selectedVendorId === v.id ? 'bg-primary/5' : ''}`}
                               >
                                 <View>
                                   <Text className={`font-bold ${selectedVendorId === v.id ? 'text-primary' : 'text-secondary'}`}>{v.company_name}</Text>
                                   {!!v.phone && <Text className="text-[10px] text-gray-400">{v.phone}</Text>}
                                 </View>
                                 {selectedVendorId === v.id && <Text className="text-primary font-black">✓</Text>}
                               </TouchableOpacity>
                             ))}
                             {vendorsList.length === 0 && <Text className="p-4 text-center text-gray-400 text-xs font-medium">No vendors saved yet.</Text>}
                           </ScrollView>
                        </View>
                      </View>
                    )}

                    <View>
                      <Text className="text-xs font-bold text-secondary mb-2">VENDOR COST (₹) *</Text>
                      <TextInput 
                        className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary font-medium"
                        keyboardType="numeric"
                        placeholder="Amount you will pay them for this trip"
                        value={vendorCost}
                        onChangeText={setVendorCost}
                      />
                    </View>
                  </View>
                )}
              </ScrollView>

              <TouchableOpacity 
                className={`w-full py-4 rounded-xl items-center shadow-lg transition-colors ${isDispatching ? 'bg-primary/50' : 'bg-primary'}`}
                onPress={handleDispatchSubmit}
                disabled={isDispatching}
              >
                {isDispatching ? <ActivityIndicator color="#fff" size="small" /> : <Text className="text-white font-bold text-sm tracking-widest uppercase">Confirm Dispatch</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Confirm Enquiry Modal */}
      {enquiryToConfirm ? (
        <Modal visible={true} transparent={true} animationType="fade">
          <View className="flex-1 items-center justify-center bg-black/60 p-4">
            <View className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl relative">
              <View className="flex-row justify-between items-center mb-6 border-b border-gray-100 pb-4">
                <View>
                  <Text className="text-xl font-black text-primary">Confirm Booking</Text>
                  <Text className="text-xs text-secondary/60 mt-1">Record advance payment</Text>
                </View>
                <TouchableOpacity onPress={() => setEnquiryToConfirm(null)} className="p-2 bg-gray-50 rounded-full">
                  <Text className="text-gray-500 font-bold">✕</Text>
                </TouchableOpacity>
              </View>

              <View className="mb-6">
                <Text className="text-xs font-bold text-secondary mb-2">ADVANCE AMOUNT (₹)</Text>
                <TextInput 
                  className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-4 text-emerald-900 font-black text-lg"
                  keyboardType="numeric"
                  value={advanceAmount}
                  onChangeText={setAdvanceAmount}
                />
                <Text className="text-[10px] text-gray-400 mt-2 font-medium italic">* Leave blank if no advance</Text>
              </View>

              <TouchableOpacity 
                className={`w-full py-4 rounded-xl items-center shadow-lg transition-colors ${isConfirming ? 'bg-primary/50' : 'bg-primary'}`}
                onPress={executeConfirmEnquiry}
                disabled={isConfirming}
              >
                {isConfirming ? <ActivityIndicator color="#fff" size="small" /> : <Text className="text-white font-bold text-sm tracking-widest uppercase">Confirm</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Reject Enquiry Modal */}
      {enquiryToReject && (
        <Modal visible={true} transparent={true} animationType="fade">
          <View className="flex-1 items-center justify-center bg-black/60 p-4">
            <View className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl relative">
              <View className="flex-row justify-between items-center mb-6">
                <View>
                  <Text className="text-xl font-black text-red-600">Reject Booking</Text>
                  <Text className="text-xs text-secondary/60 mt-1">Please provide a reason</Text>
                </View>
                <TouchableOpacity onPress={() => { setEnquiryToReject(null); setRejectReason(''); }} className="p-2 bg-gray-50 rounded-full">
                  <Text className="text-gray-500 font-bold">✕</Text>
                </TouchableOpacity>
              </View>

              <View className="mb-6">
                <Text className="text-xs font-bold text-secondary mb-2">REJECTION REASON <Text className="text-red-500">*</Text></Text>
                <TextInput 
                  className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary"
                  placeholder="e.g. No vehicles available on these dates"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  value={rejectReason}
                  onChangeText={setRejectReason}
                />
              </View>

              <TouchableOpacity 
                className={`w-full py-4 rounded-xl items-center shadow-lg transition-colors ${!rejectReason.trim() ? 'bg-red-300' : 'bg-red-600 hover:bg-red-700'}`}
                onPress={handleRejectBooking}
                disabled={isRejecting || !rejectReason.trim()}
              >
                {isRejecting ? <ActivityIndicator color="#fff" size="small" /> : <Text className="text-white font-bold text-sm tracking-widest uppercase">Confirm Rejection</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

    </ScrollView>
  );
}
