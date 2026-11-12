import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { createProperty, uploadPropertyImage } from '../services/api';
import * as ImagePicker from 'expo-image-picker';

type Props = { onClose: () => void; onCreated: () => void };
const types = ['Apartment','House','Studio','Room','Commercial'] as const;
export function CreateListingForm({ onClose, onCreated }: Props) {
  const [title,setTitle]=useState(''); const [description,setDescription]=useState('');
  const [propertyType,setPropertyType]=useState<typeof types[number]>('Apartment');
  const [district,setDistrict]=useState(''); const [sector,setSector]=useState('');
  const [rent,setRent]=useState(''); const [deposit,setDeposit]=useState('0');
  const [bedrooms,setBedrooms]=useState('1'); const [bathrooms,setBathrooms]=useState('1');
  const [uploadedImages,setUploadedImages]=useState<string[]>([]);
  const [uploading,setUploading]=useState(false);
  const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  async function choosePhotos() {
    setError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setError('Allow photo-library access to add property pictures.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 15 - uploadedImages.length, quality: 0.8 });
    if (result.canceled) return;
    const selected = result.assets.slice(0, 15 - uploadedImages.length);
    const oversized = selected.find(asset => (asset.fileSize || 0) > 10 * 1024 * 1024);
    if (oversized) { setError('Each photo must be 10 MB or smaller.'); return; }
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const asset of selected) uploaded.push(await uploadPropertyImage(asset.uri, asset.mimeType));
      setUploadedImages(current => [...current, ...uploaded]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Photo upload failed. Check Cloudinary configuration.'); }
    finally { setUploading(false); }
  }
  async function submit() {
    setError('');
    const monthlyRentRwf=Number(rent), depositRwf=Number(deposit), bedroomCount=Number(bedrooms), bathroomCount=Number(bathrooms);
    if(title.trim().length<8 || description.trim().length<20 || district.trim().length<2 || sector.trim().length<2 || !Number.isInteger(monthlyRentRwf) || monthlyRentRwf<=0 || !Number.isInteger(depositRwf) || depositRwf<0 || !Number.isInteger(bedroomCount) || bedroomCount<0 || !Number.isInteger(bathroomCount) || bathroomCount<0) {
      setError('Complete the required fields. Rent, deposit and room counts must be valid whole numbers.'); return;
    }
    const images=uploadedImages;
    if (images.length === 0) { setError('Upload at least one clear photo of the property.'); return; }
    setBusy(true);
    try { await createProperty({title:title.trim(),description:description.trim(),propertyType,district:district.trim(),sector:sector.trim(),monthlyRentRwf,depositRwf,bedrooms:bedroomCount,bathrooms:bathroomCount,images}); onCreated(); }
    catch(e) { setError(e instanceof Error?e.message:'Could not submit your listing.'); }
    finally { setBusy(false); }
  }
  return <View style={styles.overlay}><View style={styles.panel}><View style={styles.header}><Text style={styles.title}>List your property</Text><Pressable onPress={onClose}><Text style={styles.close}>✕</Text></Pressable></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:20}}>
      <Text style={styles.copy}>Provide accurate details. New listings are submitted for platform review before appearing publicly.</Text>
      <Text style={styles.label}>Property title</Text><TextInput value={title} onChangeText={setTitle} placeholder="e.g. Two-bedroom apartment in Kicukiro" style={styles.input}/>
      <Text style={styles.label}>Property type</Text><View style={styles.types}>{types.map(type=><Pressable key={type} onPress={()=>setPropertyType(type)} style={[styles.type,propertyType===type&&styles.typeActive]}><Text style={[styles.typeText,propertyType===type&&styles.typeTextActive]}>{type}</Text></Pressable>)}</View>
      <Text style={styles.label}>Description</Text><TextInput value={description} onChangeText={setDescription} placeholder="Describe the property and important details" multiline style={[styles.input,styles.multiline]}/>
      <View style={styles.row}><View style={styles.field}><Text style={styles.label}>District</Text><TextInput value={district} onChangeText={setDistrict} placeholder="Kicukiro" style={styles.input}/></View><View style={styles.field}><Text style={styles.label}>Sector</Text><TextInput value={sector} onChangeText={setSector} placeholder="Niboye" style={styles.input}/></View></View>
      <View style={styles.row}>{[{label:'Monthly rent (RWF)',value:rent,set:setRent},{label:'Deposit (RWF)',value:deposit,set:setDeposit},{label:'Bedrooms',value:bedrooms,set:setBedrooms},{label:'Bathrooms',value:bathrooms,set:setBathrooms}].map(field=><View key={field.label} style={styles.field}><Text style={styles.label}>{field.label}</Text><TextInput value={field.value} onChangeText={field.set} keyboardType="number-pad" style={styles.input}/></View>)}</View>
      <Text style={styles.label}>Property photos ({uploadedImages.length}/15)</Text><Pressable onPress={choosePhotos} disabled={uploading||uploadedImages.length>=15} style={styles.photoButton}>{uploading?<ActivityIndicator color="#1565C0"/>:<Text style={styles.photoButtonText}>Choose and upload photos</Text>}</Pressable><Text style={styles.photoHint}>Use clear photos of the actual property. Maximum 10 MB per image; up to 15 images.</Text>{uploadedImages.map((url,index)=><View key={url} style={styles.imageRow}><Text style={styles.imageName}>Photo {index+1} uploaded</Text><Pressable onPress={()=>setUploadedImages(current=>current.filter(item=>item!==url))}><Text style={styles.remove}>Remove</Text></Pressable></View>)}
      {!!error&&<Text style={styles.error}>{error}</Text>}
      <Pressable onPress={submit} disabled={busy||uploading} style={styles.button}>{busy||uploading?<ActivityIndicator color="#FFFFFF"/>:<Text style={styles.buttonText}>Submit for review</Text>}</Pressable>
    </ScrollView>
  </View></View>;
}
const styles=StyleSheet.create({overlay:{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:25,backgroundColor:'rgba(8,25,45,0.6)',justifyContent:'flex-end'},panel:{backgroundColor:'#FFFFFF',borderTopLeftRadius:24,borderTopRightRadius:24,padding:20,maxHeight:'94%'},header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},title:{fontSize:21,fontWeight:'900',color:'#102A43'},close:{fontSize:20,color:'#718096',padding:8},copy:{fontSize:12,lineHeight:18,color:'#627D98',marginTop:8,marginBottom:5},label:{fontSize:11,fontWeight:'800',color:'#334E68',marginTop:12,marginBottom:6},input:{borderWidth:1,borderColor:'#D9E2EC',borderRadius:9,padding:11,fontSize:12,color:'#102A43'},multiline:{height:82,textAlignVertical:'top'},types:{flexDirection:'row',flexWrap:'wrap',gap:7},type:{borderWidth:1,borderColor:'#D9E2EC',borderRadius:18,paddingVertical:8,paddingHorizontal:11},typeActive:{backgroundColor:'#EAF3FC',borderColor:'#1976D2'},typeText:{fontSize:10,color:'#627D98',fontWeight:'700'},typeTextActive:{color:'#1565C0'},row:{flexDirection:'row',gap:9},field:{flex:1,minWidth:'45%'},photoButton:{padding:13,borderWidth:1,borderColor:'#90CDF4',borderRadius:9,alignItems:'center',backgroundColor:'#EAF3FC'},photoButtonText:{fontSize:11,fontWeight:'800',color:'#1565C0'},photoHint:{fontSize:10,color:'#829AB1',marginTop:5},imageRow:{flexDirection:'row',justifyContent:'space-between',paddingVertical:7,borderBottomWidth:1,borderBottomColor:'#EDF2F7'},imageName:{fontSize:10,color:'#334E68'},remove:{fontSize:10,fontWeight:'800',color:'#C53030'},button:{height:50,backgroundColor:'#1976D2',borderRadius:12,alignItems:'center',justifyContent:'center',marginTop:18},buttonText:{color:'#FFFFFF',fontWeight:'900',fontSize:13},error:{fontSize:12,color:'#C53030',marginTop:10}});
