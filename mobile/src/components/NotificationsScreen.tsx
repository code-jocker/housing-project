import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppNotification, getNotifications, markAllNotificationsRead, markNotificationRead } from '../services/api';

type Props={onClose:()=>void};
export function NotificationsScreen({onClose}:Props){
 const [items,setItems]=useState<AppNotification[]>([]);const [unread,setUnread]=useState(0);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const refresh=useCallback(async()=>{setError('');try{const result=await getNotifications();setItems(result.data);setUnread(result.unread);}catch(e){setError(e instanceof Error?e.message:'Could not load notifications.');}},[]);
 useEffect(()=>{void refresh();},[refresh]);
 async function markOne(item:AppNotification){if(item.readAt)return;setBusy(true);try{await markNotificationRead(item.id);await refresh();}catch(e){setError(e instanceof Error?e.message:'Could not update notification.');}finally{setBusy(false);}}
 async function markAll(){setBusy(true);try{await markAllNotificationsRead();await refresh();}catch(e){setError(e instanceof Error?e.message:'Could not mark notifications as read.');}finally{setBusy(false);}}
 return <View style={styles.overlay}><View style={styles.panel}><View style={styles.header}><View><Text style={styles.title}>Notifications</Text><Text style={styles.subtitle}>{unread} unread</Text></View><Pressable onPress={onClose}><Text style={styles.close}>✕</Text></Pressable></View>
  <View style={styles.actions}><Pressable onPress={refresh} style={styles.action}><Text style={styles.actionText}>Refresh</Text></Pressable><Pressable onPress={markAll} disabled={busy||unread===0} style={styles.action}><Text style={styles.actionText}>Mark all read</Text></Pressable></View>
  {!!error&&<Text style={styles.error}>{error}</Text>}
  <ScrollView contentContainerStyle={{paddingBottom:30}}>
   {items.length===0&&<Text style={styles.empty}>No notifications yet. Updates about viewing requests and listing reviews will appear here.</Text>}
   {items.map(item=><Pressable key={item.id} onPress={()=>markOne(item)} style={[styles.card,!item.readAt&&styles.unread]}><View style={styles.row}><Text style={styles.cardTitle}>{item.title}</Text>{!item.readAt&&<View style={styles.dot}/>}</View><Text style={styles.body}>{item.body}</Text><Text style={styles.date}>{new Date(item.createdAt).toLocaleString()}</Text></Pressable>)}
  </ScrollView>
 </View></View>;
}
const styles=StyleSheet.create({overlay:{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:35,backgroundColor:'#F3F6FA'},panel:{flex:1,paddingTop:45,paddingHorizontal:18},header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingBottom:15},title:{fontSize:22,fontWeight:'900',color:'#102A43'},subtitle:{fontSize:11,color:'#718096',marginTop:3},close:{fontSize:20,color:'#718096',padding:8},actions:{flexDirection:'row',justifyContent:'flex-end',gap:8,marginBottom:12},action:{padding:9,borderRadius:8,backgroundColor:'#EAF3FC'},actionText:{fontSize:10,fontWeight:'800',color:'#1565C0'},card:{backgroundColor:'#FFFFFF',borderRadius:12,padding:14,marginBottom:9,borderWidth:1,borderColor:'#E2E8F0'},unread:{borderColor:'#90CDF4',backgroundColor:'#F7FBFF'},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},cardTitle:{fontSize:13,fontWeight:'900',color:'#102A43'},dot:{width:8,height:8,borderRadius:4,backgroundColor:'#1976D2'},body:{fontSize:11,lineHeight:17,color:'#52677D',marginTop:7},date:{fontSize:9,color:'#829AB1',marginTop:8},empty:{fontSize:12,lineHeight:18,color:'#718096',padding:16},error:{fontSize:12,color:'#C53030',marginBottom:10}});
