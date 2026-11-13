import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ApiProperty, getMyProperties, getMyVerification, MyVerification, submitIdentityVerification, submitPropertyVerification, uploadVerificationDocument } from '../services/api';

type Props = { onClose: () => void };
type SelectedImage = { uri: string; mimeType: 'image/jpeg' | 'image/png' };

const identityTypes = ['NATIONAL_ID', 'PASSPORT', 'RESIDENCE_PERMIT'] as const;
const propertyTypes = ['LAND_TITLE', 'LEASE_AUTHORIZATION', 'OWNER_CONSENT', 'AGENT_MANDATE'] as const;

async function chooseDocument(): Promise<SelectedImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Photo access required', 'Allow photo access to select a clear image of your verification document.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: false });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, mimeType: asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg' };
}

export function VerificationCenter({ onClose }: Props) {
  const [properties, setProperties] = useState<ApiProperty[]>([]);
  const [verification, setVerification] = useState<MyVerification | null>(null);
  const [legalName, setLegalName] = useState('');
  const [documentLast4, setDocumentLast4] = useState('');
  const [identityTypeIndex, setIdentityTypeIndex] = useState(0);
  const [identityImage, setIdentityImage] = useState<SelectedImage | null>(null);
  const [propertyImages, setPropertyImages] = useState<Record<string, SelectedImage>>({});
  const [propertyTypesById, setPropertyTypesById] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    const [mine, listings] = await Promise.all([getMyVerification(), getMyProperties()]);
    setVerification(mine);
    setProperties(listings);
  }
  useEffect(() => { void refresh().catch(e => setError(e instanceof Error ? e.message : 'Could not load verification status.')); }, []);

  async function submitIdentity() {
    if (!legalName.trim() || !/^[0-9]{4}$/.test(documentLast4) || !identityImage) {
      setError('Enter your legal name, last four document digits and select a clear document image.');
      return;
    }
    setBusy(true); setError('');
    try {
      const evidenceObjectKey = await uploadVerificationDocument(identityImage.uri, identityImage.mimeType, 'IDENTITY');
      await submitIdentityVerification({ legalName: legalName.trim(), documentType: identityTypes[identityTypeIndex], documentLast4, evidenceObjectKey });
      await refresh();
      setIdentityImage(null);
      Alert.alert('Submitted', 'Your identity documents are securely submitted for administrator review.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Identity verification submission failed.'); }
    finally { setBusy(false); }
  }

  async function submitProperty(item: ApiProperty) {
    const selectedImage = propertyImages[item.id];
    if (!selectedImage || !confirmed[item.id]) {
      setError('Select a supporting document and confirm that you own the property or are authorized to rent it.');
      return;
    }
    setBusy(true); setError('');
    try {
      const evidenceObjectKey = await uploadVerificationDocument(selectedImage.uri, selectedImage.mimeType, 'PROPERTY');
      const documentType = (propertyTypesById[item.id] || 'LAND_TITLE') as typeof propertyTypes[number];
      await submitPropertyVerification(item.id, { documentType, authorizationConfirmed: true, evidenceObjectKey });
      await refresh();
      setPropertyImages(current => { const next = { ...current }; delete next[item.id]; return next; });
      Alert.alert('Submitted', 'Property authority documents are securely submitted for administrator review.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Property verification submission failed.'); }
    finally { setBusy(false); }
  }

  const identityStatus = verification?.identity;
  return <View style={styles.overlay}><View style={styles.panel}>
    <View style={styles.header}><View><Text style={styles.title}>Verification centre</Text><Text style={styles.subtitle}>Secure identity and property checks</Text></View><Pressable onPress={onClose}><Text style={styles.close}>✕</Text></Pressable></View>
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.notice}><Text style={styles.noticeTitle}>Why verification matters</Text><Text style={styles.body}>A verified badge is issued only after an administrator checks identity and evidence that the landlord or agent is authorized to rent the property. Never send money before independently confirming the property and agreement.</Text></View>
      <Text style={styles.section}>Landlord / agent identity</Text>
      {identityStatus && <View style={styles.statusCard}><Text style={styles.status}>Status: {identityStatus.status}</Text><Text style={styles.meta}>Submitted {new Date(identityStatus.submittedAt).toLocaleDateString()} · {identityStatus.documentType} ending {identityStatus.documentLast4}</Text>{!!identityStatus.rejectionReason && <Text style={styles.error}>{identityStatus.rejectionReason}</Text>}</View>}
      <TextInput value={legalName} onChangeText={setLegalName} placeholder="Full legal name as shown on ID" style={styles.input}/>
      <Pressable onPress={() => setIdentityTypeIndex(index => (index + 1) % identityTypes.length)} style={styles.selector}><Text style={styles.selectorText}>Document type: {identityTypes[identityTypeIndex].replaceAll('_', ' ')} · Tap to change</Text></Pressable>
      <TextInput value={documentLast4} onChangeText={value => setDocumentLast4(value.replace(/[^0-9]/g, '').slice(0, 4))} keyboardType="number-pad" maxLength={4} placeholder="Last 4 digits of document number" style={styles.input}/>
      <Pressable onPress={async () => setIdentityImage(await chooseDocument())} style={styles.secondary}><Text style={styles.secondaryText}>{identityImage ? 'Change selected identity image' : 'Choose identity document image'}</Text></Pressable>
      {identityImage && <Image source={{ uri: identityImage.uri }} style={styles.preview}/>}
      <Pressable disabled={busy} onPress={submitIdentity} style={styles.primary}><Text style={styles.primaryText}>Submit identity for review</Text></Pressable>

      <Text style={styles.section}>Verify property authority</Text>
      {properties.length === 0 && <Text style={styles.body}>Submit a property listing before requesting property verification.</Text>}
      {properties.map(item => {
        const existing = verification?.properties.find(row => row.property.id === item.id);
        const type = propertyTypesById[item.id] || 'LAND_TITLE';
        return <View key={item.id} style={styles.card}>
          <Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.meta}>{item.district}, {item.sector} · RWF {item.monthlyRentRwf.toLocaleString('en-US')}/month</Text>
          {existing && <Text style={styles.status}>Verification: {existing.status}</Text>}
          {!!existing?.rejectionReason && <Text style={styles.error}>{existing.rejectionReason}</Text>}
          <Pressable onPress={() => setPropertyTypesById(current => ({ ...current, [item.id]: propertyTypes[(propertyTypes.indexOf(type as typeof propertyTypes[number]) + 1) % propertyTypes.length] }))} style={styles.selector}><Text style={styles.selectorText}>Evidence: {type.replaceAll('_', ' ')} · Tap to change</Text></Pressable>
          <Pressable onPress={async () => { const image = await chooseDocument(); if (image) setPropertyImages(current => ({ ...current, [item.id]: image })); }} style={styles.secondary}><Text style={styles.secondaryText}>{propertyImages[item.id] ? 'Change supporting document' : 'Choose property document image'}</Text></Pressable>
          {propertyImages[item.id] && <Image source={{ uri: propertyImages[item.id].uri }} style={styles.preview}/>}
          <Pressable onPress={() => setConfirmed(current => ({ ...current, [item.id]: !current[item.id] }))} style={styles.confirm}><Text style={styles.confirmText}>{confirmed[item.id] ? '☑' : '☐'} I own this property or have authority to rent it</Text></Pressable>
          <Pressable disabled={busy} onPress={() => submitProperty(item)} style={styles.primary}><Text style={styles.primaryText}>Submit property evidence</Text></Pressable>
        </View>;
      })}
      {busy && <ActivityIndicator style={{ marginTop: 18 }} color="#1565C0"/>}
    </ScrollView>
  </View></View>;
}

