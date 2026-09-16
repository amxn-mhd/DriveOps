import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
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

export default function OnboardCarScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [tenantId, setTenantId] = useState<string | null>(null);
  
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

  const [customDocs, setCustomDocs] = useState<{ id: string, name: string, file: DocumentPicker.DocumentPickerAsset | null, expiry: string }[]>([]);

  useEffect(() => {
    fetchTenantId();
  }, []);

  const fetchTenantId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
    if (data) setTenantId(data.tenant_id);
  };

  const pickDocument = async (type: keyof typeof documents) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setDocuments(prev => ({ ...prev, [type]: result.assets[0] }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const pickImage = async (type: keyof typeof images) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/*'], copyToCacheDirectory: true });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImages(prev => ({ ...prev, [type]: result.assets[0] }));
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

  const handleOnboard = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    
    if (!make || !model || !year || !licensePlate || !dailyRate || !rcOwnerName) {
      setErrorMsg('Basic fields (Make, Model, Year, Plate, Rate, Owner) are required.');
      return;
    }

    if (!tenantId) {
      setErrorMsg('Tenant configuration error.');
      return;
    }
    
    setLoading(true);
    
    try {
      const formattedPlate = licensePlate.toUpperCase().trim();

      // Upload documents if they exist
      const folderPath = `${tenantId}/${formattedPlate}`;
      
      let rcBookUrl = null, pollutionUrl = null, fitnessUrl = null, insuranceUrl = null, financeDocUrl = null;

      if (documents.rcBook) rcBookUrl = await uploadDocument(documents.rcBook, `${folderPath}/rc_book_${formattedPlate}`);
      if (documents.pollution) pollutionUrl = await uploadDocument(documents.pollution, `${folderPath}/pollution_${formattedPlate}`);
      if (documents.fitness) fitnessUrl = await uploadDocument(documents.fitness, `${folderPath}/fitness_${formattedPlate}`);
      if (documents.insurance) insuranceUrl = await uploadDocument(documents.insurance, `${folderPath}/insurance_${formattedPlate}`);
      if (isFinanced && documents.finance) financeDocUrl = await uploadDocument(documents.finance, `${folderPath}/finance_${formattedPlate}`);

      // Upload Images
      const imgUrls: any = {};
      for (const key of Object.keys(images)) {
        const k = key as keyof typeof images;
        if (images[k]) {
          imgUrls[k] = await uploadDocument(images[k]!, `${folderPath}/img_${k}_${formattedPlate}`);
        }
      }

      // Upload Custom Documents
      let uploadedCustomDocs = [];
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

      const { error } = await supabase
        .from('cars')
        .insert([{ 
          tenant_id: tenantId,
          make,
          model,
          year: parseInt(year),
          license_plate: formattedPlate,
          daily_rate: parseFloat(dailyRate),
          rc_owner_name: rcOwnerName,
          rc_number: formattedPlate, 
          rc_book_url: rcBookUrl,
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
          finance_doc_url: financeDocUrl,
          pollution_cert_url: pollutionUrl,
          pollution_expiry: pollutionExpiry || null,
          pucc_no: puccNo || null,
          fitness_tax_url: fitnessUrl,
          fitness_tax_expiry: fitnessExpiry || null,
          insurance_url: insuranceUrl,
          insurance_expiry: insuranceExpiry || null,
          insurance_company: insuranceCompany || null,
          img_front: imgUrls.front || null,
          img_back: imgUrls.back || null,
          img_left: imgUrls.left || null,
          img_right: imgUrls.right || null,
          img_plate: imgUrls.plate || null,
          img_odo: imgUrls.odo || null,
          img_interior_front: imgUrls.interiorFront || null,
          img_interior_back: imgUrls.interiorBack || null,
          custom_documents: uploadedCustomDocs.length > 0 ? uploadedCustomDocs : []
        }]);

      if (error) throw error;
      
      setSuccessMsg(`Vehicle ${formattedPlate} added to fleet successfully!`);
      
      // Clear form
      setMake(''); setModel(''); setYear(''); setLicensePlate('');
      setDailyRate(''); setRcOwnerName('');
      setChassisNo(''); setEngineNo(''); setRegistrationDate('');
      setFuelType(''); setSeatCapacity(''); setColor(''); setCurrentKms('');
      setIsFinanced(false); setFinanceBank(''); setFinanceAmount(''); setFinanceEmi('');
      setPollutionExpiry(''); setPuccNo('');
      setFitnessExpiry('');
      setInsuranceExpiry(''); setInsuranceCompany('');
      
      setDocuments({ rcBook: null, pollution: null, fitness: null, insurance: null, finance: null });
      setImages({ front: null, back: null, left: null, right: null, plate: null, odo: null, interiorFront: null, interiorBack: null });
      setCustomDocs([]);

    } catch (error: any) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-[#FAFAFA] p-8" contentContainerStyle={{ paddingBottom: 120 }}>
      <View className="mb-8">
        <Text className="text-2xl font-bold text-primary">Register New Vehicle</Text>
        <Text className="text-sm text-secondary/60 mt-1">Add a new car to your fleet registry so it can be searched and booked.</Text>
      </View>
      
      <View className="bg-white p-8 rounded-2xl shadow-sm shadow-gray-200/50 border border-gray-100 max-w-3xl">
        




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
          <View className="flex-[1.5]">
            <Text className="text-xs font-bold text-secondary mb-2">RC OWNER NAME *</Text>
            <TextInput className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary font-medium" placeholder="e.g. John Doe" value={rcOwnerName} onChangeText={setRcOwnerName} />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-bold text-secondary mb-2">CHASSIS NO</Text>
            <TextInput className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary font-medium" placeholder="Chassis No" value={chassisNo} onChangeText={setChassisNo} />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-bold text-secondary mb-2">ENGINE NO</Text>
            <TextInput className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary font-medium" placeholder="Engine No" value={engineNo} onChangeText={setEngineNo} />
          </View>
        </View>
        
        <View className="mb-8">
          <TouchableOpacity 
            className="w-full bg-gray-50 border border-dashed border-gray-300 rounded-xl p-4 items-center"
            onPress={() => pickDocument('rcBook')}
          >
            <Text className="text-xl mb-2">📄</Text>
            <Text className="text-xs font-bold text-secondary mb-1">Upload RC Book</Text>
            <Text className="text-[10px] text-primary/50 text-center">{documents.rcBook ? documents.rcBook.name : 'Tap to upload file (PDF/JPG)'}</Text>
          </TouchableOpacity>
        </View>

        {/* Group 3: Finance Information */}
        <Text className="text-xs font-bold text-primary/70 uppercase tracking-widest mb-4 mt-8">3. Finance Information</Text>
        <View className="flex-row items-center mb-4">
          <TouchableOpacity 
            className={`w-6 h-6 rounded-md border items-center justify-center mr-3 ${isFinanced ? 'bg-primary border-primary' : 'bg-white border-gray-300'}`}
            onPress={() => setIsFinanced(!isFinanced)}
          >
            {isFinanced && <Text className="text-white text-xs">✓</Text>}
          </TouchableOpacity>
          <Text className="text-sm font-bold text-secondary">Is this vehicle financed?</Text>
        </View>

        {isFinanced && (
          <View className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
            <View className="flex-col md:flex-row mb-4 space-y-4 md:space-y-0 md:space-x-4" style={{ gap: 16 }}>
              <View className="flex-1">
                <Text className="text-[10px] font-bold text-secondary mb-1">FINANCE BANK</Text>
                <TextInput className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-primary" placeholder="e.g. HDFC Bank" value={financeBank} onChangeText={setFinanceBank} />
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-bold text-secondary mb-1">LOAN AMOUNT</Text>
                <TextInput className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-primary" placeholder="Amount" keyboardType="numeric" value={financeAmount} onChangeText={setFinanceAmount} />
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-bold text-secondary mb-1">MONTHLY EMI</Text>
                <TextInput className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-primary" placeholder="EMI" keyboardType="numeric" value={financeEmi} onChangeText={setFinanceEmi} />
              </View>
            </View>
            <View>
              <Text className="text-[10px] font-bold text-secondary mb-1">UPLOAD FINANCE DOCUMENT</Text>
              <TouchableOpacity className="bg-white border border-dashed border-gray-300 rounded-lg p-3 items-center" onPress={() => pickDocument('finance')}>
                <Text className="text-[10px] text-primary/50 text-center">{documents.finance ? documents.finance.name : 'Tap to upload'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Group 4: Compliance Certificates */}
        <Text className="text-xs font-bold text-primary/70 uppercase tracking-widest mb-4 mt-8">4. Compliance Certificates</Text>
        
        <View className="flex-col md:flex-row mb-6 space-y-4 md:space-y-0 md:space-x-4" style={{ gap: 16 }}>
          <View className="flex-1">
            <TouchableOpacity 
              className="w-full bg-gray-50 border border-dashed border-gray-300 rounded-xl p-4 items-center mb-2"
              onPress={() => pickDocument('pollution')}
            >
              <Text className="text-xl mb-2">🌿</Text>
              <Text className="text-xs font-bold text-secondary mb-1">Upload Pollution</Text>
              <Text className="text-[10px] text-primary/50 text-center">{documents.pollution ? documents.pollution.name : 'Tap to upload'}</Text>
            </TouchableOpacity>
            <TextInput className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-center mb-2" placeholder="PUCC No" value={puccNo} onChangeText={setPuccNo} />
            <WebDatePicker value={pollutionExpiry} onChange={setPollutionExpiry} placeholder="Expiry Date" />
          </View>

          <View className="flex-1">
            <TouchableOpacity 
              className="w-full bg-gray-50 border border-dashed border-gray-300 rounded-xl p-4 items-center mb-2"
              onPress={() => pickDocument('fitness')}
            >
              <Text className="text-xl mb-2">✅</Text>
              <Text className="text-xs font-bold text-secondary mb-1">Upload Fitness/Tax</Text>
              <Text className="text-[10px] text-primary/50 text-center">{documents.fitness ? documents.fitness.name : 'Tap to upload'}</Text>
            </TouchableOpacity>
            <WebDatePicker value={fitnessExpiry} onChange={setFitnessExpiry} placeholder="Valid UpTo" />
          </View>

          <View className="flex-1">
            <TouchableOpacity 
              className="w-full bg-gray-50 border border-dashed border-gray-300 rounded-xl p-4 items-center mb-2"
              onPress={() => pickDocument('insurance')}
            >
              <Text className="text-xl mb-2">🛡️</Text>
              <Text className="text-xs font-bold text-secondary mb-1">Upload Insurance</Text>
              <Text className="text-[10px] text-primary/50 text-center">{documents.insurance ? documents.insurance.name : 'Tap to upload'}</Text>
            </TouchableOpacity>
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

        {customDocs.map((cDoc, idx) => (
          <View key={cDoc.id} className="mb-6 pt-4 border-t border-gray-100">
            
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xs font-bold text-secondary">CUSTOM DOCUMENT #{idx + 1}</Text>
              <TouchableOpacity 
                className="bg-red-50 px-3 py-1.5 rounded-lg border border-red-100"
                onPress={() => removeCustomDoc(cDoc.id)}
              >
                <Text className="text-[10px] font-bold text-red-600">Remove Document</Text>
              </TouchableOpacity>
            </View>

            <View className="flex-col md:flex-row mb-4 space-y-4 md:space-y-0 md:space-x-4" style={{ gap: 16 }}>
              <View className="flex-[1.5]">
                <Text className="text-xs font-bold text-secondary mb-2">DOCUMENT NAME *</Text>
                <TextInput 
                  className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-primary font-medium"
                  placeholder="e.g. State Taxi Permit"
                  value={cDoc.name}
                  onChangeText={(val) => updateCustomDoc(cDoc.id, 'name', val)}
                />
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
              <Text className="text-xl mb-2">📁</Text>
              <Text className="text-xs font-bold text-secondary mb-1">{cDoc.name ? `Upload ${cDoc.name}` : 'Upload Document'}</Text>
              <Text className="text-[10px] text-primary/50 text-center">
                {cDoc.file ? cDoc.file.name : 'Tap to select file (PDF/JPG)'}
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Group 6: Vehicle Photographs */}
        <Text className="text-xs font-bold text-primary/70 uppercase tracking-widest mb-4 mt-8">6. Vehicle Photographs</Text>
        <Text className="text-xs text-secondary/50 mb-6">Upload clear photos of the vehicle for digital verification and insurance records.</Text>
        
        <View className="flex-row flex-wrap" style={{ gap: 16 }}>
          {[
            { key: 'front', label: 'Front View' },
            { key: 'back', label: 'Back View' },
            { key: 'left', label: 'Left Side' },
            { key: 'right', label: 'Right Side' },
            { key: 'plate', label: 'Number Plate' },
            { key: 'odo', label: 'Odometer (Odo)' },
            { key: 'interiorFront', label: 'Interior (Front)' },
            { key: 'interiorBack', label: 'Interior (Back)' },
          ].map((imgInfo) => (
            <View key={imgInfo.key} className="flex-1 min-w-[150px] mb-4">
              <TouchableOpacity 
                className="w-full bg-gray-50 border border-dashed border-gray-300 rounded-xl p-4 items-center justify-center h-28"
                onPress={() => pickImage(imgInfo.key as keyof typeof images)}
              >
                <Text className="text-xl mb-2">📷</Text>
                <Text className="text-[10px] font-bold text-secondary text-center mb-1">{imgInfo.label}</Text>
                <Text className="text-[9px] text-primary/50 text-center truncate w-full" numberOfLines={1}>
                  {images[imgInfo.key as keyof typeof images] ? images[imgInfo.key as keyof typeof images]?.name : 'Upload'}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {errorMsg ? (
          <View className="bg-red-50 border border-red-200 p-4 rounded-xl mb-6 w-full">
            <Text className="text-red-700 font-bold">Error: {errorMsg}</Text>
          </View>
        ) : null}
        {successMsg ? (
          <View className="bg-emerald-50 border border-emerald-200 p-6 rounded-xl mb-6 w-full items-center">
            <Text className="text-emerald-700 font-bold text-lg mb-2">Success!</Text>
            <Text className="text-emerald-600 mb-6 w-full text-center">{successMsg}</Text>
            <TouchableOpacity 
              className="bg-emerald-600 px-6 py-3 rounded-lg shadow-sm shadow-emerald-200"
              onPress={() => router.push('/(tenant-admin)')}
            >
              <Text className="text-white font-bold tracking-wide">Return to Executive Dashboard</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View className="border-t border-gray-100 pt-6 items-end mt-4">
          <TouchableOpacity 
            className="bg-primary px-8 py-4 rounded-xl flex-row items-center shadow-md shadow-primary/30"
            onPress={handleOnboard}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold tracking-wide">Register Vehicle & Upload Docs</Text>
            )}
          </TouchableOpacity>
        </View>

      </View>
    </ScrollView>
  );
}
