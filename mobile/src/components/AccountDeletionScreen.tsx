import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { confirmAccountDeletion, getAccountExport, requestAccountDeletion } from '../services/api';

type Props = { phone: string; onClose: () => void; onDeleted: () => void };
export function AccountDeletionScreen({ phone, onClose, onDeleted }: Props) {
  const [code, setCode] = useState('');
  const [debugCode, setDebugCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function exportData() {
    setBusy(true); setMessage('');
    try {
      const data = await getAccountExport();
      await Share.share({ title: 'HousingConnect personal data export', message: JSON.stringify(data, null, 2) });
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not prepare your data export.'); }
    finally { setBusy(false); }
  }

  async function requestCode() {
    setBusy(true); setMessage('');
    try {
      const result = await requestAccountDeletion(phone);
      setMessage(result.message);
      setDebugCode(result.debugCode || '');
      if (result.waitSeconds) setMessage(result.message + ' Wait ' + result.waitSeconds + ' seconds before requesting another code.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not request a deletion code.'); }
    finally { setBusy(false); }
  }

  async function confirm() {
    if (!/^[0-9]{6}$/.test(code)) { setMessage('Enter the six-digit code sent to your phone.'); return; }
    Alert.alert('Permanently delete account?', 'This removes your account, listings, saved properties, viewing requests and verification evidence. This action cannot be undone.', [
      { text: 'Keep my account', style: 'cancel' },
      { text: 'Delete permanently', style: 'destructive', onPress: () => { void performDeletion(); } },
    ]);
  }

  async function performDeletion() {
    setBusy(true); setMessage('');
    try { await confirmAccountDeletion(phone, code); onDeleted(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Account deletion failed.'); }
    finally { setBusy(false); }
  }

  return <View style={styles.overlay}><View style={styles.panel}>
    <View style={styles.header}><Text style={styles.title}>Account deletion</Text><Pressable onPress={onClose}><Text style={styles.close}>✕</Text></Pressable></View>
    <Text style={styles.warning}>This is permanent. Your marketplace profile, listings, favorites, viewing requests, notifications and private verification documents will be removed. Audit records required for platform security may be retained without your account profile.</Text>
    <Text style={styles.phone}>Phone: {phone}</Text>
    <Pressable disabled={busy} onPress={exportData} style={styles.secondary}><Text style={styles.secondaryText}>Export a copy of my data</Text></Pressable>
    <Pressable disabled={busy} onPress={requestCode} style={styles.secondary}><Text style={styles.secondaryText}>Send deletion confirmation code</Text></Pressable>
    {!!message && <Text style={styles.message}>{message}</Text>}
    {!!debugCode && <Text style={styles.debug}>Development OTP: {debugCode}</Text>}
    <TextInput value={code} onChangeText={value => setCode(value.replace(/[^0-9]/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} placeholder="6-digit confirmation code" style={styles.input}/>
    <Pressable disabled={busy} onPress={confirm} style={styles.danger}><Text style={styles.dangerText}>Confirm permanent deletion</Text></Pressable>
    {busy && <ActivityIndicator style={{ marginTop: 15 }} color="#C53030"/>}
  </View></View>;
}
const styles=StyleSheet.create({
  overlay:{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:60,backgroundColor:'#F3F6FA',padding:18,justifyContent:'center'},
  panel:{backgroundColor:'#FFFFFF',borderRadius:16,padding:18,borderWidth:1,borderColor:'#E2E8F0'},
  header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:15},
  title:{fontSize:20,fontWeight:'900',color:'#102A43'},close:{fontSize:20,color:'#718096',padding:8},
  warning:{fontSize:12,lineHeight:19,color:'#7B341E',backgroundColor:'#FFF5F5',padding:12,borderRadius:10},
  phone:{fontSize:12,fontWeight:'800',color:'#334E68',marginTop:14},
  secondary:{padding:12,borderRadius:9,backgroundColor:'#EAF3FC',marginTop:12,alignItems:'center'},secondaryText:{fontSize:11,fontWeight:'900',color:'#1565C0'},
  message:{fontSize:11,color:'#52677D',marginTop:10},debug:{fontSize:11,fontWeight:'800',color:'#975A16',marginTop:8},
  input:{height:46,borderWidth:1,borderColor:'#D9E2EC',borderRadius:9,paddingHorizontal:12,marginTop:12,color:'#102A43'},
  danger:{padding:13,borderRadius:9,backgroundColor:'#C53030',marginTop:10,alignItems:'center'},dangerText:{fontSize:11,fontWeight:'900',color:'#FFFFFF'},
});
