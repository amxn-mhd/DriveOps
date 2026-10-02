import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar } from 'react-native-calendars';
import * as DocumentPicker from 'expo-document-picker';
import * as ImageManipulator from 'expo-image-manipulator';

let globalBookingLock = false;
export default function NewBookingScreen() {
  const router = useRouter();
  const { car_id } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [tenantId, setTenantId] = useState('');
  
  // Car Data
  const [selectedCar, setSelectedCar] = useState<any>(null);
  const [bookedDates, setBookedDates] = useState<any>({});
  
  // Customer Search & Details
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [idDocument, setIdDocument] = useState<any>(null); // For new uploads
  const [existingIdUrl, setExistingIdUrl] = useState<string | null>(null);

  // Booking Details
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [advancePayment, setAdvancePayment] = useState('');

  // New Class-Based Booking Fields
  const [requestedModel, setRequestedModel] = useState('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [bookingStatus, setBookingStatus] = useState('confirmed'); // 'confirmed' or 'enquiry'
  const [comments, setComments] = useState('');

  useEffect(() => {
    fetchInitData();
  }, [car_id]);

  useEffect(() => {
    if (searchQuery.length > 2) {
      searchCustomers();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const fetchInitData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
    if (profile?.tenant_id) {
      setTenantId(profile.tenant_id);
      
      // Fetch unique car models for the fleet
      const { data: allCars } = await supabase.from('cars').select('make, model').eq('tenant_id', profile.tenant_id);
      if (allCars) {
        const unique = Array.from(new Set(allCars.map((c: any) => `${c.make} ${c.model}`)));
        setAvailableModels(unique as string[]);
      }
      
      if (car_id) {
        // Fetch specific car
        const { data: carData } = await supabase.from('cars').select('*').eq('id', car_id).single();
        setSelectedCar(carData);

        // Fetch bookings for this car to block dates
        const { data: bookings } = await supabase
          .from('bookings')
          .select('start_date, end_date')
          .eq('car_id', car_id)
          .in('status', ['active', 'pending']);

        let marked: any = {};
        if (bookings) {
          bookings.forEach(b => {
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
      }
    }
  };

  const searchCustomers = async () => {
    setIsSearching(true);
    try {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('tenant_id', tenantId)
        .or(`full_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
        .limit(5);
      setSearchResults(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  const selectCustomer = (cust: any) => {
    setSelectedCustomer(cust);
    setFullName(cust.full_name);
    setPhone(cust.phone || '');
    setEmail(cust.email || '');
    setAddress(cust.address || '');
    setExistingIdUrl(cust.id_document_url || null);
    setIdDocument(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  const clearCustomerSelection = () => {
    setSelectedCustomer(null);
    setFullName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setExistingIdUrl(null);
    setIdDocument(null);
  };

  const compressImageWeb = async (uri: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > 1200) {
          height = Math.round((height * 1200) / width);
          width = 1200;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(uri);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(URL.createObjectURL(blob));
          } else {
            resolve(uri);
          }
        }, 'image/jpeg', 0.6);
      };
      img.onerror = () => resolve(uri);
      img.src = uri;
    });
  };

  const pickIdDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled === false && result.assets && result.assets.length > 0) {
        setIdDocument(result.assets[0]);
      }
    } catch (err) {
      console.error("Document picker error:", err);
    }
  };

  const uploadIdDocument = async (file: DocumentPicker.DocumentPickerAsset, custId: string) => {
    try {
      let finalUri = file.uri;
      let finalExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      
      if (Platform.OS === 'web') {
        finalUri = await compressImageWeb(file.uri);
        finalExt = 'jpg';
      } else {
        try {
          const manipResult = await ImageManipulator.manipulateAsync(
            file.uri, [{ resize: { width: 1200 } }], { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
          );
          finalUri = manipResult.uri;
          finalExt = 'jpg';
        } catch (e) {}
      }

      const response = await fetch(finalUri);
      const blob = await response.blob();
      const filename = `${tenantId}/customers/id_${custId}_${Date.now()}.${finalExt}`;
      
      const { data, error } = await supabase.storage
        .from('vehicle_documents')
        .upload(filename, blob, { upsert: true });

      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage
        .from('vehicle_documents')
        .getPublicUrl(filename);
        
      return publicUrl;
    } catch (error) {
      console.error("Upload Error", error);
      return null;
    }
  };

  const onDayPress = (day: any) => {
    const localToday = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
    if (day.dateString < localToday) {
      setErrorMsg('Booking dates cannot be in the past.');
      return;
    }
    
    if (!startDate || (startDate && endDate)) {
      if (bookedDates[day.dateString] && bookedDates[day.dateString].disabled) {
        setErrorMsg('The selected start date is already booked.');
        return;
      }
      setErrorMsg('');
      setStartDate(day.dateString);
      setEndDate('');
    } else if (startDate && !endDate) {
      const selectedDate = new Date(day.dateString);
      const currentStart = new Date(startDate);
      
      let start = currentStart < selectedDate ? currentStart : selectedDate;
      let end = currentStart < selectedDate ? selectedDate : currentStart;
      
      let curr = new Date(start);
      let isOverlap = false;
      while (curr <= end) {
        const dString = curr.toISOString().split('T')[0];
        if (bookedDates[dString] && bookedDates[dString].disabled) {
          isOverlap = true;
          break;
        }
        curr.setDate(curr.getDate() + 1);
      }
      
      if (isOverlap) {
        setErrorMsg('The selected date range overlaps with an existing reservation.');
        return;
      }
      
      setErrorMsg('');
      if (selectedDate > currentStart) {
        setEndDate(day.dateString);
      } else {
        setStartDate(day.dateString);
      }
    }
  };

  const getMarkedDates = () => {
    let marked = { ...bookedDates };
    
    if (startDate && marked[startDate]?.disabled) {
      // Emergency fallback if they bypass the touch layer
      return marked;
    }

    if (startDate) {
      marked[startDate] = { ...marked[startDate], selected: true, color: '#00162C', startingDay: true };
    }
    if (endDate) {
      let curr = new Date(startDate);
      const end = new Date(endDate);
      curr.setDate(curr.getDate() + 1);
      while (curr < end) {
        const dateString = curr.toISOString().split('T')[0];
        if (!marked[dateString]?.disabled) {
          marked[dateString] = { color: '#00162C', opacity: 0.5 };
        }
        curr.setDate(curr.getDate() + 1);
      }
      if (!marked[endDate]?.disabled) {
        marked[endDate] = { ...marked[endDate], selected: true, color: '#00162C', endingDay: true };
      }
    }
    return marked;
  };

  
  const handleSubmit = async () => {
    if (globalBookingLock) return;
    
    if (!fullName || !startDate || !endDate || !totalPrice) {
      setErrorMsg('Please fill in all required fields (Name, Dates, Car, and Price).');
      return;
    }

    setErrorMsg('');
    globalBookingLock = true;
    setLoading(true);

    const localToday = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
    if (startDate < localToday) {
      setErrorMsg('Reservations cannot start in the past.');
      setLoading(false);
      setTimeout(() => { globalBookingLock = false; }, 1000);
      return;
    }

    try {
      // 0. Double-check for overlapping bookings in the database
      let overlappingBookings: any[] = [];
      if (selectedCar) {
        const { data: ob, error: overlapErr } = await supabase
          .from('bookings')
          .select('id')
          .eq('car_id', selectedCar.id)
          .in('status', ['active', 'pending', 'confirmed'])
          .lte('start_date', endDate)
          .gte('end_date', startDate);
          
  
        overlappingBookings = ob || [];
      }
        

      
      if (overlappingBookings && overlappingBookings.length > 0) {
        setErrorMsg('This vehicle is already booked during the selected dates. Please choose different dates.');
        setLoading(false);
        return;
      }
      
      let finalCustId = selectedCustomer?.id;

      // 1. Create or Update Customer
      if (!finalCustId) {
        const { data: newCust, error: custErr } = await supabase
          .from('customers')
          .insert([{ tenant_id: tenantId, full_name: fullName, phone, email, address }])
          .select()
          .single();
        if (custErr) throw custErr;
        finalCustId = newCust.id;
      } else {
        // Update existing customer info if changed
        await supabase
          .from('customers')
          .update({ full_name: fullName, phone, email, address })
          .eq('id', finalCustId);
      }

      // 2. Upload ID Document if new one is selected
      let finalIdUrl = existingIdUrl;
      if (idDocument) {
        const uploadedUrl = await uploadIdDocument(idDocument, finalCustId);
        if (uploadedUrl) {
          finalIdUrl = uploadedUrl;
          await supabase.from('customers').update({ id_document_url: finalIdUrl }).eq('id', finalCustId);
        }
      }

      // 3. Create Booking
      const payload: any = {
        tenant_id: tenantId,
        customer_id: finalCustId,
        start_date: startDate,
        end_date: endDate,
        total_amount: parseFloat(totalPrice),
        status: bookingStatus,
        comments: comments,
        requested_model: requestedModel || (selectedCar ? `${selectedCar.make} ${selectedCar.model}` : null)
      };
      if (selectedCar) {
        payload.car_id = selectedCar.id;
      }
      
      const { data: bookingData, error: bookErr } = await supabase
        .from('bookings')
        .insert([payload])
        .select()
        .single();
        
      if (bookErr) throw bookErr;

      // 4. Log Advance Payment
      if (advancePayment && parseFloat(advancePayment) > 0) {
        const { error: payErr } = await supabase
          .from('payments')
          .insert([{
            tenant_id: tenantId,
            booking_id: bookingData.id,
            amount: parseFloat(advancePayment),
            method: 'card' // default for now
          }]);
        if (payErr) throw payErr;
      }

      // 5. Update Car Status
      if (selectedCar && bookingStatus === 'confirmed') {
        await supabase.from('cars').update({ status: 'rented' }).eq('id', selectedCar.id);
      }

      setSuccessMsg('Booking successfully registered! Redirecting...');
      setTimeout(() => {
        if (router.canGoBack()) { router.canGoBack() ? router.back() : router.replace("/(tenant-admin)"); } else { router.replace("/(tenant-admin)"); }
      }, 2000);

    } catch (error: any) {
      setErrorMsg(error.message || 'An unknown error occurred.');
    } finally {
      setLoading(false);
      setTimeout(() => { globalBookingLock = false; }, 1000);
    }
  };

  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return dateStr;
  };

  return (
    <ScrollView className="flex-1 bg-[#FAFAFA] p-8" contentContainerStyle={{ paddingBottom: 120 }}>
      <View className="flex-row justify-between items-center mb-8">
        <View>
          <Text className="text-2xl font-bold text-primary">New Reservation</Text>
          <Text className="text-sm text-secondary/60 mt-1">Register customer details and confirm dates.</Text>
        </View>
        <TouchableOpacity 
          className="bg-white border border-gray-200 px-4 py-2 rounded-lg shadow-sm"
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(tenant-admin)")}
        >
          <Text className="text-secondary/70 font-semibold text-sm">Cancel</Text>
        </TouchableOpacity>
      </View>
      
      <View className="bg-white p-8 rounded-2xl shadow-sm shadow-gray-200/50 border border-gray-100 max-w-4xl self-center w-full">
        
        {errorMsg ? (
          <View className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl items-center">
            <Text className="text-red-700 font-bold text-lg mb-1">⚠️ Error</Text>
            <Text className="text-red-600">{errorMsg}</Text>
          </View>
        ) : null}
        
        {successMsg ? (
          <View className="mb-8 p-4 bg-emerald-50 border border-emerald-200 rounded-xl items-center">
            <Text className="text-emerald-700 font-bold text-lg mb-1">🎉 Success!</Text>
            <Text className="text-emerald-600">{successMsg}</Text>
          </View>
        ) : null}
        
        {/* Section 1: Customer */}
        <View className="flex-row justify-between items-end mb-4">
          <Text className="text-xs font-bold text-primary/70 uppercase tracking-widest">1. Customer Profile</Text>
          {selectedCustomer && (
            <TouchableOpacity onPress={clearCustomerSelection}>
              <Text className="text-xs text-red-500 font-bold">Clear Selection</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {!selectedCustomer && (
          <View className="mb-6 relative z-50">
            <Text className="text-xs font-bold text-secondary mb-2">SEARCH EXISTING CUSTOMER</Text>
            <TextInput 
              className="bg-primary/5 border border-primary/10 rounded-xl px-4 py-3 text-primary font-medium"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchResults.length > 0 && (
              <View className="absolute top-[70px] left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-48">
                <ScrollView>
                  {searchResults.map(cust => (
                    <TouchableOpacity 
                      key={cust.id} 
                      className="p-4 border-b border-gray-100 flex-row justify-between items-center"
                      onPress={() => selectCustomer(cust)}
                    >
                      <View>
                        <Text className="font-bold text-primary">{cust.full_name}</Text>
                        <Text className="text-xs text-secondary/60">{cust.phone}</Text>
                      </View>
                      <Text className="text-xs text-blue-500 font-bold">Select</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        <View className="flex-col md:flex-row mb-4 space-y-4 md:space-y-0 md:space-x-4">
          <View className="flex-1">
            <Text className="text-xs font-bold text-secondary mb-2">FULL NAME *</Text>
            <TextInput 
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary font-medium"
              placeholder="Customer's full name"
              value={fullName}
              onChangeText={setFullName}
            />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-bold text-secondary mb-2">PHONE NUMBER *</Text>
            <TextInput 
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary font-medium"
              placeholder="Phone number"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>
                  <View className="flex-[1.5]">
            <Text className="text-xs font-bold text-secondary mb-2">HOME/OFFICE ADDRESS</Text>
            <TextInput 
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary font-medium"
              placeholder="Full address..."
              value={address}
              onChangeText={setAddress}
            />
          </View>
        </View>

        <View className="flex-col md:flex-row mb-8 space-y-4 md:space-y-0 md:space-x-4">
          <View className="flex-1">
            <Text className="text-xs font-bold text-secondary mb-2">EMAIL ADDRESS</Text>
            <TextInput 
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary font-medium"
              placeholder="Optional email..."
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-bold text-secondary mb-2">IDENTITY PROOF (IMAGE)</Text>
            <TouchableOpacity 
              className="bg-gray-50 border border-dashed border-gray-300 rounded-xl px-4 py-3 items-center flex-row justify-center space-x-2"
              onPress={pickIdDocument}
            >
              <Text>📄</Text>
              <Text className="text-primary font-medium text-xs">
                {idDocument ? idDocument.name : existingIdUrl ? 'Identity Proof Uploaded (Tap to replace)' : 'Upload ID Image'}
              </Text>
            </TouchableOpacity>
            {existingIdUrl && !idDocument && (
              <TouchableOpacity onPress={() => window.open(existingIdUrl, '_blank')} className="mt-2">
                <Text className="text-blue-500 text-[10px] font-bold text-right">View Current ID</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>


        {/* Section: Booking Type & Status */}
        <Text className="text-xs font-bold text-primary/70 uppercase tracking-widest mb-4 border-t border-gray-100 pt-8">
          Booking Classification
        </Text>
        
        <View className="flex-col md:flex-row mb-6 space-y-4 md:space-y-0 md:space-x-4">
          <View className="flex-1">
            <Text className="text-xs font-bold text-secondary mb-2">BOOKING STATUS *</Text>
            <View className="flex-row rounded-xl overflow-hidden border border-gray-200">
              <TouchableOpacity 
                className={`flex-1 py-3 items-center ${bookingStatus === 'enquiry' ? 'bg-amber-100' : 'bg-gray-50'}`}
                onPress={() => setBookingStatus('enquiry')}
              >
                <Text className={`font-bold text-sm ${bookingStatus === 'enquiry' ? 'text-amber-800' : 'text-gray-400'}`}>Enquiry</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className={`flex-1 py-3 items-center border-l border-gray-200 ${bookingStatus === 'confirmed' ? 'bg-emerald-100' : 'bg-gray-50'}`}
                onPress={() => setBookingStatus('confirmed')}
              >
                <Text className={`font-bold text-sm ${bookingStatus === 'confirmed' ? 'text-emerald-800' : 'text-gray-400'}`}>Confirmed</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View className="flex-1">
            <Text className="text-xs font-bold text-secondary mb-2">REQUESTED MODEL (From Fleet)</Text>
            {selectedCar ? (
               <View className="bg-gray-100 border border-gray-200 rounded-xl px-4 py-3">
                 <Text className="text-primary font-medium opacity-50">Locked to: {selectedCar.make} {selectedCar.model}</Text>
               </View>
            ) : (
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {availableModels.map(m => (
                  <TouchableOpacity 
                    key={m} 
                    onPress={() => setRequestedModel(m === requestedModel ? '' : m)}
                    className={`px-3 py-2 rounded-lg border shadow-sm ${requestedModel === m ? 'bg-primary border-primary' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                  >
                    <Text className={`text-xs font-bold ${requestedModel === m ? 'text-white' : 'text-secondary/70'}`}>{m}</Text>
                  </TouchableOpacity>
                ))}
                {availableModels.length === 0 && (
                  <Text className="text-xs text-gray-400 italic py-2">Loading fleet models...</Text>
                )}
              </View>
            )}
          </View>
        </View>
        
        <View className="mb-6">
          <Text className="text-xs font-bold text-secondary mb-2">CUSTOMER PREFERENCES / NOTES</Text>
          <TextInput 
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary font-medium min-h-[80px]"
            placeholder="e.g. Flight arrives at 3am, prefers the black one..."
            multiline={true}
            value={comments}
            onChangeText={setComments}
          />
        </View>

        {/* Section 2: Reservation */}
        <Text className="text-xs font-bold text-primary/70 uppercase tracking-widest mb-4 border-t border-gray-100 pt-8">
          2. Reservation Specifications
        </Text>
        
        {selectedCar && (
          <View className="mb-6 p-4 bg-primary/5 border border-primary/10 rounded-xl flex-row justify-between items-center">
            <View>
              <Text className="text-[10px] font-bold text-primary/50 uppercase">Selected Vehicle</Text>
              <Text className="font-bold text-primary text-lg">{selectedCar.make} {selectedCar.model}</Text>
              <Text className="text-xs text-secondary/70">{selectedCar.license_plate}</Text>
            </View>
            <View className="bg-white px-3 py-1 rounded shadow-sm border border-gray-100">
              <Text className="text-xs font-bold text-primary">₹{selectedCar.daily_rate}/day</Text>
            </View>
          </View>
        )}

        <View className="mb-6 border border-gray-200 rounded-xl overflow-hidden">
          <Calendar
            minDate={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]}
            markingType={'period'}
            markedDates={getMarkedDates()}
            onDayPress={onDayPress}
            theme={{
              backgroundColor: '#ffffff',
              calendarBackground: '#ffffff',
              textSectionTitleColor: '#b6c1cd',
              selectedDayBackgroundColor: '#00162C',
              selectedDayTextColor: '#ffffff',
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

        <View className="mb-8 items-center bg-blue-50 p-4 rounded-xl border border-blue-100 relative">
          <Text className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Confirmed Dates</Text>
          {startDate ? (
            <View className="items-center">
              <Text className="text-blue-900 font-bold text-lg mb-2">
                {formatDateLabel(startDate)} {endDate ? `  →  ${formatDateLabel(endDate)}` : ''}
              </Text>
              <TouchableOpacity 
                onPress={() => { setStartDate(''); setEndDate(''); setErrorMsg(''); }}
                className="bg-white border border-blue-200 px-3 py-1 rounded-full shadow-sm"
              >
                <Text className="text-[10px] font-bold text-blue-500">Clear Calendar Selection</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text className="text-blue-900/50 font-medium italic">Please select start and end dates from the calendar above.</Text>
          )}
        </View>

        <View className="flex-col md:flex-row mb-8 space-y-4 md:space-y-0 md:space-x-4">
          <View className="flex-1">
            <Text className="text-xs font-bold text-secondary mb-2">CUSTOM TOTAL PRICE (₹) *</Text>
            <TextInput 
              className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-emerald-900 font-bold"
              placeholder="e.g. 10000"
              keyboardType="numeric"
              value={totalPrice}
              onChangeText={setTotalPrice}
            />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-bold text-secondary mb-2">ADVANCE PAYMENT RECEIVED (₹)</Text>
            <TextInput 
              className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-blue-900 font-bold"
              placeholder="e.g. 2000"
              keyboardType="numeric"
              value={advancePayment}
              onChangeText={setAdvancePayment}
            />
          </View>
        </View>

        {errorMsg ? (
          <View className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl items-center">
            <Text className="text-red-700 font-bold text-lg mb-1">⚠️ Error</Text>
            <Text className="text-red-600">{errorMsg}</Text>
          </View>
        ) : null}

        {successMsg ? (
          <View className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl items-center">
            <Text className="text-emerald-700 font-bold text-lg mb-1">🎉 Success!</Text>
            <Text className="text-emerald-600">{successMsg}</Text>
          </View>
        ) : null}

        <View className="border-t border-gray-100 pt-6 flex-row justify-between items-center">
          <View>
            <Text className="text-[10px] text-secondary/50 font-bold uppercase tracking-widest">Balance Remaining</Text>
            <Text className="text-xl font-black text-amber-600">
              ₹{(parseFloat(totalPrice || '0') - parseFloat(advancePayment || '0')).toFixed(2)}
            </Text>
          </View>

          <TouchableOpacity 
            className="bg-primary px-8 py-4 rounded-xl flex-row items-center shadow-md shadow-primary/30"
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold tracking-wide">SUBMIT</Text>
            )}
          </TouchableOpacity>
        </View>

      </View>
    </ScrollView>
  );
}
