import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { createViewingRequest } from '../services/api';

type Props = { propertyId: string; onClose: () => void; onSubmitted: () => void };
function localDefaultDate() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setHours(10, 0, 0, 0);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export function ViewingRequestForm({ propertyId, onClose, onSubmitted }: Props) {
  const [preferredAt, setPreferredAt] = useState(localDefaultDate());
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit() {
    setError('');
    const date = new Date(preferredAt);
    if (Number.isNaN(date.getTime()) || date <= new Date()) { setError('Choose a valid future date and time.'); return; }
    setBusy(true);
    try { await createViewingRequest({ propertyId, preferredAt: date.toISOString(), ...(message.trim() ? { message: message.trim() } : {}) }); onSubmitted(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not send your viewing request.'); }
    finally { setBusy(false); }
  }
  return <View style={styles.overlay}><View style={styles.panel}>
    <View style={styles.header}><Text style={styles.title}>Request a viewing</Text><Pressable onPress={onClose}><Text style={styles.close}>✕</Text></Pressable></View>
    <Text style={styles.copy}>Choose a date and time that works for you. The property owner will confirm or decline.</Text>
    <Text style={styles.label}>Preferred date and time</Text><TextInput value={preferredAt} onChangeText={setPreferredAt} placeholder="YYYY-MM-DDTHH:mm" style={styles.input} />
    <Text style={styles.hint}>Use local time, for example 2026-11-20T10:30</Text>
    <Text style={styles.label}>Message (optional)</Text><TextInput value={message} onChangeText={setMessage} placeholder="Add a short message to the landlord" multiline style={[styles.input,styles.multiline]} />
    {!!error && <Text style={styles.error}>{error}</Text>}
    <Pressable onPress={submit} disabled={busy} style={styles.button}>{busy ? <ActivityIndicator color="#FFFFFF"/> : <Text style={styles.buttonText}>Send viewing request</Text>}</Pressable>
  </View></View>;
}
const styles=StyleSheet.create({overlay:{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:25,backgroundColor:'rgba(8,25,45,0.6)',justifyContent:'flex-end'},panel:{backgroundColor:'#FFFFFF',borderTopLeftRadius:24,borderTopRightRadius:24,padding:22},header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},title:{fontSize:22,fontWeight:'900',color:'#102A43'},close:{fontSize:20,color:'#718096',padding:8},copy:{fontSize:12,lineHeight:19,color:'#627D98',marginTop:9,marginBottom:10},label:{fontSize:12,fontWeight:'800',color:'#334E68',marginTop:14,marginBottom:7},input:{borderWidth:1,borderColor:'#D9E2EC',borderRadius:10,padding:12,fontSize:13,color:'#102A43'},hint:{fontSize:10,color:'#829AB1',marginTop:5},multiline:{height:86,textAlignVertical:'top'},button:{height:50,backgroundColor:'#1976D2',borderRadius:12,alignItems:'center',justifyContent:'center',marginTop:20},buttonText:{color:'#FFFFFF',fontWeight:'900',fontSize:13},error:{fontSize:12,color:'#C53030',marginTop:10}});
