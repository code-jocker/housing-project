import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiProperty, getMyProperties, getMyViewings, OwnerViewing, setPropertyAvailability, updateViewing } from '../services/api';
import { VerificationCenter } from './VerificationCenter';
import { AccountDeletionScreen } from './AccountDeletionScreen';

type Props={onClose:()=>void;phone:string;onDeleted:()=>void};
export function LandlordDashboard({onClose,phone,onDeleted}:Props){
 const [properties,setProperties]=useState<ApiProperty[]>([]);
 const [viewings,setViewings]=useState<OwnerViewing[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [verificationVisible,setVerificationVisible]=useState(false);
 const [deletionVisible,setDeletionVisible]=useState(false);
 const refresh=useCallback(async()=>{setError('');try{const [p,v]=await Promise.all([getMyProperties(),getMyViewings()]);setProperties(p);setViewings(v);}catch(e){setError(e instanceof Error?e.message:'Could not load landlord workspace.');}},[]);
 useEffect(()=>{void refresh();},[refresh]);
 async function availability(item:ApiProperty,available:boolean){setBusy(true);setError('');try{await setPropertyAvailability(item.id,available);await refresh();}catch(e){setError(e instanceof Error?e.message:'Could not update property status.');}finally{setBusy(false);}}
 async function viewing(item:OwnerViewing,status:'ACCEPTED'|'DECLINED'|'COMPLETED'){setBusy(true);setError('');try{await updateViewing(item.id,status);await refresh();}catch(e){setError(e instanceof Error?e.message:'Could not update viewing.');}finally{setBusy(false);}}
 return <><View style={styles.overlay}><View style={styles.panel}>
  <View style={styles.header}><View><Text style={styles.title}>Landlord workspace</Text><Text style={styles.subtitle}>Manage your listings and viewing requests</Text></View><Pressable onPress={onClose}><Text style={styles.close}>✕</Text></Pressable></View>
  <ScrollView contentContainerStyle={{paddingBottom:30}}>
   {!!error&&<Text style={styles.error}>{error}</Text>}
   <Pressable onPress={refresh} style={styles.refresh}><Text style={styles.refreshText}>Refresh</Text></Pressable>
   <Pressable onPress={()=>setVerificationVisible(true)} style={styles.verify}><Text style={styles.verifyText}>Open identity & property verification centre</Text></Pressable>
   <Pressable onPress={()=>setDeletionVisible(true)} style={styles.deleteAccount}><Text style={styles.deleteAccountText}>Delete my account</Text></Pressable>
   <Text style={styles.section}>My properties ({properties.length})</Text>
   {properties.length===0&&<Text style={styles.empty}>You have not submitted a property yet.</Text>}
   {properties.map(item=><View key={item.id} style={styles.card}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.meta}>{item.district}, {item.sector} · RWF {item.monthlyRentRwf.toLocaleString('en-US')}/month</Text><Text style={styles.status}>Status: {item.status}</Text><Text style={styles.meta}>Availability: {item.available?'Available':'Not available'}</Text>
    {item.available?<Pressable disabled={busy} onPress={()=>availability(item,false)} style={styles.secondary}><Text style={styles.secondaryText}>Mark as rented / unavailable</Text></Pressable>:<Pressable disabled={busy} onPress={()=>availability(item,true)} style={styles.secondary}><Text style={styles.secondaryText}>Submit to relist</Text></Pressable>}
   </View>)}
   <Text style={styles.section}>Viewing requests ({viewings.length})</Text>
   {viewings.length===0&&<Text style={styles.empty}>No viewing requests yet.</Text>}
   {viewings.map(item=><View key={item.id} style={styles.card}><Text style={styles.cardTitle}>{item.property.title}</Text><Text style={styles.meta}>Tenant: {item.tenant.fullName} · {item.tenant.phone}</Text><Text style={styles.meta}>Preferred: {new Date(item.preferredAt).toLocaleString()}</Text><Text style={styles.status}>Status: {item.status}</Text>{!!item.message&&<Text style={styles.message}>{item.message}</Text>}
    {item.status==='REQUESTED'&&<View style={styles.buttons}><Pressable disabled={busy} onPress={()=>viewing(item,'ACCEPTED')} style={styles.accept}><Text style={styles.buttonText}>Accept</Text></Pressable><Pressable disabled={busy} onPress={()=>viewing(item,'DECLINED')} style={styles.decline}><Text style={styles.buttonText}>Decline</Text></Pressable></View>}
    {item.status==='ACCEPTED'&&<Pressable disabled={busy} onPress={()=>viewing(item,'COMPLETED')} style={styles.secondary}><Text style={styles.secondaryText}>Mark viewing completed</Text></Pressable>}
   </View>)}
  </ScrollView>
 </View></View>{verificationVisible&&<VerificationCenter onClose={()=>setVerificationVisible(false)}/>}{deletionVisible&&<AccountDeletionScreen phone={phone} onClose={()=>setDeletionVisible(false)} onDeleted={onDeleted}/>}</>;
}
const styles=StyleSheet.create({overlay:{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:30,backgroundColor:'#F3F6FA'},panel:{flex:1,paddingTop:45,paddingHorizontal:18},header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingBottom:18},title:{fontSize:22,fontWeight:'900',color:'#102A43'},subtitle:{fontSize:11,color:'#718096',marginTop:3},close:{fontSize:20,color:'#718096',padding:8},refresh:{alignSelf:'flex-end',backgroundColor:'#EAF3FC',padding:9,borderRadius:8},refreshText:{fontSize:11,fontWeight:'800',color:'#1565C0'},verify:{alignSelf:'stretch',backgroundColor:'#1565C0',padding:12,borderRadius:9,marginTop:10},verifyText:{fontSize:11,fontWeight:'900',color:'#FFFFFF',textAlign:'center'},deleteAccount:{alignSelf:'flex-start',padding:10,marginTop:12},deleteAccountText:{fontSize:10,fontWeight:'800',color:'#C53030'},section:{fontSize:16,fontWeight:'900',color:'#102A43',marginTop:18,marginBottom:10},empty:{fontSize:12,color:'#718096',padding:12},card:{backgroundColor:'#FFFFFF',borderRadius:13,padding:14,marginBottom:11,borderWidth:1,borderColor:'#E2E8F0'},cardTitle:{fontSize:14,fontWeight:'900',color:'#102A43'},meta:{fontSize:10,color:'#627D98',marginTop:5},status:{fontSize:11,fontWeight:'800',color:'#1565C0',marginTop:8},secondary:{alignSelf:'flex-start',backgroundColor:'#EAF3FC',padding:9,borderRadius:8,marginTop:10},secondaryText:{fontSize:10,fontWeight:'800',color:'#1565C0'},buttons:{flexDirection:'row',gap:8,marginTop:10},accept:{backgroundColor:'#198754',padding:10,borderRadius:8},decline:{backgroundColor:'#C53030',padding:10,borderRadius:8},buttonText:{fontSize:10,fontWeight:'900',color:'#FFFFFF'},message:{fontSize:11,color:'#52677D',marginTop:7},error:{fontSize:12,color:'#C53030',marginBottom:10}});
