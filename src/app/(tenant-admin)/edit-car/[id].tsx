import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import * as DocumentPicker from 'expo-document-picker';
import * as ImageManipulator from 'expo-image-manipulator';

const WebSelect = ({ value, onChange, options, placeholder }: any) => {
  if (Platform.OS === 'web') {
    return (
      <select 
        value={value} 
        onChange={(e: any) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '12px 16px',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
          color: '#111827',
          outline: 'none',
          fontSize: '14px',
          fontFamily: 'inherit'
        }}
      >
        <option value="" disabled>{placeholder}</option>
        {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  return <TextInput className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary font-medium" placeholder={placeholder} value={value} onChangeText={onChange} />;
};

const WebDatePicker = ({ value, onChange, placeholder }: any) => {
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
          outline: 'none',
          fontSize: '14px',
          fontFamily: 'inherit'
        }}
      />
    );
  }
  return <TextInput className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary font-medium" placeholder={placeholder} value={value} onChangeText={onChange} />;
};

export default function EditCarScreen() {
  const router = useRouter();
  const { id: carId } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [tenantId, setTenantId] = useState('');
  
  // Car Details
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [dailyRate, setDailyRate] = useState('');
  const [rcOwnerName, setRcOwnerName] = useState('');
  
  // Extra Info
  const [chassisNo, setChassisNo] = useState('');
  const [engineNo, setEngineNo] = useState('');
  const [registrationDate, setRegistrationDate] = useState('');
  const [fuelType, setFuelType] = useState('');
  const [seatCapacity, setSeatCapacity] = useState('');
  const [color, setColor] = useState('');
  const [currentKms, setCurrentKms] = useState('');

  // Finance Info
  const [isFinanced, setIsFinanced] = useState(false);
  const [financeBank, setFinanceBank] = useState('');
  const [financeAmount, setFinanceAmount] = useState('');
  const [financeEmi, setFinanceEmi] = useState('');

  // Compliance Info
  const [pollutionExpiry, setPollutionExpiry] = useState('');
  const [puccNo, setPuccNo] = useState('');
  const [fitnessExpiry, setFitnessExpiry] = useState('');
  const [insuranceExpiry, setInsuranceExpiry] = useState('');
  const [insuranceCompany, setInsuranceCompany] = useState('');
  
  // Registration Plate
  const [licensePlate, setLicensePlate] = useState('');

  // Documents
  const [documents, setDocuments] = useState({
    rcBook: null as DocumentPicker.DocumentPickerAsset | null,
    pollution: null as DocumentPicker.DocumentPickerAsset | null,
    fitness: null as DocumentPicker.DocumentPickerAsset | null,
    insurance: null as DocumentPicker.DocumentPickerAsset | null,
    finance: null as DocumentPicker.DocumentPickerAsset | null,
  });

  // Images
  const [images, setImages] = useState({
    front: null as DocumentPicker.DocumentPickerAsset | null,
    back: null as DocumentPicker.DocumentPickerAsset | null,
    left: null as DocumentPicker.DocumentPickerAsset | null,
    right: null as DocumentPicker.DocumentPickerAsset | null,
    plate: null as DocumentPicker.DocumentPickerAsset | null,
    odo: null as DocumentPicker.DocumentPickerAsset | null,
    interiorFront: null as DocumentPicker.DocumentPickerAsset | null,
    interiorBack: null as DocumentPicker.DocumentPickerAsset | null,
  });
  // Existing Uploads State
  const [existingDocs, setExistingDocs] = useState<any>({});
  const [existingImages, setExistingImages] = useState<any>({});

  const [customDocs, setCustomDocs] = useState<{ id: string, name: string, file: DocumentPicker.DocumentPickerAsset | null, expiry: string }[]>([]);
  const [existingCustomDocs, setExistingCustomDocs] = useState<any[]>([]);
  const [clearedFields, setClearedFields] = useState<string[]>([]);

  useEffect(() => {
    fetchTenantId();
    if (carId) {
      fetchCarDetails();
    }
  }, [carId]);

  const fetchTenantId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
    if (data) setTenantId(data.tenant_id);
  };

  const fetchCarDetails = async () => {
    try {
      const { data, error } = await supabase.from('cars').select('*').eq('id', carId).single();
      if (error) throw error;
      if (data) {
        setMake(data.make || '');
        setModel(data.model || '');
        setYear(data.year ? data.year.toString() : '');
        setDailyRate(data.daily_rate ? data.daily_rate.toString() : '');
        setRcOwnerName(data.rc_owner_name || '');
        setLicensePlate(data.license_plate || '');
        
        setChassisNo(data.chassis_no || '');
        setEngineNo(data.engine_no || '');
        setRegistrationDate(data.registration_date || '');
        setFuelType(data.fuel_type || '');
        setSeatCapacity(data.seat_capacity ? data.seat_capacity.toString() : '');
        setColor(data.color || '');
        setCurrentKms(data.current_kms ? data.current_kms.toString() : '');

        setIsFinanced(data.is_financed || false);
        setFinanceBank(data.finance_bank || '');
        setFinanceAmount(data.finance_amount ? data.finance_amount.toString() : '');
        setFinanceEmi(data.finance_emi ? data.finance_emi.toString() : '');

        setPollutionExpiry(data.pollution_expiry || '');
        setPuccNo(data.pucc_no || '');
        setFitnessExpiry(data.fitness_tax_expiry || '');
        setInsuranceExpiry(data.insurance_expiry || '');
        setInsuranceCompany(data.insurance_company || '');
        
        setExistingDocs({
          rcBook: data.rc_book_url,
          pollution: data.pollution_cert_url,
          fitness: data.fitness_tax_url,
          insurance: data.insurance_url,
          finance: data.finance_doc_url,
        });

        setExistingImages({
          front: data.img_front,
          back: data.img_back,
          left: data.img_left,
          right: data.img_right,
          plate: data.img_plate,
          odo: data.img_odo,
          interiorFront: data.img_interior_front,
          interiorBack: data.img_interior_back,
        });
        
        if (data.custom_documents) {
          setExistingCustomDocs(data.custom_documents);
        }
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load vehicle details');
    }
  };

  const handleRemoveDoc = (type: keyof typeof documents, dbField: string) => {
    setDocuments((prev: any) => ({ ...prev, [type]: null }));
    setExistingDocs((prev: any) => ({ ...prev, [type]: null }));
    setClearedFields((prev: any) => [...prev, dbField]);
  };

  const handleRemoveImage = (type: keyof typeof images, dbField: string) => {
    setImages((prev: any) => ({ ...prev, [type]: null }));
    setExistingImages((prev: any) => ({ ...prev, [type]: null }));
    setClearedFields((prev: any) => [...prev, dbField]);
  };

  const pickDocument = async (type: keyof typeof documents) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setDocuments((prev: any) => ({ ...prev, [type]: result.assets[0] }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const pickImage = async (type: keyof typeof images) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/*'], copyToCacheDirectory: true });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImages((prev: any) => ({ ...prev, [type]: result.assets[0] }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addCustomDoc = () => {
    setCustomDocs(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), name: '', file: null, expiry: '' }]);
  };

  const updateCustomDoc = (id: string, field: 'name' | 'expiry', value: string) => {
    setCustomDocs(prev => prev.map(doc => doc.id === id ? { ...doc, [field]: value } : doc));
  };

  const pickCustomDocument = async (id: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setCustomDocs(prev => prev.map(doc => doc.id === id ? { ...doc, file: result.assets[0] } : doc));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const removeCustomDoc = (id: string) => {
    setCustomDocs(prev => prev.filter(doc => doc.id !== id));
  };

  const removeExistingCustomDoc = (idx: number) => {
    setExistingCustomDocs(prev => prev.filter((_, i) => i !== idx));
  };

  const renderDocUpload = (type: keyof typeof documents, dbField: string, icon: string, title: string) => {
    const hasFile = documents[type] || existingDocs[type];
    return (
      <View className="mb-2">
        <TouchableOpacity 
          className="w-full bg-gray-50 border border-dashed border-gray-300 rounded-xl p-4 items-center mb-1"
          onPress={() => pickDocument(type)}
        >
          <Text className="text-xl mb-2">{icon}</Text>
          <Text className="text-xs font-bold text-secondary mb-1">{title}</Text>
          <Text className="text-[10px] text-primary/50 text-center">
            {documents[type] ? documents[type]!.name : (existingDocs[type] ? '✓ Uploaded (Tap to replace)' : 'Tap to upload')}
          </Text>
        </TouchableOpacity>
        {hasFile ? (
          <View className="flex-row justify-center py-1 items-center" style={{ gap: 8 }}>
            {existingDocs[type] && !documents[type] && (
              <TouchableOpacity onPress={() => window.open(existingDocs[type], '_blank')}>
                <Text className="text-blue-500 text-[10px] font-bold">View</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => handleRemoveDoc(type, dbField)}>
              <Text className="text-red-500 text-[10px] font-bold">Remove</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  const renderImageUpload = (type: keyof typeof images, dbField: string, label: string) => {
    const hasFile = images[type] || existingImages[type];
    return (
      <View className="mb-2">
        <TouchableOpacity 
          className="w-full bg-gray-50 border border-dashed border-gray-300 rounded-xl p-4 items-center mb-1"
          onPress={() => pickImage(type)}
        >
          <Text className="text-xl mb-2">📸</Text>
          <Text className="text-[10px] font-bold text-secondary text-center mb-1">{label}</Text>
          <Text className="text-[10px] text-primary/50 text-center">
            {images[type] ? images[type]!.name : (existingImages[type] ? '✓ Uploaded' : 'Tap to upload')}
          </Text>
        </TouchableOpacity>
        {hasFile ? (
          <View className="flex-row justify-center py-1 items-center" style={{ gap: 8 }}>
            {existingImages[type] && !images[type] && (
              <TouchableOpacity onPress={() => window.open(existingImages[type], '_blank')}>
                <Text className="text-blue-500 text-[10px] font-bold">View</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => handleRemoveImage(type, dbField)}>
              <Text className="text-red-500 text-[10px] font-bold">Remove</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  const compressImageWeb = async (uri: string): Promise<string> => {
    return new Promise((resolve, reject) => {
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
        }, 'image/jpeg', 0.6); // Aggressive 60% compression
      };
      img.onerror = () => resolve(uri);
      img.src = uri;
    });
  };

  const uploadDocument = async (file: DocumentPicker.DocumentPickerAsset, path: string) => {
    try {
      let finalUri = file.uri;
      let finalExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
      
      // Compress if it's an image
      if (file.mimeType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp'].includes(finalExt)) {
        try {
          if (Platform.OS === 'web') {
            finalUri = await compressImageWeb(file.uri);
            finalExt = 'jpg';
          } else {
            const manipResult = await ImageManipulator.manipulateAsync(
              file.uri,
              [{ resize: { width: 1200 } }],
              { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
            );
            finalUri = manipResult.uri;
            finalExt = 'jpg';
          }
        } catch (manipError) {
          console.warn("Image compression failed, uploading original:", manipError);
        }
      }

      const response = await fetch(finalUri);
      const blob = await response.blob();
      const filename = `${path}.${finalExt}`;
      
      const { data, error } = await supabase.storage
        .from('vehicle_documents')
        .upload(filename, blob, { upsert: true });

      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage
        .from('vehicle_documents')
        .getPublicUrl(filename);
        
      return publicUrl;
    } catch (error) {
      console.error("Upload failed", error);
      return null;
    }
  };

  const handleUpdate = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    
    if (!make || !model || !year || !licensePlate || !dailyRate || !rcOwnerName) {
      setErrorMsg('Basic fields (Make, Model, Year, Plate, Rate, Owner) are required.');
      return;
    }

    if (!tenantId || !carId) {
      setErrorMsg('Configuration error.');
      return;
    }
    
    setLoading(true);
    
    try {
      const formattedPlate = licensePlate.toUpperCase().trim();
      const folderPath = `${tenantId}/${formattedPlate}`;
      
      let updatePayload: any = {
          make,
          model,
          year: parseInt(year),
          license_plate: formattedPlate,
          daily_rate: parseFloat(dailyRate),
          rc_owner_name: rcOwnerName,
          rc_number: formattedPlate, 
          chassis_no: chassisNo || null,
          engine_no: engineNo || null,
          registration_date: registrationDate || null,
          fuel_type: fuelType || null,
          seat_capacity: seatCapacity ? parseInt(seatCapacity) : null,
          color: color || null,
          current_kms: currentKms ? parseInt(currentKms) : null,
          is_financed: isFinanced,
          finance_bank: isFinanced ? financeBank : null,
          finance_amount: isFinanced && financeAmount ? parseFloat(financeAmount) : null,
          finance_emi: isFinanced && financeEmi ? parseFloat(financeEmi) : null,
          pollution_expiry: pollutionExpiry || null,
          pucc_no: puccNo || null,
          fitness_tax_expiry: fitnessExpiry || null,
          insurance_expiry: insuranceExpiry || null,
          insurance_company: insuranceCompany || null,
      };

      if (documents.rcBook) updatePayload.rc_book_url = await uploadDocument(documents.rcBook, `${folderPath}/rc_book_${formattedPlate}`);
      if (documents.pollution) updatePayload.pollution_cert_url = await uploadDocument(documents.pollution, `${folderPath}/pollution_${formattedPlate}`);
      if (documents.fitness) updatePayload.fitness_tax_url = await uploadDocument(documents.fitness, `${folderPath}/fitness_${formattedPlate}`);
      if (documents.insurance) updatePayload.insurance_url = await uploadDocument(documents.insurance, `${folderPath}/insurance_${formattedPlate}`);
      if (isFinanced && documents.finance) updatePayload.finance_doc_url = await uploadDocument(documents.finance, `${folderPath}/finance_${formattedPlate}`);

      for (const key of Object.keys(images)) {
        const k = key as keyof typeof images;
        if (images[k]) {
          updatePayload[`img_${k}`] = await uploadDocument(images[k]!, `${folderPath}/img_${k}_${formattedPlate}`);
        }
      }

      // Clear out removed fields
      clearedFields.forEach(field => {
        updatePayload[field] = null;
      });

      let uploadedCustomDocs = [...existingCustomDocs];
      for (const cDoc of customDocs) {
        if (cDoc.name && cDoc.file) {
          const safeName = cDoc.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
          const customUrl = await uploadDocument(cDoc.file, `${folderPath}/custom_${safeName}_${formattedPlate}_${cDoc.id}`);
          uploadedCustomDocs.push({
            name: cDoc.name,
            url: customUrl,
            expiry: cDoc.expiry || null
          });
        }
      }
      updatePayload.custom_documents = uploadedCustomDocs;

      const { error } = await supabase
        .from('cars')
        .update(updatePayload)
        .eq('id', carId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
      
      setSuccessMsg(`Vehicle ${formattedPlate} updated successfully!`);

    } catch (error: any) {
      setErrorMsg(error.message || 'An error occurred during update');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="max-w-4xl mx-auto w-full p-6 lg:p-12">
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/(tenant-admin)")} className="mb-6 self-start bg-gray-100 px-4 py-2 rounded-lg">
          <Text className="text-secondary font-bold text-xs">← Back to Profile</Text>
        </TouchableOpacity>

        <View className="mb-10">
          <Text className="text-3xl font-black text-secondary tracking-tight mb-2">Edit Vehicle Details</Text>
          <Text className="text-secondary/60">Update vehicle specifications, compliance documents, and photos.</Text>
        </View>

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
              onPress={() => router.push('/(tenant-admin)')}
            >
              <Text className="text-white font-bold tracking-wide">Return to Executive Dashboard</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <Text className="text-xs font-bold text-primary/70 uppercase tracking-widest mb-4">Vehicle Details</Text>
        
        {/* Group 1: Basic Details */}
        <Text className="text-xs font-bold text-primary/70 uppercase tracking-widest mb-4">1. Vehicle Information</Text>
        <View className="flex-col md:flex-row mb-4 space-y-4 md:space-y-0 md:space-x-4" style={{ gap: 16 }}>
          <View className="flex-1">
            <Text className="text-xs font-bold text-secondary mb-2">MAKE *</Text>
            <TextInput 
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary font-medium"
              placeholder="e.g. Toyota"
              value={make}
              onChangeText={setMake}
            />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-bold text-secondary mb-2">MODEL *</Text>
            <TextInput 
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary font-medium"
              placeholder="e.g. Innova"
              value={model}
              onChangeText={setModel}
            />
          </View>
        </View>

        <View className="flex-col md:flex-row mb-4 space-y-4 md:space-y-0 md:space-x-4" style={{ gap: 16 }}>
          <View className="flex-[0.5]">
            <Text className="text-xs font-bold text-secondary mb-2">YEAR *</Text>
            <WebSelect 
              value={year} 
              onChange={setYear} 
              placeholder="Select Year"
              options={Array.from({ length: 30 }, (_, i) => ({ label: `${new Date().getFullYear() - i}`, value: `${new Date().getFullYear() - i}` }))} 
            />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-bold text-secondary mb-2">DEFAULT DAILY RATE (₹) *</Text>
            <TextInput 
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary font-medium"
              placeholder="e.g. 2500"
              keyboardType="decimal-pad"
              value={dailyRate}
              onChangeText={setDailyRate}
            />
          </View>
        </View>

        <View className="flex-col md:flex-row mb-4 space-y-4 md:space-y-0 md:space-x-4" style={{ gap: 16 }}>
          <View className="flex-1">
            <Text className="text-xs font-bold text-secondary mb-2">FUEL TYPE</Text>
            <WebSelect 
              value={fuelType} 
              onChange={setFuelType} 
              placeholder="Select Fuel Type"
              options={[
                { label: 'Petrol', value: 'Petrol' },
                { label: 'Diesel', value: 'Diesel' },
                { label: 'Electric (EV)', value: 'EV' },
                { label: 'CNG', value: 'CNG' },
                { label: 'Hybrid', value: 'Hybrid' },
              ]}
            />
          </View>
          <View className="flex-[0.8]">
            <Text className="text-xs font-bold text-secondary mb-2">SEATS</Text>
            <TextInput className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary font-medium" placeholder="e.g. 5" keyboardType="number-pad" value={seatCapacity} onChangeText={setSeatCapacity} />
          </View>
          <View className="flex-[0.8]">
            <Text className="text-xs font-bold text-secondary mb-2">COLOR</Text>
            <TextInput className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary font-medium" placeholder="e.g. White" value={color} onChangeText={setColor} />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-bold text-secondary mb-2">CURRENT KMS</Text>
            <TextInput className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary font-medium" placeholder="e.g. 15000" keyboardType="number-pad" value={currentKms} onChangeText={setCurrentKms} />
          </View>
        </View>

        {/* Group 2: Registration & RC Book */}
        <Text className="text-xs font-bold text-primary/70 uppercase tracking-widest mb-4 mt-8">2. Registration & RC Details</Text>
        <View className="flex-col md:flex-row mb-4 space-y-4 md:space-y-0 md:space-x-4" style={{ gap: 16 }}>
          <View className="flex-1">
            <Text className="text-xs font-bold text-secondary mb-2">REGISTRATION PLATE *</Text>
            <TextInput 
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary font-bold"
              placeholder="e.g. KL-50-G-4141"
              autoCapitalize="characters"
              value={licensePlate}
              onChangeText={setLicensePlate}
            />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-bold text-secondary mb-2">REGISTRATION DATE *</Text>
            <WebDatePicker value={registrationDate} onChange={setRegistrationDate} placeholder="Select Date" />
          </View>
        </View>

        <View className="flex-col md:flex-row mb-4 space-y-4 md:space-y-0 md:space-x-4" style={{ gap: 16 }}>
          <View className="flex-1">
            <Text className="text-xs font-bold text-secondary mb-2">CHASSIS NUMBER</Text>
            <TextInput className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary font-medium" placeholder="e.g. MA3EFE..." autoCapitalize="characters" value={chassisNo} onChangeText={setChassisNo} />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-bold text-secondary mb-2">ENGINE NUMBER</Text>
            <TextInput className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary font-medium" placeholder="e.g. K15BN..." autoCapitalize="characters" value={engineNo} onChangeText={setEngineNo} />
          </View>
        </View>

        <View className="flex-col md:flex-row mb-6 space-y-4 md:space-y-0 md:space-x-4" style={{ gap: 16 }}>
          <View className="flex-1">
            <Text className="text-xs font-bold text-secondary mb-2">RC OWNER NAME *</Text>
            <TextInput 
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary font-medium"
              placeholder="Full Name as on RC"
              value={rcOwnerName}
              onChangeText={setRcOwnerName}
            />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-bold text-secondary mb-2">RC BOOK DOCUMENT</Text>
            {renderDocUpload('rcBook', 'rc_book_url', '📄', 'Upload RC Book')}
          </View>
        </View>

        {/* Group 3: Finance Info */}
        <Text className="text-xs font-bold text-primary/70 uppercase tracking-widest mb-4 mt-8">3. Finance Information</Text>
        <View className="mb-6">
          <TouchableOpacity 
            className="flex-row items-center mb-4"
            onPress={() => setIsFinanced(!isFinanced)}
          >
            <View className={`w-5 h-5 rounded border ${isFinanced ? 'bg-primary border-primary' : 'bg-white border-gray-300'} items-center justify-center mr-3`}>
              {isFinanced && <Text className="text-white text-xs font-bold">✓</Text>}
            </View>
            <Text className="text-sm font-bold text-secondary">Vehicle is under finance / loan</Text>
          </TouchableOpacity>

          {isFinanced && (
            <View className="bg-gray-50 border border-gray-100 rounded-xl p-4">
              <View className="flex-col md:flex-row mb-4 space-y-4 md:space-y-0 md:space-x-4" style={{ gap: 16 }}>
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-secondary mb-2">BANK / FINANCIER NAME</Text>
                  <TextInput className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-primary font-medium" placeholder="e.g. HDFC Bank" value={financeBank} onChangeText={setFinanceBank} />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-secondary mb-2">LOAN AMOUNT (₹)</Text>
                  <TextInput className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-primary font-medium" placeholder="e.g. 500000" keyboardType="numeric" value={financeAmount} onChangeText={setFinanceAmount} />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-secondary mb-2">MONTHLY EMI (₹)</Text>
                  <TextInput className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-primary font-medium" placeholder="e.g. 12500" keyboardType="numeric" value={financeEmi} onChangeText={setFinanceEmi} />
                </View>
              </View>
              <View>
                <Text className="text-[10px] font-bold text-secondary mb-2">FINANCE DOCUMENT</Text>
                {renderDocUpload('finance', 'finance_doc_url', '🏦', 'Upload Finance Paper')}
              </View>
            </View>
          )}
        </View>

        {/* Group 4: Compliance Certificates */}
        <Text className="text-xs font-bold text-primary/70 uppercase tracking-widest mb-4 mt-8">4. Compliance Certificates</Text>
        
        <View className="flex-col md:flex-row mb-6 space-y-4 md:space-y-0 md:space-x-4" style={{ gap: 16 }}>
          <View className="flex-1">
            {renderDocUpload('pollution', 'pollution_cert_url', '🌿', 'Upload Pollution')}
            <TextInput className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-center mb-2" placeholder="PUCC No" value={puccNo} onChangeText={setPuccNo} />
            <WebDatePicker value={pollutionExpiry} onChange={setPollutionExpiry} placeholder="Expiry Date" />
          </View>

          <View className="flex-1">
            {renderDocUpload('fitness', 'fitness_tax_url', '✅', 'Upload Fitness/Tax')}
            <WebDatePicker value={fitnessExpiry} onChange={setFitnessExpiry} placeholder="Valid UpTo" />
          </View>

          <View className="flex-1">
            {renderDocUpload('insurance', 'insurance_url', '🛡️', 'Upload Insurance')}
            <TextInput className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-center mb-2" placeholder="Insurance Company" value={insuranceCompany} onChangeText={setInsuranceCompany} />
            <WebDatePicker value={insuranceExpiry} onChange={setInsuranceExpiry} placeholder="Valid UpTo" />
          </View>
        </View>

        {/* Group 5: Dynamic/Custom Documents */}
        <View className="flex-row justify-between items-center mb-4 mt-8">
          <Text className="text-xs font-bold text-primary/70 uppercase tracking-widest">5. Additional Certificates</Text>
          <TouchableOpacity 
            className="bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20"
            onPress={addCustomDoc}
          >
            <Text className="text-[10px] font-bold text-primary">+ Add Custom Form</Text>
          </TouchableOpacity>
        </View>
        <Text className="text-xs text-secondary/50 mb-6">Need to track a Taxi Permit, State Permit, or other specialized documents? Add them dynamically here.</Text>

        {/* Existing Custom Docs */}
        {existingCustomDocs.map((cDoc, idx) => (
          <View key={idx} className="mb-6 pt-4 border-t border-gray-100">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xs font-bold text-secondary">EXISTING DOCUMENT: {cDoc.name}</Text>
              <TouchableOpacity className="bg-red-50 px-3 py-1.5 rounded-lg border border-red-100" onPress={() => removeExistingCustomDoc(idx)}>
                <Text className="text-[10px] font-bold text-red-600">Remove Document</Text>
              </TouchableOpacity>
            </View>
            <View className="flex-col md:flex-row mb-4 space-y-4 md:space-y-0 md:space-x-4" style={{ gap: 16 }}>
              <View className="flex-[1.5]">
                <Text className="text-xs font-bold text-emerald-600">✓ Currently saved in database</Text>
                {cDoc.expiry && <Text className="text-xs text-secondary/70">Expires: {cDoc.expiry}</Text>}
              </View>
            </View>
          </View>
        ))}

        {/* New Custom Docs */}
        {customDocs.map((cDoc, idx) => (
          <View key={cDoc.id} className="mb-6 pt-4 border-t border-gray-100">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xs font-bold text-secondary">NEW CUSTOM DOCUMENT</Text>
              <TouchableOpacity className="bg-red-50 px-3 py-1.5 rounded-lg border border-red-100" onPress={() => removeCustomDoc(cDoc.id)}>
                <Text className="text-[10px] font-bold text-red-600">Cancel</Text>
              </TouchableOpacity>
            </View>
            <View className="flex-col md:flex-row mb-4 space-y-4 md:space-y-0 md:space-x-4" style={{ gap: 16 }}>
              <View className="flex-[1.5]">
                <Text className="text-xs font-bold text-secondary mb-2">DOCUMENT NAME *</Text>
                <TextInput className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary font-medium" placeholder="e.g. State Taxi Permit" value={cDoc.name} onChangeText={(val) => updateCustomDoc(cDoc.id, 'name', val)} />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-secondary mb-2">EXPIRY DATE</Text>
                <WebDatePicker value={cDoc.expiry} onChange={(val: string) => updateCustomDoc(cDoc.id, 'expiry', val)} placeholder="Expiry Date" />
              </View>
            </View>

            <TouchableOpacity 
              className="w-full bg-gray-50 border border-dashed border-gray-300 rounded-xl p-4 items-center"
              onPress={() => pickCustomDocument(cDoc.id)}
            >
              <Text className="text-xl mb-2">📄</Text>
              <Text className="text-xs font-bold text-secondary mb-1">Upload {cDoc.name || 'Document'}</Text>
              <Text className="text-[10px] text-primary/50 text-center">{cDoc.file ? cDoc.file.name : 'Tap to select file'}</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Group 6: Vehicle Photographs */}
        <Text className="text-xs font-bold text-primary/70 uppercase tracking-widest mb-4 mt-8">6. Vehicle Photographs</Text>
        
        <View className="flex-row flex-wrap" style={{ gap: 16 }}>
          <View className="w-[calc(25%-12px)] min-w-[150px]">
            {renderImageUpload('front', 'img_front', 'FRONT VIEW')}
          </View>
          <View className="w-[calc(25%-12px)] min-w-[150px]">
            {renderImageUpload('back', 'img_back', 'BACK VIEW')}
          </View>
          <View className="w-[calc(25%-12px)] min-w-[150px]">
            {renderImageUpload('left', 'img_left', 'LEFT SIDE')}
          </View>
          <View className="w-[calc(25%-12px)] min-w-[150px]">
            {renderImageUpload('right', 'img_right', 'RIGHT SIDE')}
          </View>
          <View className="w-[calc(25%-12px)] min-w-[150px]">
            {renderImageUpload('plate', 'img_plate', 'NUMBER PLATE')}
          </View>
          <View className="w-[calc(25%-12px)] min-w-[150px]">
            {renderImageUpload('odo', 'img_odo', 'ODOMETER')}
          </View>
          <View className="w-[calc(25%-12px)] min-w-[150px]">
            {renderImageUpload('interiorFront', 'img_interior_front', 'INTERIOR (FRONT)')}
          </View>
          <View className="w-[calc(25%-12px)] min-w-[150px]">
            {renderImageUpload('interiorBack', 'img_interior_back', 'INTERIOR (BACK)')}
          </View>
        </View>

        <View className="border-t border-gray-100 pt-6 items-end mt-4">
          <TouchableOpacity 
            className="bg-primary px-8 py-4 rounded-xl flex-row items-center shadow-md shadow-primary/30"
            onPress={handleUpdate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold tracking-wide">Update Vehicle Details</Text>
            )}
          </TouchableOpacity>
        </View>

      </View>
    </ScrollView>
  );
}