const styles = StyleSheet.create({
  overlay:{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:40,backgroundColor:'#F3F6FA'},
  panel:{flex:1,paddingTop:45,paddingHorizontal:18},
  header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingBottom:18},
  title:{fontSize:22,fontWeight:'900',color:'#102A43'},subtitle:{fontSize:11,color:'#718096',marginTop:3},close:{fontSize:20,color:'#718096',padding:8},
  section:{fontSize:16,fontWeight:'900',color:'#102A43',marginTop:20,marginBottom:10},
  notice:{backgroundColor:'#EAF3FC',padding:13,borderRadius:12},noticeTitle:{fontSize:12,fontWeight:'900',color:'#174A78'},body:{fontSize:11,lineHeight:17,color:'#52677D',marginTop:6},
  input:{height:44,borderWidth:1,borderColor:'#D9E2EC',borderRadius:9,paddingHorizontal:11,fontSize:12,marginTop:9,backgroundColor:'#FFFFFF',color:'#102A43'},
  selector:{padding:11,borderRadius:9,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#D9E2EC',marginTop:9},selectorText:{fontSize:11,fontWeight:'800',color:'#334E68'},
  secondary:{alignSelf:'flex-start',padding:10,borderRadius:8,backgroundColor:'#EAF3FC',marginTop:10},secondaryText:{fontSize:10,fontWeight:'800',color:'#1565C0'},
  preview:{width:120,height:100,borderRadius:9,marginTop:10,backgroundColor:'#E2E8F0'},
  primary:{backgroundColor:'#1565C0',padding:13,borderRadius:9,alignItems:'center',marginTop:10},primaryText:{fontSize:11,fontWeight:'900',color:'#FFFFFF'},
  card:{backgroundColor:'#FFFFFF',padding:13,borderRadius:12,borderWidth:1,borderColor:'#E2E8F0',marginBottom:12},cardTitle:{fontSize:13,fontWeight:'900',color:'#102A43'},meta:{fontSize:10,color:'#627D98',marginTop:5},status:{fontSize:11,fontWeight:'900',color:'#1565C0',marginTop:8},
  statusCard:{padding:11,backgroundColor:'#FFFFFF',borderRadius:10,marginTop:9},confirm:{marginTop:10,padding:8},confirmText:{fontSize:10,color:'#334E68',fontWeight:'700'},
  error:{fontSize:11,color:'#C53030',marginTop:8}, 
});
