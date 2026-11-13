import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getMyViewings, OwnerViewing, updateViewing } from '../services/api';
import { AccountDeletionScreen } from './AccountDeletionScreen';

type Props={onClose:()=>void;phone:string;onDeleted:()=>void};
export function TenantDashboard({onClose,phone,onDeleted}:Props){
 const [items,setItems]=useState<OwnerViewing[]>([]);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [deletionVisible,setDeletionVisible]=useState(false);
 const refresh=useCallback(async()=>{setError('');try{setItems(await getMyViewings());}catch(e){setError(e instanceof Error?e.message:'Could not load your viewing requests.');}},[]);
 useEffect(()=>{void refresh();},[refresh]);
 async function cancel(item:OwnerViewing){setBusy(true);setError('');try{await updateViewing(item.id,'CANCELLED');await refresh();}catch(e){setError(e instanceof Error?e.message:'Could not cancel request.');}finally{setBusy(false);}}
 return <><View style={styles.overlay}><View style={styles.panel}><View style={styles.header}><View><Text style={styles.title}>My viewing requests</Text><Text style={styles.subtitle}>Track appointments with property owners</Text></View><Pressable onPress={onClose}><Text style={styles.close}>✕</Text></Pressable></View>
  <ScrollView contentContainerStyle={{paddingBottom:30}}>
   <Pressable onPress={refresh} style={styles.refresh}><Text style={styles.refreshText}>Refresh</Text></Pressable>
   <Pressable onPress={()=>setDeletionVisible(true)} style={styles.deleteAccount}><Text style={styles.deleteAccountText}>Account settings & privacy</Text></Pressable>
   {!!error&&<Text style={styles.error}>{error}</Text>}
   {items.length===0&&<Text style={styles.empty}>You have not requested a viewing yet.</Text>}
   {items.map(item=><View key={item.id} style={styles.card}><Text style={styles.cardTitle}>{item.property.title}</Text><Text style={styles.meta}>{item.property.district}, {item.property.sector}</Text><Text style={styles.meta}>Preferred: {new Date(item.preferredAt).toLocaleString()}</Text><Text style={styles.status}>Status: {item.status}</Text>
    {item.status==='ACCEPTED'&&<View style={styles.contact}><Text style={styles.contactTitle}>Owner contact</Text><Text style={styles.contactText}>{item.property.owner.fullName}</Text><Text style={styles.contactText}>{item.property.owner.phone}</Text></View>}
    {item.status==='REQUESTED'&&<Text style={styles.hint}>Waiting for the owner to respond.</Text>}
    {(item.status==='REQUESTED'||item.status==='ACCEPTED')&&<Pressable disabled={busy} onPress={()=>cancel(item)} style={styles.cancel}><Text style={styles.cancelText}>Cancel request</Text></Pressable>}
   </View>)}
  </ScrollView>
 </View></View>{deletionVisible&&<AccountDeletionScreen phone={phone} onClose={()=>setDeletionVisible(false)} onDeleted={onDeleted}/>}</>;
}
const styles=StyleSheet.create({overlay:{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:30,backgroundColor:'#F3F6FA'},panel:{flex:1,paddingTop:45,paddingHorizontal:18},header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingBottom:18},title:{fontSize:22,fontWeight:'900',color:'#102A43'},subtitle:{fontSize:11,color:'#718096',marginTop:3},close:{fontSize:20,color:'#718096',padding:8},refresh:{alignSelf:'flex-end',backgroundColor:'#EAF3FC',padding:9,borderRadius:8},refreshText:{fontSize:11,fontWeight:'800',color:'#1565C0'},deleteAccount:{alignSelf:'flex-start',padding:8,marginTop:8},deleteAccountText:{fontSize:10,fontWeight:'800',color:'#C53030'},empty:{fontSize:12,color:'#718096',padding:12},card:{backgroundColor:'#FFFFFF',borderRadius:13,padding:14,marginBottom:11,borderWidth:1,borderColor:'#E2E8F0'},cardTitle:{fontSize:14,fontWeight:'900',color:'#102A43'},meta:{fontSize:10,color:'#627D98',marginTop:6},status:{fontSize:11,fontWeight:'800',color:'#1565C0',marginTop:8},contact:{backgroundColor:'#EAF3FC',padding:10,borderRadius:9,marginTop:10},contactTitle:{fontSize:10,fontWeight:'900',color:'#1565C0'},contactText:{fontSize:11,color:'#334E68',marginTop:4},hint:{fontSize:10,color:'#718096',marginTop:8},cancel:{alignSelf:'flex-start',backgroundColor:'#FFF5F5',padding:9,borderRadius:8,marginTop:10},cancelText:{fontSize:10,fontWeight:'800',color:'#C53030'},error:{fontSize:12,color:'#C53030',marginBottom:10}});
