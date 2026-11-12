import React, { useMemo, useState } from 'react';
import { SafeAreaView, View, Text, TextInput, ScrollView, Image, Pressable, StyleSheet, StatusBar } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { properties, Property } from './src/data/properties';
import { colors } from './src/theme';

const money = (value: number) => `RWF ${value.toLocaleString('en-US')}`;

function PropertyCard({ item, saved, onSave, onOpen }: { item: Property; saved: boolean; onSave: () => void; onOpen: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onOpen}>
      <View>
        <Image source={{ uri: item.image }} style={styles.photo} />
        {item.verified && <View style={styles.verified}><Text style={styles.verifiedText}>✓ Verified listing</Text></View>}
        <Pressable style={styles.heart} onPress={(event) => { event.stopPropagation(); onSave(); }}><Text style={styles.heartText}>{saved ? '♥' : '♡'}</Text></Pressable>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.price}>{money(item.rent)}<Text style={styles.perMonth}> / month</Text></Text>
        <Text style={styles.propertyTitle}>{item.title}</Text>
        <Text style={styles.location}>⌖ {item.sector}, {item.district}</Text>
        <View style={styles.metaRow}><Text style={styles.meta}>{item.bedrooms} bedroom{item.bedrooms === 1 ? '' : 's'}</Text><Text style={styles.meta}>{item.bathrooms} bathroom{item.bathrooms === 1 ? '' : 's'}</Text><Text style={styles.meta}>{item.type}</Text></View>
      </View>
    </Pressable>
  );
}

