import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AuthUser, login, register, requestOtp, verifyOtp } from '../services/api';

type Props = { onAuthenticated: (user: AuthUser) => void; onClose: () => void };
export function AuthScreen({ onAuthenticated, onClose }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('+250');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'TENANT' | 'LANDLORD'>('TENANT');
  const [verificationPending, setVerificationPending] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [debugCode, setDebugCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function submit() {
    setError(''); setNotice('');
    if (!phone.trim() || password.length < 8 || (mode === 'register' && fullName.trim().length < 2)) {
      setError('Enter your name (for registration), phone number and a password of at least 8 characters.'); return;
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        try { onAuthenticated(await login(phone.trim(), password)); }
        catch (e) {
          if (e instanceof Error && e.message.toLowerCase().includes('verify your phone')) {
            const result = await requestOtp(phone.trim()); setVerificationPending(true); setDebugCode(result.debugCode || ''); setNotice(result.message);
          } else throw e;
        }
      }
      else {
        const result = await register({ fullName: fullName.trim(), phone: phone.trim(), ...(email.trim() ? { email: email.trim() } : {}), password, role });
        if (result.verificationRequired) {
          setVerificationPending(true); setDebugCode(result.debugCode || ''); setNotice(result.message || 'Enter the code sent to your phone.');
        } else if (result.user) onAuthenticated(result.user);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not authenticate. Try again.'); }
    finally { setBusy(false); }
  }

  async function verify() {
    setError(''); setBusy(true);
    try {
      await verifyOtp(phone.trim(), otpCode.trim());
      onAuthenticated(await login(phone.trim(), password));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not verify your phone.'); }
    finally { setBusy(false); }
  }

  async function resend() {
    setError(''); setBusy(true);
    try {
      const result = await requestOtp(phone.trim());
      setNotice(result.message); setDebugCode(result.debugCode || '');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not resend the code.'); }
    finally { setBusy(false); }
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.panel}>
        <ScrollView keyboardShouldPersistTaps="handled">
          <View style={styles.top}><View><Text style={styles.brand}>HousingConnect</Text><Text style={styles.subtitle}>Your home search, in one place</Text></View><Pressable onPress={onClose}><Text style={styles.close}>✕</Text></Pressable></View>
          {verificationPending ? <>
            <Text style={styles.heading}>Verify your phone</Text>
            <Text style={styles.copy}>Enter the 6-digit code sent to {phone}.</Text>
            <Text style={styles.label}>Verification code</Text>
            <TextInput value={otpCode} onChangeText={setOtpCode} placeholder="000000" style={styles.input} keyboardType="number-pad" maxLength={6} />
            {!!debugCode && <Text style={styles.debug}>Development code: {debugCode}</Text>}
            {!!notice && <Text style={styles.notice}>{notice}</Text>}
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Pressable onPress={verify} disabled={busy || otpCode.length !== 6} style={[styles.submit, (busy || otpCode.length !== 6) && { opacity: 0.65 }]}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>Verify and sign in</Text>}</Pressable>
            <Pressable onPress={resend} disabled={busy}><Text style={styles.switch}>Resend verification code</Text></Pressable>
          </> : <>
            <Text style={styles.heading}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</Text>
            <Text style={styles.copy}>{mode === 'login' ? 'Sign in to save homes and request viewings.' : 'Join HousingConnect as a tenant or landlord.'}</Text>
            {mode === 'register' && <>
              <Text style={styles.label}>Full name</Text><TextInput value={fullName} onChangeText={setFullName} placeholder="Your full name" style={styles.input} autoCapitalize="words" />
              <Text style={styles.label}>Account type</Text><View style={styles.roles}>{(['TENANT', 'LANDLORD'] as const).map(item => <Pressable key={item} onPress={() => setRole(item)} style={[styles.role, role === item && styles.roleActive]}><Text style={[styles.roleText, role === item && styles.roleTextActive]}>{item === 'TENANT' ? 'I need a home' : 'I have a property'}</Text></Pressable>)}</View>
              <Text style={styles.label}>Email (optional)</Text><TextInput value={email} onChangeText={setEmail} placeholder="Email address" style={styles.input} keyboardType="email-address" autoCapitalize="none" />
            </>}
            <Text style={styles.label}>Phone number</Text><TextInput value={phone} onChangeText={setPhone} placeholder="+250..." style={styles.input} keyboardType="phone-pad" />
            <Text style={styles.label}>Password</Text><TextInput value={password} onChangeText={setPassword} placeholder="At least 8 characters" style={styles.input} secureTextEntry />
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Pressable onPress={submit} disabled={busy} style={[styles.submit, busy && { opacity: 0.65 }]}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>{mode === 'login' ? 'Sign in' : 'Create account'}</Text>}</Pressable>
            <Text style={styles.notice}>Use an international phone number beginning with + (for example, +250…). Phone verification is required before production sign-in.</Text>
            <Pressable onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}><Text style={styles.switch}>{mode === 'login' ? 'New to HousingConnect? Create an account' : 'Already registered? Sign in'}</Text></Pressable>
          </>}
        </ScrollView>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  overlay:{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:20,backgroundColor:'rgba(8,25,45,0.58)',justifyContent:'flex-end'},
  panel:{backgroundColor:'#FFFFFF',borderTopLeftRadius:26,borderTopRightRadius:26,padding:22,maxHeight:'92%'},
  top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:26},brand:{fontSize:20,fontWeight:'900',color:'#102A43'},subtitle:{fontSize:11,color:'#718096',marginTop:3},close:{fontSize:20,color:'#718096',padding:8},
  heading:{fontSize:25,fontWeight:'900',color:'#102A43'},copy:{fontSize:13,color:'#718096',marginTop:7,marginBottom:18},
  label:{fontSize:12,fontWeight:'800',color:'#334E68',marginBottom:7,marginTop:12},input:{height:48,borderWidth:1,borderColor:'#D9E2EC',borderRadius:11,paddingHorizontal:13,color:'#102A43',fontSize:14},
  roles:{flexDirection:'row',gap:9},role:{flex:1,padding:12,borderWidth:1,borderColor:'#D9E2EC',borderRadius:10,alignItems:'center'},roleActive:{borderColor:'#1976D2',backgroundColor:'#EAF3FC'},roleText:{fontSize:11,fontWeight:'700',color:'#627D98'},roleTextActive:{color:'#1565C0'},
  submit:{height:50,backgroundColor:'#1976D2',borderRadius:12,alignItems:'center',justifyContent:'center',marginTop:20},submitText:{color:'#FFFFFF',fontSize:14,fontWeight:'900'},error:{color:'#C53030',fontSize:12,marginTop:12},notice:{fontSize:10,lineHeight:15,color:'#9C4221',backgroundColor:'#FFFAF0',padding:10,borderRadius:8,marginTop:12},debug:{fontSize:12,color:'#276749',fontWeight:'800',marginTop:10},switch:{fontSize:12,fontWeight:'800',color:'#1976D2',textAlign:'center',marginTop:18,marginBottom:10}
});
