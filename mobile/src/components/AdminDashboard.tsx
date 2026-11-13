import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AdminAuditLog, AdminOverview, AdminPendingProperty, AdminReport, AdminUser, AdminIdentityVerification, AdminPropertyVerification, getAdminAuditLogs, getAdminOverview, getAdminReports, getAdminUsers, getPendingProperties, getAdminIdentityVerifications, getAdminPropertyVerifications, getAdminVerificationDocumentUrl, resolveAdminReport, reviewProperty, reviewIdentityVerification, reviewPropertyVerification, setAdminUserRole, setAdminUserStatus } from '../services/api';

type Props = { onClose: () => void };
export function AdminDashboard({ onClose }: Props) {
  const [overview,setOverview]=useState<AdminOverview | null>(null);
  const [pending,setPending]=useState<AdminPendingProperty[]>([]);
  const [reports,setReports]=useState<AdminReport[]>([]);
  const [users,setUsers]=useState<AdminUser[]>([]);
  const [auditLogs,setAuditLogs]=useState<AdminAuditLog[]>([]);
  const [identityChecks,setIdentityChecks]=useState<AdminIdentityVerification[]>([]);
  const [propertyChecks,setPropertyChecks]=useState<AdminPropertyVerification[]>([]);
  const [reasons,setReasons]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const refresh=useCallback(async()=>{
    setError('');
    try {
      const [stats,listings,openReports,accounts,logs,identity,propertyChecksResult]=await Promise.all([getAdminOverview(),getPendingProperties(),getAdminReports(),getAdminUsers(),getAdminAuditLogs(),getAdminIdentityVerifications(),getAdminPropertyVerifications()]);
      setOverview(stats);setPending(listings);setReports(openReports);setUsers(accounts);setAuditLogs(logs);setIdentityChecks(identity);setPropertyChecks(propertyChecksResult);
    } catch(e) { setError(e instanceof Error?e.message:'Could not load administrator data.'); }
  },[]);
  useEffect(()=>{void refresh();},[refresh]);
  async function decide(item:AdminPendingProperty,decision:'PUBLISHED'|'REJECTED') {
    const reason=reasons[item.id]?.trim();
    if(decision==='REJECTED'&&!reason){setError('Enter a reason before rejecting a listing.');return;}
    setBusy(true);setError('');
    try { await reviewProperty(item.id,decision,reason); await refresh(); }
    catch(e){setError(e instanceof Error?e.message:'Review action failed.');}
    finally{setBusy(false);}
  }
  async function updateUserStatus(user:AdminUser) {
    setBusy(true);setError('');
    try { await setAdminUserStatus(user.id,!user.isActive); await refresh(); }
    catch(e) { setError(e instanceof Error?e.message:'Could not update account status.'); }
    finally { setBusy(false); }
  }
  async function updateUserRole(user:AdminUser,role:'TENANT'|'LANDLORD'|'AGENT') {
    setBusy(true);setError('');
    try { await setAdminUserRole(user.id,role); await refresh(); }
    catch(e) { setError(e instanceof Error?e.message:'Could not update user role.'); }
    finally { setBusy(false); }
  }
  async function decideIdentity(item:AdminIdentityVerification,decision:'APPROVED'|'REJECTED') {
    const reason=reasons[item.id]?.trim();
    if(decision==='REJECTED'&&!reason){setError('Enter a rejection reason for identity documents.');return;}
    setBusy(true);setError('');
    try { await reviewIdentityVerification(item.id,decision,reason); await refresh(); }
    catch(e){setError(e instanceof Error?e.message:'Identity review failed.');}
    finally{setBusy(false);}
  }
  async function decideProperty(item:AdminPropertyVerification,decision:'APPROVED'|'REJECTED') {
    const reason=reasons[item.id]?.trim();
    if(decision==='REJECTED'&&!reason){setError('Enter a rejection reason for property documents.');return;}
    setBusy(true);setError('');
    try { await reviewPropertyVerification(item.id,decision,reason); await refresh(); }
    catch(e){setError(e instanceof Error?e.message:'Property verification review failed.');}
    finally{setBusy(false);}
  }
  async function openVerificationDocument(kind:'identity'|'property',id:string) {
    setBusy(true);setError('');
    try { const url=await getAdminVerificationDocumentUrl(kind,id); await Linking.openURL(url); }
    catch(e){setError(e instanceof Error?e.message:'Could not open the private document.');}
    finally{setBusy(false);}
  }
  async function resolve(report:AdminReport) {
    setBusy(true);setError('');
    try { await resolveAdminReport(report.id); await refresh(); }
    catch(e){setError(e instanceof Error?e.message:'Could not update the report.');}
    finally{setBusy(false);}
  }
  return <View style={styles.overlay}><View style={styles.panel}>
    <View style={styles.header}><View><Text style={styles.title}>Admin operations</Text><Text style={styles.subtitle}>Moderation and platform safety</Text></View><Pressable onPress={onClose}><Text style={styles.close}>✕</Text></Pressable></View>
    <ScrollView contentContainerStyle={{paddingBottom:30}}>
      {!!error&&<Text style={styles.error}>{error}</Text>}
      <View style={styles.actions}><Pressable onPress={refresh} style={styles.refresh}><Text style={styles.refreshText}>Refresh data</Text></Pressable></View>
      {overview?<View style={styles.stats}>{[{label:'Users',value:overview.users},{label:'Listings',value:overview.properties},{label:'Pending review',value:overview.pendingListings},{label:'Open reports',value:overview.openReports},{label:'Viewing requests',value:overview.pendingViewings},{label:'Identity checks',value:overview.pendingIdentityVerifications},{label:'Property checks',value:overview.pendingPropertyVerifications}].map(x=><View key={x.label} style={styles.stat}><Text style={styles.statValue}>{x.value}</Text><Text style={styles.statLabel}>{x.label}</Text></View>)}</View>:<ActivityIndicator color="#1976D2"/>}
      <Text style={styles.section}>Listings awaiting review ({pending.length})</Text>
      {pending.length===0&&<Text style={styles.empty}>No pending listings.</Text>}
      {pending.map(item=><View key={item.id} style={styles.card}>
        <Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.meta}>{item.district}, {item.sector} · RWF {item.monthlyRentRwf.toLocaleString('en-US')}/month</Text>
        <Text style={styles.description}>{item.description}</Text>
        <Text style={styles.owner}>Submitted by: {item.owner.fullName} · {item.owner.phone} ({item.owner.role})</Text>
        <Text style={styles.caution}>Platform moderation is not proof of ownership or authority to rent. Check the supporting documents through the approved verification process.</Text>
        <TextInput value={reasons[item.id]||''} onChangeText={value=>setReasons(current=>({...current,[item.id]:value}))} placeholder="Reason required if rejecting" style={styles.input}/>
        <View style={styles.buttons}><Pressable disabled={busy} onPress={()=>decide(item,'PUBLISHED')} style={styles.approve}><Text style={styles.buttonText}>Approve listing</Text></Pressable><Pressable disabled={busy} onPress={()=>decide(item,'REJECTED')} style={styles.reject}><Text style={styles.buttonText}>Reject</Text></Pressable></View>
      </View>)}
      <Text style={styles.section}>Identity verification queue ({identityChecks.length})</Text>
      {identityChecks.length===0&&<Text style={styles.empty}>No pending identity submissions.</Text>}
      {identityChecks.map(item=><View key={item.id} style={styles.card}>
        <Text style={styles.cardTitle}>{item.user.fullName}</Text><Text style={styles.meta}>{item.user.phone} · {item.user.role} · {item.documentType.replaceAll('_',' ')}</Text>
        <Text style={styles.owner}>Legal name: {item.legalName} · Document ending {item.documentLast4}</Text>
        <Pressable disabled={busy} onPress={()=>openVerificationDocument('identity',item.id)} style={styles.resolve}><Text style={styles.resolveText}>Open private ID document</Text></Pressable>
        <TextInput value={reasons[item.id]||''} onChangeText={value=>setReasons(current=>({...current,[item.id]:value}))} placeholder="Reason required if rejecting" style={styles.input}/>
        <View style={styles.buttons}><Pressable disabled={busy} onPress={()=>decideIdentity(item,'APPROVED')} style={styles.approve}><Text style={styles.buttonText}>Approve identity</Text></Pressable><Pressable disabled={busy} onPress={()=>decideIdentity(item,'REJECTED')} style={styles.reject}><Text style={styles.buttonText}>Reject</Text></Pressable></View>
      </View>)}
      <Text style={styles.section}>Property authority verification ({propertyChecks.length})</Text>
      {propertyChecks.length===0&&<Text style={styles.empty}>No pending property documents.</Text>}
      {propertyChecks.map(item=><View key={item.id} style={styles.card}>
        <Text style={styles.cardTitle}>{item.property.title}</Text><Text style={styles.meta}>{item.property.district}, {item.property.sector} · {item.documentType.replaceAll('_',' ')}</Text>
        <Text style={styles.owner}>Submitted by {item.owner.fullName} · {item.owner.phone}</Text>
        <Text style={styles.caution}>Approval requires the owner's identity verification to be approved first. Document review does not replace an in-person or independent check when risk is high.</Text>
        <Pressable disabled={busy} onPress={()=>openVerificationDocument('property',item.id)} style={styles.resolve}><Text style={styles.resolveText}>Open private property document</Text></Pressable>
        <TextInput value={reasons[item.id]||''} onChangeText={value=>setReasons(current=>({...current,[item.id]:value}))} placeholder="Reason required if rejecting" style={styles.input}/>
        <View style={styles.buttons}><Pressable disabled={busy} onPress={()=>decideProperty(item,'APPROVED')} style={styles.approve}><Text style={styles.buttonText}>Verify property</Text></Pressable><Pressable disabled={busy} onPress={()=>decideProperty(item,'REJECTED')} style={styles.reject}><Text style={styles.buttonText}>Reject</Text></Pressable></View>
      </View>)}
      <Text style={styles.section}>Reported listings ({reports.length})</Text>
      {reports.length===0&&<Text style={styles.empty}>No unresolved reports.</Text>}
      {reports.map(report=><View key={report.id} style={styles.card}><Text style={styles.cardTitle}>{report.property.title}</Text><Text style={styles.meta}>{report.reason} · {report.property.district}, {report.property.sector}</Text><Text style={styles.description}>{report.details||'No additional details supplied.'}</Text><Text style={styles.owner}>Reported by {report.reporter.fullName} · {report.reporter.phone}</Text><Pressable disabled={busy} onPress={()=>resolve(report)} style={styles.resolve}><Text style={styles.resolveText}>Mark report resolved</Text></Pressable></View>)}
      <Text style={styles.section}>User accounts ({users.length})</Text>
      {users.map(account=><View key={account.id} style={styles.card}>
        <Text style={styles.cardTitle}>{account.fullName}</Text><Text style={styles.meta}>{account.phone}{account.email ? ' · ' + account.email : ''}</Text>
        <Text style={styles.owner}>Role: {account.role} · {account.isActive?'Active':'Disabled'} · {account.phoneVerifiedAt?'Phone verified':'Phone unverified'}</Text>
        {account.role!=='ADMIN'&&<>
          <View style={styles.buttons}><Pressable disabled={busy} onPress={()=>updateUserStatus(account)} style={account.isActive?styles.reject:styles.approve}><Text style={styles.buttonText}>{account.isActive?'Deactivate':'Activate'}</Text></Pressable></View>
          <View style={styles.roleButtons}>{(['TENANT','LANDLORD','AGENT'] as const).filter(role=>role!==account.role).map(role=><Pressable key={role} disabled={busy} onPress={()=>updateUserRole(account,role)} style={styles.roleButton}><Text style={styles.roleText}>Set {role.toLowerCase()}</Text></Pressable>)}</View>
        </>}
      </View>)}
      <Text style={styles.section}>Recent audit activity ({auditLogs.length})</Text>
      {auditLogs.map(log=><View key={log.id} style={styles.card}><Text style={styles.cardTitle}>{log.action.replaceAll('_',' ')}</Text><Text style={styles.meta}>{log.entityType} · {log.entityId}</Text><Text style={styles.owner}>Actor: {log.actorId}</Text>{!!log.details&&<Text style={styles.description}>{log.details}</Text>}<Text style={styles.meta}>{new Date(log.createdAt).toLocaleString()}</Text></View>)}
    </ScrollView>
  </View></View>;
}
const styles=StyleSheet.create({overlay:{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:30,backgroundColor:'#F3F6FA'},panel:{flex:1,paddingTop:45,paddingHorizontal:18},header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingBottom:18},title:{fontSize:22,fontWeight:'900',color:'#102A43'},subtitle:{fontSize:11,color:'#718096',marginTop:3},close:{fontSize:20,color:'#718096',padding:8},actions:{alignItems:'flex-end',marginBottom:12},refresh:{paddingVertical:8,paddingHorizontal:13,borderRadius:9,backgroundColor:'#EAF3FC'},refreshText:{fontSize:11,fontWeight:'800',color:'#1565C0'},stats:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:22},stat:{width:'31%',backgroundColor:'#FFFFFF',borderRadius:12,padding:12,borderWidth:1,borderColor:'#E2E8F0'},statValue:{fontSize:20,fontWeight:'900',color:'#1565C0'},statLabel:{fontSize:9,color:'#718096',marginTop:3},section:{fontSize:16,fontWeight:'900',color:'#102A43',marginTop:12,marginBottom:10},empty:{fontSize:12,color:'#718096',padding:12},card:{backgroundColor:'#FFFFFF',borderRadius:14,padding:14,marginBottom:12,borderWidth:1,borderColor:'#E2E8F0'},cardTitle:{fontSize:14,fontWeight:'900',color:'#102A43'},meta:{fontSize:10,color:'#627D98',marginTop:5},description:{fontSize:11,lineHeight:17,color:'#52677D',marginTop:8},owner:{fontSize:10,color:'#334E68',fontWeight:'700',marginTop:8},caution:{fontSize:10,lineHeight:15,color:'#975A16',backgroundColor:'#FFFAF0',padding:9,borderRadius:8,marginTop:9},input:{height:40,borderWidth:1,borderColor:'#D9E2EC',borderRadius:8,paddingHorizontal:10,fontSize:11,marginTop:10},buttons:{flexDirection:'row',gap:8,marginTop:10},approve:{flex:1,backgroundColor:'#198754',padding:11,borderRadius:8,alignItems:'center'},reject:{backgroundColor:'#C53030',paddingHorizontal:18,paddingVertical:11,borderRadius:8,alignItems:'center'},buttonText:{fontSize:11,fontWeight:'900',color:'#FFFFFF'},resolve:{alignSelf:'flex-start',padding:9,backgroundColor:'#EAF3FC',borderRadius:8,marginTop:10},resolveText:{fontSize:10,fontWeight:'800',color:'#1565C0'},roleButtons:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:8},roleButton:{padding:7,borderRadius:7,backgroundColor:'#EDF2F7'},roleText:{fontSize:9,fontWeight:'800',color:'#334E68'},error:{color:'#C53030',fontSize:12,marginBottom:10}});