export default function App() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [saved, setSaved] = useState<string[]>([]);
  const [selected, setSelected] = useState<Property | null>(null);
  const filtered = useMemo(() => properties.filter(p => {
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || `${p.title} ${p.district} ${p.sector} ${p.type}`.toLowerCase().includes(q);
    const matchesFilter = filter === 'All' || (filter === 'Verified' ? p.verified : p.type === filter);
    return matchesQuery && matchesFilter && p.available;
  }), [query, filter]);
  const toggleSave = (id: string) => setSaved(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id]);

  if (selected) return (
    <SafeAreaView style={styles.safe}><ExpoStatusBar style="dark" /><ScrollView>
      <Pressable style={styles.back} onPress={() => setSelected(null)}><Text style={styles.backText}>‹  Back to listings</Text></Pressable>
      <Image source={{ uri: selected.image }} style={styles.detailPhoto} />
      <View style={styles.detailBody}><Text style={styles.price}>{money(selected.rent)}<Text style={styles.perMonth}> / month</Text></Text><Text style={styles.detailTitle}>{selected.title}</Text><Text style={styles.location}>⌖ {selected.sector}, {selected.district}, Kigali</Text>
        <View style={styles.metaRow}><Text style={styles.meta}>{selected.bedrooms} bedrooms</Text><Text style={styles.meta}>{selected.bathrooms} bathrooms</Text><Text style={styles.meta}>{selected.type}</Text></View>
        <Text style={styles.sectionTitle}>About this property</Text><Text style={styles.description}>{selected.description}</Text>
        <Text style={styles.sectionTitle}>Listing status</Text><Text style={styles.description}>{selected.verified ? 'Identity/listing review badge shown in this demo. Confirm ownership or authority to rent separately.' : 'This listing has not yet been verified. Exercise caution before paying any money.'}</Text>
        <Pressable style={styles.primaryButton} onPress={() => alert('Viewing requests will be available after the backend is connected.')}><Text style={styles.primaryButtonText}>Request a viewing</Text></Pressable>
      </View>
    </ScrollView></SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe}><ExpoStatusBar style="dark" /><ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.header}><View><Text style={styles.brand}>HousingConnect</Text><Text style={styles.country}>RWANDA · FIND A PLACE TO CALL HOME</Text></View><View style={styles.avatar}><Text style={styles.avatarText}>HC</Text></View></View>
      <View style={styles.hero}><Text style={styles.eyebrow}>YOUR NEXT HOME STARTS HERE</Text><Text style={styles.heroTitle}>Find a home that fits your life.</Text><Text style={styles.heroSub}>Explore rental homes across Rwanda with clearer prices and safer listings.</Text>
        <View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput value={query} onChangeText={setQuery} placeholder="Search district, sector or property" placeholderTextColor="#8292A6" style={styles.searchInput} /></View>
      </View>
      <View style={styles.content}><View style={styles.headingRow}><Text style={styles.sectionTitle}>Explore properties</Text><Text style={styles.count}>{filtered.length} found</Text></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{['All', 'Verified', 'Apartment', 'House', 'Studio'].map(option => <Pressable key={option} onPress={() => setFilter(option)} style={[styles.filter, filter === option && styles.filterActive]}><Text style={[styles.filterText, filter === option && styles.filterTextActive]}>{option}</Text></Pressable>)}</ScrollView>
        {filtered.map(item => <PropertyCard key={item.id} item={item} saved={saved.includes(item.id)} onSave={() => toggleSave(item.id)} onOpen={() => setSelected(item)} />)}
        {filtered.length === 0 && <View style={styles.empty}><Text style={styles.emptyTitle}>No properties found</Text><Text style={styles.description}>Try another district, sector or property type.</Text></View>}
      </View>
    </ScrollView><View style={styles.tabBar}><Text style={styles.tabActive}>⌂  Explore</Text><Text style={styles.tab}>♡  Saved ({saved.length})</Text><Text style={styles.tab}>＋  List a home</Text><Text style={styles.tab}>☻  Profile</Text></View></SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.background},header:{paddingHorizontal:20,paddingTop:12,paddingBottom:18,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},brand:{fontSize:23,fontWeight:'800',color:colors.navy,letterSpacing:-0.6},country:{fontSize:9,fontWeight:'700',letterSpacing:1.2,color:colors.muted,marginTop:3},avatar:{width:40,height:40,borderRadius:14,backgroundColor:colors.blueLight,alignItems:'center',justifyContent:'center'},avatarText:{color:colors.blue,fontWeight:'800'},hero:{backgroundColor:colors.navy,padding:22,paddingBottom:26},eyebrow:{fontSize:10,fontWeight:'800',letterSpacing:1.5,color:'#A9D2F2'},heroTitle:{fontSize:29,lineHeight:35,fontWeight:'800',color:'#FFFFFF',marginTop:10,maxWidth:300},heroSub:{fontSize:13,lineHeight:20,color:'#D7E4EF',marginTop:8},searchBox:{height:52,backgroundColor:'#FFFFFF',borderRadius:13,marginTop:20,paddingHorizontal:14,flexDirection:'row',alignItems:'center'},searchIcon:{fontSize:25,color:colors.blue,marginRight:8},searchInput:{flex:1,fontSize:13,color:colors.text},content:{paddingHorizontal:18,paddingTop:22,paddingBottom:28},headingRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},sectionTitle:{fontSize:18,fontWeight:'800',color:colors.navy,marginBottom:12},count:{fontSize:12,color:colors.muted,marginBottom:12},filters:{gap:8,paddingBottom:17},filter:{paddingHorizontal:15,paddingVertical:9,borderRadius:22,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:colors.border},filterActive:{backgroundColor:colors.blue,borderColor:colors.blue},filterText:{fontSize:12,fontWeight:'700',color:colors.muted},filterTextActive:{color:'#FFFFFF'},card:{backgroundColor:'#FFFFFF',borderRadius:17,overflow:'hidden',marginBottom:16,borderWidth:1,borderColor:colors.border},photo:{height:190,width:'100%',backgroundColor:'#DCE5ED'},verified:{position:'absolute',top:12,left:12,backgroundColor:'#E7F6EF',paddingHorizontal:10,paddingVertical:6,borderRadius:20},verifiedText:{fontSize:10,fontWeight:'800',color:colors.green},heart:{position:'absolute',right:12,top:12,width:36,height:36,borderRadius:18,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},heartText:{fontSize:22,color:colors.danger},cardBody:{padding:15},price:{fontSize:17,fontWeight:'800',color:colors.blue},perMonth:{fontSize:11,fontWeight:'500',color:colors.muted},propertyTitle:{fontSize:15,fontWeight:'800',color:colors.navy,marginTop:7},location:{fontSize:12,color:colors.muted,marginTop:6},metaRow:{flexDirection:'row',gap:8,marginTop:12,flexWrap:'wrap'},meta:{fontSize:10,fontWeight:'700',color:'#52677D',backgroundColor:'#F2F5F8',paddingHorizontal:9,paddingVertical:6,borderRadius:7},empty:{padding:25,alignItems:'center'},emptyTitle:{fontSize:16,fontWeight:'800',color:colors.navy,marginBottom:7},tabBar:{backgroundColor:'#FFFFFF',borderTopWidth:1,borderTopColor:colors.border,paddingVertical:13,paddingHorizontal:10,flexDirection:'row',justifyContent:'space-around'},tab:{fontSize:10,color:colors.muted,fontWeight:'700'},tabActive:{fontSize:10,color:colors.blue,fontWeight:'800'},back:{padding:18},backText:{fontSize:14,color:colors.blue,fontWeight:'800'},detailPhoto:{width:'100%',height:260,backgroundColor:'#DCE5ED'},detailBody:{padding:20},detailTitle:{fontSize:23,fontWeight:'800',color:colors.navy,marginTop:8},description:{fontSize:13,lineHeight:21,color:'#52677D',marginBottom:10},primaryButton:{height:52,backgroundColor:colors.blue,borderRadius:13,alignItems:'center',justifyContent:'center',marginTop:18},primaryButtonText:{fontSize:14,fontWeight:'800',color:'#FFFFFF'}
});
